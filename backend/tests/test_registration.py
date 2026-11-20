"""Exercise the entry-screen contract against an isolated SQLite database per test."""

import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from pathlib import Path
from threading import Barrier
from unittest.mock import patch
from tempfile import TemporaryDirectory

from app.db import connect, migrate
from app.main import app
from app.security import COOKIE, digest
from fastapi.testclient import TestClient

REGISTER = "/api/auth/register"
ME = "/api/auth/me"
PASSWORD = "correct test passphrase"


def signup(client, email="analyst@example.test", **fields):
    return client.post(REGISTER, json={"name": "Analyst", "email": email, "password": PASSWORD, **fields})


class RegistrationFlow(unittest.TestCase):
    def setUp(self):
        contexts = ExitStack()
        self.addCleanup(contexts.close)
        directory = contexts.enter_context(TemporaryDirectory())
        contexts.enter_context(patch.dict(os.environ, {
            "FORENSIQ_DB_PATH": str(Path(directory) / "registration.sqlite3"),
            "FORENSIQ_LOCAL_BOOTSTRAP": "0", "COOKIE_SECURE": "true",
        }))
        migrate()

    def client(self, *, peer="127.0.0.1", hostname="127.0.0.1", **kwargs):
        client = TestClient(
            app, client=(peer, 12345), base_url="https://" + hostname,
            headers={"X-Forensiq-Request": "1"}, **kwargs,
        )
        self.addCleanup(client.close)
        return client

    def test_concurrent_first_local_accounts_choose_one_admin(self):
        os.environ["FORENSIQ_LOCAL_BOOTSTRAP"] = "1"
        clients = [self.client(peer="127.0.0.1"), self.client(peer="127.0.0.2")]
        start = Barrier(2)

        def register_at_once(index):
            start.wait(timeout=10)
            return signup(clients[index], f"user{index}@example.test")

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(register_at_once, range(2)))
        self.assertEqual([response.status_code for response in responses], [201, 201])
        self.assertCountEqual([response.json()["role"] for response in responses], ["admin", "investigator"])
        for client, response in zip(clients, responses):
            self.assertEqual(client.get(ME).json(), response.json())

    def test_hosted_accounts_and_existing_user_without_admin(self):
        member = self.client()
        self.assertEqual(signup(member).json()["role"], "investigator")
        os.environ["FORENSIQ_LOCAL_BOOTSTRAP"] = "1"
        self.assertEqual(signup(self.client(), "next@example.test").json()["role"], "investigator")
        self.assertEqual(member.get("/api/users").status_code, 403)

    def test_external_peer_cannot_claim_bootstrap(self):
        os.environ["FORENSIQ_LOCAL_BOOTSTRAP"] = "1"
        client = self.client(peer="192.0.2.1", hostname="localhost")
        client.headers["X-Forwarded-For"] = "127.0.0.1"
        self.assertEqual(signup(client).json()["role"], "investigator")

    def test_external_host_cannot_claim_bootstrap(self):
        os.environ["FORENSIQ_LOCAL_BOOTSTRAP"] = "1"
        client = self.client(hostname="example.test")
        client.headers["X-Forwarded-Host"] = "localhost"
        self.assertEqual(signup(client).json()["role"], "investigator")

    def test_failed_first_signup_leaves_bootstrap_available(self):
        os.environ["FORENSIQ_LOCAL_BOOTSTRAP"] = "1"
        client = self.client(hostname="localhost", raise_server_exceptions=False)
        with patch("app.accounts.new_session", side_effect=RuntimeError("simulated failure")):
            self.assertEqual(signup(client).status_code, 500)
        self.assertEqual(client.get(ME).status_code, 401)
        retry = signup(client)
        self.assertEqual(retry.status_code, 201)
        self.assertEqual(retry.json()["role"], "admin")

    def test_role_injection_bad_input_and_browser_write_boundary(self):
        client = self.client()
        for key, value in [("role", "admin"), ("password", "short"), ("name", " "), ("email", "invalid")]:
            with self.subTest(field=key):
                result = signup(client, **{key: value})
                self.assertEqual(result.status_code, 422)
                self.assertNotIn(PASSWORD, result.text)
        data = {"name": "Analyst", "email": "analyst@example.test", "password": PASSWORD}
        client.headers.pop("X-Forensiq-Request")
        self.assertEqual(client.post(REGISTER, json=data).status_code, 403)
        client.headers.update({"X-Forensiq-Request": "1", "Sec-Fetch-Site": "cross-site"})
        self.assertEqual(client.post(REGISTER, json=data).status_code, 403)
        self.assertEqual(client.get(ME).status_code, 401)

    def test_immediate_session_and_returning_investigator_after_logout(self):
        user, outsider = self.client(), self.client()
        response = signup(user, "  ANALYST@EXAMPLE.TEST  ", name="  M. Rao ")
        self.assertEqual(response.status_code, 201, response.text)
        account = response.json()
        self.assertEqual(set(account), {"id", "name", "email", "role", "active"})
        self.assertEqual((account["name"], account["email"]), ("M. Rao", "analyst@example.test"))
        for flag in ["HttpOnly", "SameSite=strict", "Secure", "Max-Age=28800"]:
            self.assertIn(flag, response.headers["set-cookie"])
        token = user.cookies.get(COOKIE)
        self.assertEqual(user.get(ME).json(), account)
        case = user.post("/api/cases", json={"title": "Original case"}).json()
        other_account = signup(outsider, "other@example.test").json()
        self.assertEqual(outsider.get("/api/cases").json(), [])
        self.assertEqual(outsider.get("/api/dashboard").json()["counts"]["cases"], 0)
        self.assertEqual(outsider.get("/api/cases/" + case["id"]).status_code, 404)
        self.assertEqual(outsider.get("/api/audit").json(), [])
        assigned = user.post("/api/cases/" + case["id"] + "/members", json={"user_id": other_account["id"]})
        self.assertEqual(assigned.status_code, 200)
        self.assertEqual(outsider.get("/api/cases/" + case["id"]).status_code, 200)
        self.assertEqual(user.post("/api/auth/logout").status_code, 200)
        self.assertEqual(user.get(ME, headers={"Cookie": f"{COOKIE}={token}"}).status_code, 401)
        returning = self.client()
        login = returning.post("/api/auth/login", json={"email": account["email"], "password": PASSWORD})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json(), account)
        self.assertEqual(returning.get("/api/cases/" + case["id"]).json()["owner_id"], account["id"])

    def test_duplicate_normalized_email_preserves_session_and_is_throttled(self):
        client = self.client()
        original = signup(client).json()
        old_token = client.cookies.get(COOKIE)
        for attempt in range(4):
            with self.subTest(attempt=attempt):
                self.assertEqual(signup(client, "ANALYST@example.test").status_code, 409)
        limited = signup(client)
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.headers["Retry-After"], "900")
        self.assertEqual(client.cookies.get(COOKIE), old_token)
        self.assertEqual(client.get(ME).json(), original)
        self.assertEqual(signup(client, "second@example.test").status_code, 201)
        self.assertEqual(client.get(ME, headers={"Cookie": f"{COOKIE}={old_token}"}).status_code, 401)

    def test_session_creation_failure_rolls_back_account_audit_and_previous_session(self):
        client = self.client(raise_server_exceptions=False)
        original = signup(client).json()
        with patch("app.accounts.new_session", side_effect=RuntimeError("simulated failure")):
            self.assertEqual(signup(client, "retry@example.test").status_code, 500)
        self.assertEqual(client.get(ME).json(), original)
        with connect() as db:
            self.assertEqual(db.execute("SELECT count(*) AS n FROM users").fetchone()["n"], 1)
            self.assertEqual(db.execute("SELECT count(*) AS n FROM audit").fetchone()["n"], 2)
        self.assertEqual(signup(client, "retry@example.test").status_code, 201)

    def test_peer_limit_prevents_new_accounts_until_window_expires(self):
        client = self.client()
        with connect() as db:
            db.execute("INSERT INTO login_limits VALUES (?,20,unixepoch())", (digest("register-ip:127.0.0.1"),))
        self.assertEqual(signup(client).status_code, 429)
        with connect() as db:
            db.execute("UPDATE login_limits SET window_start=unixepoch()-960")
        self.assertEqual(signup(client).status_code, 201)
