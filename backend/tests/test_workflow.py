"""API checks against a temporary SQLite database."""

import hashlib
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import uuid4

import jwt
import sqlite3
from app.accounts import create_account
from app.db import connect, migrate, next_code
from app.main import app
from app.schemas import NewUser
from app.security import digest
from fastapi.testclient import TestClient


class EvidenceWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        directory = TemporaryDirectory()
        cls.addClassCleanup(directory.cleanup)
        settings = patch.dict(os.environ, {"FORENSIQ_DB_PATH": str(Path(directory.name) / "workflow.sqlite3")})
        settings.start()
        cls.addClassCleanup(settings.stop)
        migrate()
        migrate()  # Startup after a restart must be safe.
        cls.prefix = uuid4().hex[:10]
        cls.password = secrets.token_urlsafe(24)
        cls.headers = {"X-Forensiq-Request": "1"}
        cls.users = {}
        with connect() as db:
            for label, role in (
                ("admin", "admin"),
                ("owner", "investigator"),
                ("other", "investigator"),
                ("reader", "viewer"),
            ):
                email = f"{cls.prefix}-{label}@example.test"
                cls.users[label] = create_account(
                    db, NewUser(name=label, role=role, email=email, password=cls.password)
                )

    def client(self, label=None):
        client = TestClient(app, base_url="https://testserver", headers=self.headers)
        self.addCleanup(client.close)
        if label:
            res = client.post(
                "/api/auth/login", json={"email": self.users[label]["email"], "password": self.password}
            )
            self.assertEqual(res.status_code, 200, res.text)
            self.assertNotIn("password_hash", res.json())
        return client

    def case(self, client, title="Acquisition log"):
        res = client.post("/api/cases", json={"title": title, "priority": "high"})
        self.assertEqual(res.status_code, 201, res.text)
        return res.json()

    def register(self, client, case_id, content=None, name="Sample"):
        payload = {"case_id": case_id, "title": name, "classification": "document", "location": "Vault A"}
        files = {"file": ("source.txt", content, "text/plain")} if content is not None else None
        res = client.post("/api/evidence", data=payload, files=files)
        self.assertEqual(res.status_code, 201, res.text)
        return res.json()

    def test_session_boundaries_and_logout_revocation(self):
        client = self.client()
        body = {"email": self.users["reader"]["email"], "password": self.password}
        self.assertEqual(client.get("/api/auth/me").status_code, 401)
        response = client.post("/api/auth/login", json=body, headers={"X-Forensiq-Request": "0"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            client.post("/api/auth/login", json=body, headers={"Sec-Fetch-Site": "cross-site"}).status_code,
            403,
        )
        self.assertEqual(
            client.post("/api/auth/login", json={**body, "password": "incorrect"}).status_code, 401
        )
        response = client.post("/api/auth/login", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        token = client.cookies.get("forensiq_session")
        self.assertEqual(client.get("/api/auth/me").json()["role"], "viewer")
        self.assertEqual(client.post("/api/auth/logout").status_code, 200)
        self.assertEqual(
            client.get("/api/auth/me", headers={"Cookie": "forensiq_session=" + token}).status_code, 401
        )

    def test_case_members_notes_and_scope(self):
        owner, outsider, reader = self.client("owner"), self.client("other"), self.client("reader")
        case = self.case(owner, f"Scope {uuid4().hex}")
        path = "/api/cases/" + case["id"]
        self.assertEqual(outsider.get(path).status_code, 404)
        self.assertEqual(outsider.get("/api/cases", params={"q": case["title"]}).json(), [])
        self.assertEqual(outsider.get(path + "/report").status_code, 404)
        self.assertEqual(
            owner.post(path + "/members", json={"user_id": str(self.users["reader"]["id"])}).status_code, 200
        )
        self.assertEqual(reader.get(path).status_code, 200)
        self.assertEqual(reader.post(path + "/notes", json={"body": "Denied"}).status_code, 403)
        self.assertEqual(owner.post(path + "/notes", json={"body": "Sealed on receipt."}).status_code, 201)
        self.assertEqual(reader.get(path).json()["notes"][0]["body"], "Sealed on receipt.")
        self.assertEqual(owner.patch(path, json={"status": "closed"}).json()["status"], "closed")
        self.assertEqual(owner.post(path + "/notes", json={"body": "Closed"}).status_code, 409)
        self.assertEqual(owner.patch(path, json={"status": "open"}).json()["status"], "open")
        self.assertEqual(owner.get("/api/cases", params={"q": case["title"], "status": "closed"}).json(), [])

    def test_evidence_lifecycle_and_report(self):
        owner, other = self.client("owner"), self.client("other")
        case = self.case(owner)
        cid = case["id"]
        data = b"Known byte sequence for an educational integration test.\x00"
        digest = hashlib.sha256(data).hexdigest()
        item, ref = (
            self.register(owner, cid, data),
            self.register(owner, cid, name="Original document location"),
        )
        path = "/api/evidence/" + item["id"]
        refpath = "/api/evidence/" + ref["id"]
        self.assertEqual(
            (item["sha256"], item["size_bytes"], item["integrity"]), (digest, len(data), "hashed")
        )
        self.assertEqual(ref["integrity"], "recorded")
        self.assertIsNone(ref["sha256"])
        self.assertEqual(other.get(path + "/download").status_code, 404)
        self.assertEqual(owner.post(refpath + "/verify").status_code, 409)
        verification = owner.post(path + "/verify")
        self.assertEqual(verification.status_code, 200, verification.text)
        self.assertEqual((verification.json()["sha256"], verification.json()["matches"]), (digest, True))
        self.assertEqual(owner.get(path + "/download").content, data)
        self.assertEqual(
            owner.get("/api/evidence", params={"integrity": "verified", "case_id": cid}).json()[0]["id"],
            item["id"],
        )
        xfer = {
            "to_user_id": str(self.users["other"]["id"]),
            "location": "Lab B",
            "reason": "Review assigned",
        }
        self.assertEqual(owner.post(path + "/custody", json=xfer).status_code, 422)
        self.assertEqual(
            owner.post("/api/cases/" + cid + "/members", json={"user_id": xfer["to_user_id"]}).status_code,
            200,
        )
        self.assertEqual(owner.post(path + "/custody", json=xfer).status_code, 200)
        self.assertEqual(owner.post(path + "/custody", json=xfer).status_code, 403)
        self.assertEqual(other.post(path + "/custody", json=xfer).status_code, 409)
        link = {"target_id": ref["id"], "kind": "derived_from"}
        self.assertEqual(owner.post(path + "/relationships", json=link).status_code, 200)
        self.assertEqual(owner.post(path + "/relationships", json=link).status_code, 409)
        self.assertEqual(owner.get(refpath).json()["relationships"][0]["kind"], "source_of")
        details = owner.get(path).json()
        self.assertEqual((len(details["custody"]), details["checks"][0]["digest"]), (2, digest))
        self.assertEqual((details["custodian_name"], details["location"]), ("other", "Lab B"))
        report = owner.get("/api/cases/" + cid + "/report")
        self.assertIn("attachment", report.headers["content-disposition"])
        self.assertEqual(len(report.json()["custody"]), 3)
        self.assertEqual(report.json()["relationships"][0]["kind"], "derived_from")
        self.assertIn("evidence.downloaded", [e["action"] for e in report.json()["activity"]])
        audit = other.get("/api/audit", params={"case_id": cid, "q": "transferred"}).json()
        self.assertEqual(audit[0]["action"], "custody.transferred")
        overview = owner.get("/api/dashboard").json()
        self.assertGreaterEqual(overview["counts"]["verified"], 1)
        self.assertTrue(any(r["label"] == "document" for r in overview["by_classification"]))

    def test_signed_claims_and_revocation(self):
        reader = self.client("reader")
        original = reader.cookies.get("forensiq_session")
        self.assertEqual(jwt.get_unverified_header(original)["alg"], "HS256")
        now = int(datetime.now(timezone.utc).timestamp())
        with connect() as db:
            key = db.execute("SELECT secret FROM session_signing_key WHERE singleton").fetchone()[
                "secret"
            ]
            claims = jwt.decode(
                original, key, algorithms=["HS256"], audience="forensiq-workspace", issuer="forensiq"
            )
            invalid = [
                jwt.encode({**claims, "iat": now - 120, "exp": now - 60}, key, algorithm="HS256"),
                jwt.encode({**claims, "sub": str(self.users["admin"]["id"])}, key, algorithm="HS256"),
                jwt.encode({**claims, "aud": "another-app"}, key, algorithm="HS256"),
                jwt.encode(claims, secrets.token_urlsafe(64), algorithm="HS256"),
            ]
            # Register these controlled fixtures so the signature/claims check is independently tested.
            for bad in invalid:
                db.execute(
                    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)",
                    (digest(bad), self.users["reader"]["id"]),
                )
        for bad in invalid:
            self.assertEqual(
                reader.get("/api/auth/me", headers={"Cookie": "forensiq_session=" + bad}).status_code, 401
            )
        self.assertEqual(reader.get("/api/auth/me").status_code, 200)

    def test_baseline_mismatch_is_recorded(self):
        owner = self.client("owner")
        case = self.case(owner)
        item = uuid4()
        # A deliberately inconsistent test fixture exercises the discrepancy path.
        with connect() as db:
            db.execute(
                """INSERT INTO evidence(id,code,case_id,title,classification,location,custodian_id,
                integrity,filename,size_bytes,sha256) VALUES(?,?,?,'Mismatch fixture','other','Lab',?,
                'hashed','fixture.dat',1,?)""",
                (item, next_code(db, "EV"), case["id"], self.users["owner"]["id"], "0" * 64),
            )
            db.execute("INSERT INTO evidence_files(evidence_id,content) VALUES(?,?)", (item, b"x"))
        path = "/api/evidence/" + str(item)
        self.assertFalse(owner.post(path + "/verify").json()["matches"])
        detail = owner.get(path).json()
        self.assertEqual(detail["integrity"], "mismatch")
        self.assertEqual(detail["checks"][0]["digest"], hashlib.sha256(b"x").hexdigest())
        with self.assertRaises(sqlite3.IntegrityError), connect() as db:
            db.execute(
                "UPDATE evidence SET sha256=? WHERE id=?", (detail["checks"][0]["digest"], item)
            )

    def test_concurrent_custody_attempts(self):
        owner = self.client("owner")
        case = self.case(owner)
        item = self.register(owner, case["id"])
        recipient = str(self.users["other"]["id"])
        owner.post("/api/cases/" + case["id"] + "/members", json={"user_id": recipient}).raise_for_status()
        path = "/api/evidence/" + item["id"]

        def transfer(_):
            return owner.post(
                path + "/custody", json={"to_user_id": recipient, "location": "Lab", "reason": "Review"}
            ).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(transfer, range(2)))
        self.assertEqual(statuses, [200, 403])
        self.assertEqual(len(owner.get(path).json()["custody"]), 2)

    def test_account_management_and_session_termination(self):
        admin, owner = self.client("admin"), self.client("owner")
        self.assertEqual(owner.get("/api/users").status_code, 403)
        address = f"{uuid4().hex}@example.test"
        payload = {"name": "Analyst", "role": "investigator", "email": address, "password": self.password}
        result = admin.post("/api/users", json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(admin.post("/api/users", json=payload).status_code, 409)
        analyst = self.client()
        self.assertEqual(
            analyst.post("/api/auth/login", json={"email": address, "password": self.password}).status_code,
            200,
        )
        self.assertEqual(
            admin.patch("/api/users/" + result.json()["id"], json={"active": False}).status_code, 200
        )
        self.assertEqual(analyst.get("/api/auth/me").status_code, 401)
        self.assertEqual(
            admin.patch("/api/users/" + str(self.users["admin"]["id"]), json={"active": False}).status_code,
            409,
        )
        self.assertEqual(len(owner.get("/api/directory").json()[0]), 3)

    def test_file_limits_and_database_constraints(self):
        owner = self.client("owner")
        cid = self.case(owner)["id"]
        data = {"title": "Media", "case_id": cid, "classification": "archive", "location": "Vault"}
        res = owner.post(
            "/api/evidence", data=data, files={"file": ("large.bin", b"a" * (10 * 1024 * 1024 + 1))}
        )
        self.assertEqual(res.status_code, 413, res.text)
        self.assertEqual(owner.get("/api/evidence", params={"case_id": cid}).json(), [])
        item = self.register(owner, cid, b"", name="Empty file")
        self.assertEqual(item["size_bytes"], 0)
        self.assertEqual(owner.post("/api/evidence/" + item["id"] + "/verify").json()["matches"], True)
        with self.assertRaises(sqlite3.IntegrityError), connect() as db:
            db.execute("UPDATE custody SET reason='change' WHERE evidence_id=?", (item["id"],))
        self.assertEqual(owner.post("/api/cases", json={"title": "   "}).status_code, 422)

    def test_login_throttling(self):
        client = self.client()
        payload = {"email": f"{uuid4().hex}@example.test", "password": "Incorrect value"}
        for _ in range(12):
            self.assertEqual(client.post("/api/auth/login", json=payload).status_code, 401)
        limited = client.post("/api/auth/login", json=payload)
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.headers["retry-after"], "900")


if __name__ == "__main__":
    unittest.main()
