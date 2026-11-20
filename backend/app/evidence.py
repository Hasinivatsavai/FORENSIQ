"""Registration, access, custody, relationships and content-based integrity checks."""

import hashlib
import hmac
from pathlib import PurePosixPath
from typing import Annotated
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError

from . import outputs
from .db import (
    EVENT_SELECT,
    EVIDENCE_SELECT,
    VISIBLE,
    get_case,
    get_evidence,
    log,
    next_code,
    visibility,
)
from .schemas import Classification, Integrity, Link, NewEvidence, Transfer
from .security import DB, User, Writer

router = APIRouter(prefix="/evidence", tags=["Evidence"])
FILE_LIMIT = 10 * 1024 * 1024
CUSTODY_SELECT = """SELECT h.id,h.evidence_id,f.name AS from_name,t.name AS to_name,h.location,h.reason,
    h.created_at,a.name AS actor_name FROM custody h LEFT JOIN users f ON f.id=h.from_id
    JOIN users t ON t.id=h.to_id JOIN users a ON a.id=h.actor_id"""
CHECK_SELECT = """SELECT v.id,v.evidence_id,v.digest,v.matches,u.name AS actor_name,v.created_at FROM integrity_checks v
    JOIN users u ON v.actor_id=u.id"""


def register_custody(db, evidence_id, previous, recipient, actor, location, reason):
    db.execute(
        """INSERT INTO custody(id,evidence_id,from_id,to_id,actor_id,location,reason)
               VALUES(?,?,?,?,?,?,?)""",
        (uuid4(), evidence_id, previous, recipient, actor, location, reason),
    )


@router.get("", response_model=list[outputs.Evidence])
def list_evidence(
    user: User,
    db: DB,
    q: str = Query("", max_length=160, pattern=r"^[^\x00]*$"),
    case_id: UUID | None = None,
    integrity: Integrity | None = None,
):
    sql = EVIDENCE_SELECT + " WHERE " + VISIBLE
    args = list(visibility(user))
    if q.strip():
        sql += (
            " AND instr(casefold(e.title || ' ' || e.code || ' ' || c.code || ' ' || "
            "e.classification || ' ' || e.location), ?) > 0"
        )
        args.append(q.strip().casefold())
    if case_id:
        sql += " AND e.case_id=?"
        args.append(case_id)
    if integrity:
        sql += " AND e.integrity=?"
        args.append(integrity)
    return db.execute(sql + " ORDER BY e.created_at DESC,e.rowid DESC", args).fetchall()


