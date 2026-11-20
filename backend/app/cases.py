from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from . import outputs
from .db import (
    CASE_SELECT,
    EVENT_SELECT,
    EVIDENCE_SELECT,
    VISIBLE,
    case_notes,
    case_users,
    get_case,
    log,
    next_code,
    visibility,
)
from .evidence import CHECK_SELECT, CUSTODY_SELECT
from .schemas import NewCase, NewMember, NewNote, SetStatus, Status
from .security import DB, User, Writer

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("", response_model=list[outputs.Case])
def cases(
    user: User,
    db: DB,
    q: str = Query("", max_length=160, pattern=r"^[^\x00]*$"),
    status: Status | None = None,
):
    sql, args = CASE_SELECT + " WHERE " + VISIBLE, list(visibility(user))
    if q.strip():
        sql += " AND instr(casefold(c.title || ' ' || c.code || ' ' || c.description), ?) > 0"
        args.append(q.strip().casefold())
    if status:
        sql += " AND c.status=?"
        args.append(status)
    return db.execute(sql + " ORDER BY c.created_at DESC,c.rowid DESC", args).fetchall()


@router.post("", status_code=201, response_model=outputs.Case)
def create_case(data: NewCase, user: Writer, db: DB):
    key = uuid4()
    db.execute(
        """INSERT INTO cases(id,code,title,description,priority,owner_id) VALUES(?,?,?,?,?,?)""",
        (key, next_code(db, "CS"), data.title, data.description, data.priority, user["id"]),
    )
    log(db, "case.created", user["id"], key)
    return get_case(db, user, key)


def case_detail(db, case):
    key = case["id"]
    return {
        **case,
        "members": case_users(db, key),
        "notes": case_notes(db, key),
        "evidence": db.execute(
            EVIDENCE_SELECT + " WHERE e.case_id=? ORDER BY e.created_at DESC,e.rowid DESC", (key,)
        ).fetchall(),
    }


@router.get("/{case_id}", response_model=outputs.CaseDetail)
def detail(case_id: UUID, user: User, db: DB):
    case = get_case(db, user, case_id)
    log(db, "case.viewed", user["id"], case_id)
    return case_detail(db, case)


@router.patch("/{case_id}", response_model=outputs.Case)
def change_status(case_id: UUID, data: SetStatus, user: Writer, db: DB):
    case = get_case(db, user, case_id)
    if case["status"] != data.status:
        db.execute("UPDATE cases SET status=? WHERE id=?", (data.status, case_id))
        log(db, "case.status." + data.status, user["id"], case_id)
    return get_case(db, user, case_id)


@router.post("/{case_id}/members", response_model=outputs.Success)
def add_member(case_id: UUID, data: NewMember, user: Writer, db: DB):
    case = get_case(db, user, case_id, open_only=True)
    if user["id"] != case["owner_id"] and user["role"] != "admin":
        raise HTTPException(403, "Only the case owner or an administrator can assign members.")
    active = db.execute("SELECT id FROM users WHERE active AND id=?", (data.user_id,)).fetchone()
    if not active:
        raise HTTPException(422, "Choose an active account.")
    if active["id"] == case["owner_id"]:
        return {"ok": True}
    inserted = db.execute(
        """INSERT INTO case_members(case_id,user_id) VALUES(?,?)
                         ON CONFLICT DO NOTHING RETURNING user_id""",
        (case_id, data.user_id),
    ).fetchone()
    if inserted:
        log(db, "case.member_added", user["id"], case_id, subject_id=data.user_id)
    return {"ok": True}


@router.post("/{case_id}/notes", status_code=201, response_model=outputs.Note)
def add_note(case_id: UUID, data: NewNote, user: Writer, db: DB):
    get_case(db, user, case_id, open_only=True)
    row = db.execute(
        "INSERT INTO notes(id,case_id,author_id,body) VALUES(?,?,?,?) RETURNING id,body,created_at",
        (uuid4(), case_id, user["id"], data.body),
    ).fetchone()
    log(db, "case.note_added", user["id"], case_id)
    return {**row, "author_name": user["name"]}


@router.get("/{case_id}/report", response_model=outputs.CaseReport)
def report(case_id: UUID, user: User, db: DB):
    case = get_case(db, user, case_id)
    log(db, "case.report_exported", user["id"], case_id)
    payload = case_detail(db, case)
    payload["custody"] = db.execute(
        CUSTODY_SELECT
        + """ JOIN evidence e ON h.evidence_id=e.id
        WHERE e.case_id=? ORDER BY h.created_at,h.rowid""",
        (case_id,),
    ).fetchall()
    payload["integrity_checks"] = db.execute(
        CHECK_SELECT
        + """ JOIN evidence e ON v.evidence_id=e.id
        WHERE e.case_id=? ORDER BY v.created_at,v.rowid""",
        (case_id,),
    ).fetchall()
    payload["relationships"] = db.execute(
        "SELECT * FROM relationships WHERE case_id=? ORDER BY created_at,rowid", (case_id,)
    ).fetchall()
    payload["activity"] = db.execute(
        EVENT_SELECT + " WHERE a.case_id=? ORDER BY a.created_at,a.rowid", (case_id,)
    ).fetchall()
    payload["exported_at"] = db.execute("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS t").fetchone()["t"]
    payload["exported_by"] = user["name"]
    return JSONResponse(
        jsonable_encoder(payload),
        headers={"Content-Disposition": f'attachment; filename="{case["code"]}-report.json"'},
    )
