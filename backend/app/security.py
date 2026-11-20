"""Credential verification and signed, revocable session cookies."""

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

import jwt
from fastapi import Depends, HTTPException, Request
from sqlite3 import Connection

from .db import connection

DB = Annotated[Connection, Depends(connection, scope="function")]
USER_FIELDS = "id,name,email,role,active"
COOKIE = "forensiq_session"
SESSION_SECONDS = 8 * 60 * 60


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=1, dklen=32, maxmem=70 * 1024 * 1024)
    return "$".join(("scrypt-v1", base64.b64encode(salt).decode(), base64.b64encode(key).decode()))


def verify_password(password: str, stored: str) -> bool:
    version, salt, encoded = stored.split("$")
    if version != "scrypt-v1":
        return False
    actual = hashlib.scrypt(
        password.encode(), salt=base64.b64decode(salt), n=32768, r=8, p=1, dklen=32, maxmem=70 * 1024 * 1024
    )
    return hmac.compare_digest(actual, base64.b64decode(encoded))


DUMMY_HASH = hash_password(secrets.token_urlsafe(32))


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_session(db, user_id):
    issued = int(datetime.now(timezone.utc).timestamp())
    key = db.execute("SELECT secret FROM session_signing_key WHERE singleton").fetchone()["secret"]
    # Claims carry identifiers and validity; authorization always comes from the current database row.
    claims = {
        "sub": str(user_id),
        "jti": str(uuid4()),
        "iat": issued,
        "exp": issued + SESSION_SECONDS,
        "iss": "forensiq",
        "aud": "forensiq-workspace",
    }
    token = jwt.encode(claims, key, algorithm="HS256")
    db.execute(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
        (digest(token), user_id, claims["exp"]),
    )
    return token


def current_user(request: Request, db: DB):
    token = request.cookies.get(COOKIE, "")
    if not (20 <= len(token) <= 2048):
        raise HTTPException(401, "Sign in to continue.")
    row = db.execute(
        """SELECT u.id,u.name,u.email,u.role,u.active,k.secret FROM sessions s
                       JOIN users u ON u.id=s.user_id CROSS JOIN session_signing_key k
                       WHERE s.token_hash=? AND s.expires_at>unixepoch() AND u.active AND k.singleton""",
        (digest(token),),
    ).fetchone()
    if not row:
        raise HTTPException(401, "Your session has ended. Sign in again.")
    try:
        claims = jwt.decode(
            token,
            row.pop("secret"),
            algorithms=["HS256"],
            issuer="forensiq",
            audience="forensiq-workspace",
            options={"require": ["sub", "jti", "iat", "exp", "iss", "aud"]},
        )
        if claims["sub"] != str(row["id"]):
            raise jwt.InvalidTokenError("Session subject mismatch")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Your session is invalid. Sign in again.") from None
    return row


User = Annotated[dict, Depends(current_user)]


def writer(user: User):
    if user["role"] == "viewer":
        raise HTTPException(403, "This operation requires investigator access.")
    return user


def administrator(user: User):
    if user["role"] != "admin":
        raise HTTPException(403, "This operation requires administrator access.")
    return user


Writer = Annotated[dict, Depends(writer)]
Admin = Annotated[dict, Depends(administrator)]


def secure_cookie():
    return os.environ.get("COOKIE_SECURE", "true").lower() not in ("false", "0", "no")


def consume_attempt(db, key):
    row = db.execute(
        """INSERT INTO login_limits(bucket,attempts,window_start) VALUES(?,1,unixepoch())
        ON CONFLICT(bucket) DO UPDATE SET
          attempts=CASE WHEN login_limits.window_start < unixepoch()-900 THEN 1 ELSE login_limits.attempts+1 END,
          window_start=CASE WHEN login_limits.window_start < unixepoch()-900 THEN unixepoch() ELSE login_limits.window_start END
        RETURNING attempts""",
        (digest(key),),
    ).fetchone()
    return row["attempts"]
