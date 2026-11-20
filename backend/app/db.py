"""SQLite storage, atomic migrations and shared case access checks."""

import os
import sqlite3
import sys
import time
from contextlib import closing, contextmanager
from pathlib import Path
from secrets import token_urlsafe
from uuid import UUID, uuid4

from anyio import Lock
from anyio.lowlevel import RunVar
from fastapi import HTTPException
from fastapi.concurrency import contextmanager_in_threadpool


sqlite3.register_adapter(UUID, str)
sqlite3.register_converter("UUID", lambda data: UUID(data.decode("ascii")))
sqlite3.register_converter("BOOLEAN", lambda data: data == b"1")


def database_path():
    if configured := os.environ.get("FORENSIQ_DB_PATH"):
        return Path(configured).expanduser().resolve()
    if directory := os.environ.get("FORENSIQ_LOCAL_DIR"):
        return Path(directory).expanduser().resolve() / "forensiq.sqlite3"
    if os.name == "nt":
        parent = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    elif sys.platform == "darwin":
        parent = Path.home() / "Library" / "Application Support"
    else:
        parent = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return parent / "FORENSIQ" / "local" / "forensiq.sqlite3"


def dict_row(cursor, values):
    return {column[0]: value for column, value in zip(cursor.description, values)}


@contextmanager
def _open():
    file = database_path()
    file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # SQLite derives sidecar permissions from the main file. Set its initial mode
    # explicitly even if the parent is a user-configured shared staging directory.
    fd = os.open(file, os.O_CREAT | os.O_RDWR, 0o600)
    os.close(fd)
    with closing(sqlite3.connect(
        file, isolation_level=None, timeout=30, check_same_thread=False,
        detect_types=sqlite3.PARSE_DECLTYPES,
    )) as db:
        db.row_factory = dict_row
        db.execute("PRAGMA foreign_keys = ON")
        db.execute("PRAGMA recursive_triggers = ON")
        db.create_function("casefold", 1, str.casefold, deterministic=True)
        yield db


@contextmanager
def connect():
    """One transaction per request, including validation, permission checks and audit writes."""
    with _open() as db, db:
        # Obtain the write reservation before reading. This prevents competing first
        # signups or custody transfers from making a decision on an obsolete snapshot.
        db.execute("BEGIN IMMEDIATE")
        yield db


# SQLite allows one writer. Wait in the event loop so a queue of database
# requests cannot fill FastAPI's worker pool while the active transaction
# is waiting for a worker to run its endpoint. Each server loop has its own gate.
_request_gate = RunVar("forensiq_request_gate", default=None)


async def connection():
    gate = _request_gate.get()
    if gate is None:
        gate = Lock()
        _request_gate.set(gate)
    async with gate, contextmanager_in_threadpool(connect()) as conn:
        yield conn


def migrate():
    folder = Path(__file__).resolve().parents[1] / "migrations"
    with _open() as db, db:
        # Two brand-new workers can contend while changing the database
        # header to WAL. SQLite may return BUSY here without using its timeout.
        deadline = time.monotonic() + 30
        while True:
            try:
                db.execute("PRAGMA journal_mode = WAL").fetchone()
                break
            except sqlite3.OperationalError as exc:
                if (exc.sqlite_errorcode & 255) != sqlite3.SQLITE_BUSY or time.monotonic() >= deadline:
                    raise
                time.sleep(0.05)
        db.execute("BEGIN IMMEDIATE")
        db.execute("""CREATE TABLE IF NOT EXISTS schema_versions (
            name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL
            DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )""")
        applied = {row["name"] for row in db.execute("SELECT name FROM schema_versions")}
        for path in sorted(folder.glob("*.sql")):
            if path.name in applied:
                continue
            # executescript() can implicitly commit; keep all DDL and its version
            # marker in our transaction, including trigger bodies with semicolons.
            statement = ""
            for line in path.read_text(encoding="utf-8").splitlines(keepends=True):
                statement += line
                if sqlite3.complete_statement(statement):
                    db.execute(statement)
                    statement = ""
            if statement.strip():
                raise RuntimeError(f"Incomplete statement in SQLite migration {path.name}")
            db.execute("INSERT INTO schema_versions(name) VALUES(?)", (path.name,))
        db.execute(
            "INSERT INTO session_signing_key(singleton,secret) VALUES(1,?) ON CONFLICT(singleton) DO NOTHING",
            (token_urlsafe(48),),
        )


def next_code(conn, prefix):
    """Reserve the next display identifier in the same transaction as its record."""
    row = conn.execute(
        """UPDATE code_counters SET last_value=last_value+1 WHERE prefix=?
           RETURNING prefix || '-' || strftime('%Y','now') || '-' || last_value AS code""", (prefix,),
    ).fetchone()
    if row is None:
        raise ValueError("Unknown record code prefix")
    return row["code"]


def log(conn, action, actor_id=None, case_id=None, evidence_id=None, *, subject_id=None):
    conn.execute(
        "INSERT INTO audit(id,action,actor_id,case_id,evidence_id,subject_id) VALUES(?,?,?,?,?,?)",
        (uuid4(), action, actor_id, case_id, evidence_id, subject_id),
    )


# Each query using this predicate aliases cases as c. Binds: role, user ID, user ID.
VISIBLE = """(? = 'admin' OR c.owner_id = ? OR EXISTS (
    SELECT 1 FROM case_members cm WHERE cm.case_id=c.id AND cm.user_id=?))"""


def visibility(user):
    return (user["role"], user["id"], user["id"])


CASE_SELECT = """SELECT c.*, u.name AS owner_name FROM cases c JOIN users u ON c.owner_id=u.id"""
EVIDENCE_SELECT = """SELECT e.*, c.code AS case_code, u.name AS custodian_name
    FROM evidence e JOIN cases c ON c.id=e.case_id JOIN users u ON e.custodian_id=u.id"""
EVENT_SELECT = """SELECT a.id,a.action,coalesce(u.name,'System') AS actor_name,a.case_id,c.code AS case_code,
    a.evidence_id,e.code AS evidence_code,a.subject_id,subject.name AS subject_name,a.created_at
    FROM audit a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN users subject ON subject.id=a.subject_id
    LEFT JOIN cases c ON c.id=a.case_id LEFT JOIN evidence e ON e.id=a.evidence_id"""


def get_case(conn, user, case_id: UUID, *, open_only=False):
    row = conn.execute(
        CASE_SELECT + " WHERE c.id=? AND " + VISIBLE,
        (case_id, *visibility(user)),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Case not found.")
    if open_only and row["status"] == "closed":
        raise HTTPException(409, "Reopen this case before making changes.")
    return row


def get_evidence(conn, user, evidence_id: UUID):
    row = conn.execute(
        EVIDENCE_SELECT + " WHERE e.id=? AND " + VISIBLE, (evidence_id, *visibility(user))
    ).fetchone()
    if not row:
        raise HTTPException(404, "Evidence not found.")
    return row


def case_users(conn, case_id):
    return conn.execute(
        """SELECT u.id,u.name,u.role FROM users u JOIN cases c ON c.id=?
          WHERE u.id=c.owner_id OR EXISTS(SELECT 1 FROM case_members m WHERE m.case_id=c.id AND m.user_id=u.id)
          ORDER BY u.name,u.id""",
        (case_id,),
    ).fetchall()


def case_notes(conn, case_id):
    return conn.execute(
        """SELECT n.id,n.body,u.name AS author_name,n.created_at FROM notes n
                          JOIN users u ON u.id=n.author_id WHERE n.case_id=? ORDER BY n.created_at DESC,n.rowid DESC""",
        (case_id,),
    ).fetchall()
