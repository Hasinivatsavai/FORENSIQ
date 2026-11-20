from uuid import UUID

from fastapi import APIRouter, Query

from . import outputs
from .db import CASE_SELECT, EVENT_SELECT, VISIBLE, get_case, visibility
from .security import DB, User

router = APIRouter(tags=["Workspace"])


def recent_events(db, user, *, case_id=None, q="", limit=100):
    # c is null on system events, so only an administrator can see those entries.
    sql, args = EVENT_SELECT + " WHERE " + VISIBLE, list(visibility(user))
    if case_id:
        sql += " AND a.case_id=?"
        args.append(case_id)
    if q.strip():
        sql += """ AND instr(casefold(a.action || coalesce(' ' || u.name,'') ||
            coalesce(' ' || subject.name,'') || coalesce(' ' || c.code,'') ||
            coalesce(' ' || e.code,'')), ?) > 0"""
        args.append(q.strip().casefold())
    return db.execute(sql + " ORDER BY a.created_at DESC,a.rowid DESC LIMIT ?", (*args, limit)).fetchall()


@router.get("/dashboard", response_model=outputs.Dashboard)
def dashboard(user: User, db: DB):
    args = visibility(user)
    visible_evidence = " FROM evidence e JOIN cases c ON e.case_id=c.id WHERE " + VISIBLE
    counts = db.execute(
        """SELECT count(*) AS cases,count(*) FILTER(WHERE c.status='open') AS open_cases
                        FROM cases c WHERE """
        + VISIBLE,
        args,
    ).fetchone()
    counts.update(
        db.execute(
            "SELECT count(*) AS evidence,count(*) FILTER(WHERE e.integrity='verified') AS verified"
            + visible_evidence,
            args,
        ).fetchone()
    )
    return {
        "counts": counts,
        "by_classification": db.execute(
            "SELECT e.classification AS label,count(*) AS count"
            + visible_evidence
            + " GROUP BY e.classification ORDER BY count DESC,label",
            args,
        ).fetchall(),
        "by_status": db.execute(
            "SELECT c.status AS label,count(*) AS count FROM cases c WHERE "
            + VISIBLE
            + " GROUP BY c.status ORDER BY count DESC,label",
            args,
        ).fetchall(),
        "recent_cases": db.execute(
            CASE_SELECT + " WHERE " + VISIBLE + " ORDER BY c.created_at DESC,c.rowid DESC LIMIT 6", args
        ).fetchall(),
        "recent_events": recent_events(db, user, limit=8),
    }


@router.get("/audit", response_model=list[outputs.Event])
def audit(
    user: User,
    db: DB,
    q: str = Query("", max_length=160, pattern=r"^[^\x00]*$"),
    case_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    if case_id:
        get_case(db, user, case_id)
    return recent_events(db, user, case_id=case_id, q=q, limit=limit)
