# FORENSIQ backend

The FastAPI service stores case metadata, file bytes, custody, audit events, users and session state in a private SQLite file. From the complete project folder, run `npm ci` and `npm run dev` to start the local website and API with SQLite. Choose **Create account** on the welcome screen, or sign in with your existing email and password. The first account on an empty local installation becomes the administrator. Later signups can create cases and work on cases assigned to them. Account and case records persist across restarts.

## Run the API on its own

From this directory, create a virtual environment with Python 3.12 (the container uses this version). Install the service dependencies.

```sh
python -m venv .venv
# macOS or Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Set `FORENSIQ_DB_PATH` to the full file path of a private SQLite database if you want to override the default per-user file. Set `COOKIE_SECURE=false` for a local HTTP-only test. The service creates its SQLite schema at startup. Then run:

```sh
python -m app.cli init-admin
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/api/docs` for Swagger or run the React frontend with its development proxy. A backend-only Dockerfile also ships in this folder.

## Operator commands

| Command | Effect |
| --- | --- |
| `python -m app.cli migrate` | Applies outstanding versioned SQL migrations. Safe to rerun. |
| `python -m app.cli init-admin` | Provisions the administrator for a hosted or standalone API and prompts for credentials. Hosted public registration always creates an investigator. |
| `python -m app.cli reset-password` | Updates an existing user's password and revokes their earlier sessions. |
| `python -m unittest discover -s tests -v` | Runs real database checks. First install `requirements-test.txt`. The tests create their own temporary SQLite files. |

For a hosted deployment, run `init-admin` before opening registration to users so the operator can reserve the administrator email address. Public registration accepts a name, email and a password of 12–128 characters. The API checks email format and uniqueness and immediately activates the account. Registration does not verify inbox ownership.

## Module map

| Path | Responsibility |
| --- | --- |
| `app/main.py` | FastAPI application, startup migrations, middleware, OpenAPI and health endpoint |
| `app/security.py`, `app/accounts.py`, `app/cli.py` | Password hashing, JWT validation, revocation, roles, account administration and provisioning |
| `app/db.py` | Connection and transaction scopes, per-user file location, migration sequencing and visibility queries |
| `app/cases.py` | Cases, assignment, notes, state changes and consistent case-report snapshots |
| `app/evidence.py` | Registration, storage, downloads, rehashing, custody transfers and cross-record links |
| `app/workspace.py` | Access-scoped analytics and audit search |
| `app/schemas.py`, `app/outputs.py` | Input validation and public response models |
| `migrations/` | SQL schema, private signing credentials, indexes, constraints and immutable-history enforcement |
| `tests/` | Database-backed workflow and permission tests |

Read `API.md` for all routes, request parameters, response fields and operational assumptions.
