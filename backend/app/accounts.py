import os
from ipaddress import ip_address
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from . import outputs
from .db import log
from .schemas import Login, NewUser, Registration, SetActive
from .security import (
    COOKIE,
    DB,
    DUMMY_HASH,
    SESSION_SECONDS,
    USER_FIELDS,
    Admin,
    User,
    consume_attempt,
    digest,
    hash_password,
    new_session,
    secure_cookie,
    verify_password,
)

router = APIRouter(tags=["Identity and accounts"])


def local_bootstrap_allowed(request: Request):
    if os.environ.get("FORENSIQ_LOCAL_BOOTSTRAP") != "1" or not request.client:
        return False
    # The npm launcher binds both servers to loopback and disables Uvicorn proxy headers.
    try:
        hostname = request.url.hostname
        return ip_address(request.client.host).is_loopback and (
            hostname == "localhost" or ip_address(hostname).is_loopback
        )
    except ValueError:
        return False


def clear_expired_auth_state(db):
    db.execute("DELETE FROM login_limits WHERE window_start < unixepoch() - 86400")
    db.execute("DELETE FROM sessions WHERE expires_at < unixepoch()")


def begin_session(db, request, response, user_id):
    previous = request.cookies.get(COOKIE)
    if previous:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (digest(previous),))
    token = new_session(db, user_id)
    log(db, "auth.signed_in", user_id)
    response.set_cookie(
        COOKIE,
        token,
        max_age=SESSION_SECONDS,
        secure=secure_cookie(),
        httponly=True,
        samesite="strict",
        path="/",
    )


@router.post(
    "/auth/register",
    status_code=201,
    response_model=outputs.Account,
    responses={
        403: {"description": "The request did not pass the same-origin write check."},
        409: {"description": "The email address already belongs to an account."},
        429: {"description": "Registration attempt limit reached. See Retry-After."},
    },
)
def register(data: Registration, request: Request, response: Response, db: DB):
    """Create an account and immediately issue a signed-in session."""
    peer = request.client.host if request.client else "unknown"
    clear_expired_auth_state(db)
    if (
        consume_attempt(db, "register-ip:" + peer) > 20
        or consume_attempt(db, "register-email:" + data.email) > 5
    ):
        return JSONResponse(
            {"detail": "Too many account creation attempts. Try again in 15 minutes."},
            status_code=429,
            headers={"Retry-After": "900"},
        )
    # The write transaction reserves the first-account decision before any reads.
    role = "investigator"
    if local_bootstrap_allowed(request) and not db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        role = "admin"
    row = insert_account(db, data, role)
    if not row:
        # Return normally so the rate-limit counters survive the rejected attempt.
        return JSONResponse({"detail": "An account already uses that email. Sign in to continue."}, 409)
    log(db, "user.self_registered", row["id"], subject_id=row["id"])
    begin_session(db, request, response, row["id"])
    return row


@router.post("/auth/login", response_model=outputs.Account)
def login(data: Login, request: Request, response: Response, db: DB):
    # Trust only the peer supplied by the ASGI server. Configure trusted proxies explicitly in deployment.
    peer = request.client.host if request.client else "unknown"
    clear_expired_auth_state(db)
    if consume_attempt(db, "ip:" + peer) > 100 or consume_attempt(db, "email:" + data.email) > 12:
        return JSONResponse(
            {"detail": "Too many sign-in attempts. Try again in 15 minutes."},
            status_code=429,
            headers={"Retry-After": "900"},
        )
    row = db.execute(
        "SELECT " + USER_FIELDS + ",password_hash FROM users WHERE email=?", (data.email,)
    ).fetchone()
    valid = verify_password(data.password, row["password_hash"] if row else DUMMY_HASH)
    if not row or not row["active"] or not valid:
        log(db, "auth.login_failed", row["id"] if row else None)
        return JSONResponse({"detail": "Email or password is incorrect."}, status_code=401)
    db.execute("DELETE FROM login_limits WHERE bucket=?", (digest("email:" + data.email),))
    begin_session(db, request, response, row["id"])
    return {k: v for k, v in row.items() if k != "password_hash"}


@router.get("/auth/me", response_model=outputs.Account)
def me(user: User):
    return user


@router.post("/auth/logout", response_model=outputs.Success)
def logout(request: Request, response: Response, db: DB):
    token = request.cookies.get(COOKIE)
    if token:
        row = db.execute(
            "DELETE FROM sessions WHERE token_hash=? RETURNING user_id", (digest(token),)
        ).fetchone()
        if row:
            log(db, "auth.signed_out", row["user_id"])
    response.delete_cookie(COOKIE, path="/", secure=secure_cookie(), httponly=True, samesite="strict")
    return {"ok": True}


@router.get("/directory", response_model=list[outputs.DirectoryEntry])
def directory(user: User, db: DB):
    return db.execute("SELECT id,name,role FROM users WHERE active ORDER BY name,id").fetchall()


@router.get("/users", response_model=list[outputs.Account])
def users(admin: Admin, db: DB):
    return db.execute("SELECT " + USER_FIELDS + " FROM users ORDER BY name,id").fetchall()


def insert_account(db, data, role):
    return db.execute(
        """INSERT INTO users(id,email,name,role,password_hash) VALUES(?,?,?,?,?)
         ON CONFLICT(email) DO NOTHING RETURNING """
        + USER_FIELDS,
        (uuid4(), data.email, data.name, role, hash_password(data.password)),
    ).fetchone()


def create_account(db, data: NewUser):
    row = insert_account(db, data, data.role)
    if not row:
        raise HTTPException(409, "An account already uses that email.")
    return row


@router.post("/users", status_code=201, response_model=outputs.Account)
def add_user(data: NewUser, admin: Admin, db: DB):
    row = create_account(db, data)
    log(db, "user.created", admin["id"], subject_id=row["id"])
    return row


@router.patch("/users/{user_id}", response_model=outputs.Account)
def set_active(user_id: UUID, data: SetActive, admin: Admin, db: DB):
    if user_id == admin["id"] and not data.active:
        raise HTTPException(409, "You cannot deactivate your own account.")
    row = db.execute("SELECT " + USER_FIELDS + " FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Account not found.")
    if row["active"] == data.active:
        return row
    if not data.active and row["role"] == "admin":
        others = db.execute(
            "SELECT count(*) AS n FROM users WHERE active AND role='admin' AND id<>?", (user_id,)
        ).fetchone()
        if not others["n"]:
            raise HTTPException(409, "Keep at least one active administrator.")
    row = db.execute(
        "UPDATE users SET active=? WHERE id=? RETURNING " + USER_FIELDS, (data.active, user_id)
    ).fetchone()
    if not data.active:
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
    action = "user.activated" if data.active else "user.deactivated"
    log(db, action, admin["id"], subject_id=user_id)
    return row
