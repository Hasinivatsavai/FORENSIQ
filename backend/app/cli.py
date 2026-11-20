"""One-time administrator provisioning; credentials stay outside the command line."""

import argparse
import getpass
import os

from fastapi import HTTPException
from pydantic import ValidationError

from .accounts import create_account
from .db import connect, log, migrate
from .schemas import NewUser
from .security import hash_password


def require_first_admin(db):
    if db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone():
        raise SystemExit("An administrator already exists. Sign in to manage additional accounts.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("init-admin", "reset-password", "migrate"))
    args = parser.parse_args()
    migrate()
    if args.command == "migrate":
        print("Database migrations are current.")
        return
    if args.command == "init-admin":
        with connect() as db:
            require_first_admin(db)
    email = (os.environ.get("FORENSIQ_ADMIN_EMAIL") or input("Email: ")).strip().lower()
    name = "Account"
    if args.command == "init-admin":
        name = os.environ.get("FORENSIQ_ADMIN_NAME") or input("Full name: ")
    password = os.environ.get("FORENSIQ_ADMIN_PASSWORD") or getpass.getpass(
        "Password (12–128 characters): "
    )
    try:
        account = NewUser(email=email, password=password, name=name, role="admin")
    except ValidationError:
        raise SystemExit(
            "Use a valid email, a name of 1–160 characters, and a password of 12–128 characters."
        ) from None
    with connect() as db:
        if args.command == "init-admin":
            require_first_admin(db)
            try:
                user = create_account(db, account)
            except HTTPException as exc:
                raise SystemExit(exc.detail) from None
            log(db, "user.admin_provisioned", subject_id=user["id"])
        else:
            user = db.execute(
                "UPDATE users SET password_hash=? WHERE email=? RETURNING id",
                (hash_password(password), email),
            ).fetchone()
            if not user:
                raise SystemExit("Account not found.")
            db.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
            log(db, "user.password_reset_by_operator", subject_id=user["id"])
    print("Account operation completed.")


if __name__ == "__main__":
    main()