@router.post("", status_code=201, response_model=outputs.Evidence)
def register_evidence(
    user: Writer,
    db: DB,
    case_id: Annotated[UUID, Form()],
    title: Annotated[str, Form(max_length=160)],
    classification: Annotated[Classification, Form()],
    location: Annotated[str, Form(max_length=300)],
    description: Annotated[str, Form(max_length=6000)] = "",
    file: Annotated[UploadFile | None, File()] = None,
):
    try:
        data = NewEvidence(
            case_id=case_id,
            title=title,
            classification=classification,
            location=location,
            description=description,
        )
    except ValidationError:
        raise HTTPException(
            422, "Enter a valid title, classification, description and storage location."
        ) from None
    get_case(db, user, case_id, open_only=True)
    evidence_id = uuid4()
    filename, size, digest, raw = None, None, None, None
    if file is not None:
        if file.size is not None and file.size > FILE_LIMIT:
            raise HTTPException(413, "Files must be 10 MiB or smaller.")
        raw = file.file.read(FILE_LIMIT + 1)
        if len(raw) > FILE_LIMIT:
            raise HTTPException(413, "Files must be 10 MiB or smaller.")
        # Never use supplied filenames as local paths or unquoted response headers.
        leaf = PurePosixPath((file.filename or "").replace("\\", "/")).name
        filename = "".join(ch for ch in leaf if ch.isprintable())[:180] or "evidence.bin"
        size, digest = len(raw), hashlib.sha256(raw).hexdigest()
    db.execute(
        """INSERT INTO evidence(id,code,case_id,title,description,classification,location,custodian_id,
                  integrity,filename,size_bytes,sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            evidence_id,
            next_code(db, "EV"),
            case_id,
            data.title,
            data.description,
            classification,
            data.location,
            user["id"],
            "hashed" if raw is not None else "recorded",
            filename,
            size,
            digest,
        ),
    )
    if raw is not None:
        db.execute("INSERT INTO evidence_files(evidence_id,content) VALUES(?,?)", (evidence_id, raw))
    register_custody(db, evidence_id, None, user["id"], user["id"], data.location, "Initial registration")
    log(db, "evidence.registered", user["id"], case_id, evidence_id)
    return get_evidence(db, user, evidence_id)


@router.get("/{evidence_id}", response_model=outputs.EvidenceDetail)
def evidence_detail(evidence_id: UUID, user: User, db: DB):
    item = get_evidence(db, user, evidence_id)
    log(db, "evidence.viewed", user["id"], item["case_id"], evidence_id)
    item["custody"] = db.execute(
        CUSTODY_SELECT + " WHERE h.evidence_id=? ORDER BY h.created_at DESC,h.rowid DESC", (evidence_id,)
    ).fetchall()
    item["checks"] = db.execute(
        CHECK_SELECT + " WHERE v.evidence_id=? ORDER BY v.created_at DESC,v.rowid DESC", (evidence_id,)
    ).fetchall()
    item["events"] = db.execute(
        EVENT_SELECT + " WHERE a.evidence_id=? ORDER BY a.created_at DESC,a.rowid DESC", (evidence_id,)
    ).fetchall()
    item["relationships"] = db.execute(
        """SELECT r.id,other.id AS target_id,other.code AS target_code,
        other.title AS target_title,CASE WHEN r.kind='derived_from' AND r.target_id=? THEN 'source_of'
        ELSE r.kind END AS kind FROM relationships r JOIN evidence other
        ON other.id=CASE WHEN r.source_id=? THEN r.target_id ELSE r.source_id END
        WHERE r.source_id=? OR r.target_id=? ORDER BY r.created_at,r.rowid""",
        (evidence_id,) * 4,
    ).fetchall()
    return item


@router.post("/{evidence_id}/verify", response_model=outputs.Verification)
def verify(evidence_id: UUID, user: Writer, db: DB):
    item = get_evidence(db, user, evidence_id)
    blob = db.execute("SELECT content FROM evidence_files WHERE evidence_id=?", (evidence_id,)).fetchone()
    if not blob:
        raise HTTPException(409, "There are no stored file bytes to verify.")
    digest = hashlib.sha256(blob["content"]).hexdigest()
    matches = hmac.compare_digest(digest, item["sha256"])
    check = db.execute(
        """INSERT INTO integrity_checks(id,evidence_id,actor_id,digest,matches)
                         VALUES(?,?,?,?,?) RETURNING created_at""",
        (uuid4(), evidence_id, user["id"], digest, matches),
    ).fetchone()
    db.execute(
        "UPDATE evidence SET integrity=?,verified_at=? WHERE id=?",
        ("verified" if matches else "mismatch", check["created_at"], evidence_id),
    )
    log(
        db,
        "evidence.verified" if matches else "evidence.hash_mismatch",
        user["id"],
        item["case_id"],
        evidence_id,
    )
    return {"matches": matches, "sha256": digest, "verified_at": check["created_at"]}


@router.get(
    "/{evidence_id}/download",
    response_class=Response,
    responses={
        200: {"content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}
    },
)
def download(evidence_id: UUID, user: User, db: DB):
    item = get_evidence(db, user, evidence_id)
    blob = db.execute("SELECT content FROM evidence_files WHERE evidence_id=?", (evidence_id,)).fetchone()
    if not blob:
        raise HTTPException(404, "This record has no stored file.")
    log(db, "evidence.downloaded", user["id"], item["case_id"], evidence_id)
    return Response(
        bytes(blob["content"]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(item["filename"], safe="")},
    )


@router.post("/{evidence_id}/custody", response_model=outputs.Success)
def transfer(evidence_id: UUID, data: Transfer, user: Writer, db: DB):
    item = get_evidence(db, user, evidence_id)
    case = get_case(db, user, item["case_id"], open_only=True)
    if user["role"] != "admin" and user["id"] != item["custodian_id"]:
        raise HTTPException(403, "Only the current custodian or an administrator may transfer this item.")
    if data.to_user_id == item["custodian_id"]:
        raise HTTPException(409, "Choose a different custodian.")
    target = db.execute(
        """SELECT u.id FROM users u WHERE u.id=? AND u.active AND
        (u.role='admin' OR u.id=? OR EXISTS(SELECT 1 FROM case_members m WHERE m.case_id=? AND m.user_id=u.id))""",
        (data.to_user_id, case["owner_id"], case["id"]),
    ).fetchone()
    if not target:
        raise HTTPException(422, "Choose an active account with access to this case.")
    register_custody(
        db, evidence_id, item["custodian_id"], target["id"], user["id"], data.location, data.reason
    )
    db.execute(
        "UPDATE evidence SET custodian_id=?,location=?,status='transferred' WHERE id=?",
        (target["id"], data.location, evidence_id),
    )
    log(db, "custody.transferred", user["id"], case["id"], evidence_id)
    return {"ok": True}


@router.post("/{evidence_id}/relationships", response_model=outputs.Success)
def add_relationship(evidence_id: UUID, data: Link, user: Writer, db: DB):
    item = get_evidence(db, user, evidence_id)
    get_case(db, user, item["case_id"], open_only=True)
    if evidence_id == data.target_id:
        raise HTTPException(422, "Choose a different item of evidence.")
    target = get_evidence(db, user, data.target_id)
    if target["case_id"] != item["case_id"]:
        raise HTTPException(422, "Related items must belong to the same case.")
    inserted = db.execute(
        """INSERT INTO relationships(id,case_id,source_id,target_id,kind)
        VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id""",
        (uuid4(), item["case_id"], evidence_id, data.target_id, data.kind),
    ).fetchone()
    if not inserted:
        raise HTTPException(409, "This relationship is already recorded.")
    for related in (evidence_id, data.target_id):
        log(db, "evidence.relationship_added", user["id"], item["case_id"], related)
    return {"ok": True}
