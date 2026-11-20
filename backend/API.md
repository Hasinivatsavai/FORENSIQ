# FORENSIQ HTTP API

All routes start with `/api`. Send JSON except for evidence uploads, which use FormData. All JSON objects use snake_case. List routes return a JSON array. Errors use FastAPI's `detail` field. The browser must send credentials on the same origin and add `X-Forensiq-Request: 1` on every POST, PATCH, and PUT, including login. Signed HS256 JWTs use an eight-hour, HttpOnly, SameSite=Strict cookie. SQLite stores a SHA-256 digest per session and persists the signing key during migration. Requests validate signature, issuer, audience, subject, expiry, account status and session revocation. Set the request marker to `1` in the Swagger Authorize dialog to exercise writes. Roles are `admin`, `investigator`, `viewer`. All IDs are UUID strings. Timestamps are ISO 8601 with timezone. Access is case-scoped. Admins see every case. Other users see cases they own or are assigned to. Viewers have read-only access.

## Identity

- `POST /auth/register` accepts `{name,email,password}`. A name can contain 1–160 characters and the password must contain 12–128 characters. Email is trimmed, lowercased and unique. The API rejects client-supplied roles. A successful response returns HTTP 201 with the new User and its authenticated session cookie.
- Registration returns 403 for a rejected browser write, 409 for an existing email, 422 for invalid fields and 429 for too many attempts. Each 15-minute window allows five attempts per email and twenty per peer IP. A limited response includes `Retry-After: 900`. Registration and sign-in use separate counters.
- Hosted registration creates an investigator account. The operator provisions the first administrator with `python -m app.cli init-admin`. The npm launcher enables first-account setup for its loopback API. When the peer address and requested host are both loopback, the first account in an empty local database becomes administrator. A SQLite transaction lock serializes that decision with the operator command. The account, audit entries and new session commit together.
- POST /auth/login with {email,password} → User. GET /auth/me → User or 401. POST /auth/logout → {ok:true}.
- User → {id,name,email,role,active}. GET /users → User[] (admin only). POST /users {name,email,password,role} → User (admin). PATCH /users/{id} {active:boolean} → User (admin). GET /directory → [{id,name,role}] (active accounts, for assigning cases and custody).
- GET /health → {status:"ok"} when SQLite is ready.

## Cases

- GET /cases?q=&status= → Case[]. POST /cases {title,description?,priority?} → Case. Case → {id,code,title,description,priority,status,owner_id,owner_name,created_at}. Priority: low, medium, high, critical. Status: open, in_review, closed.
- GET /cases/{id} → Case plus {members:[{id,name,role}],notes:[{id,body,author_name,created_at}],evidence:Evidence[]}. PATCH /cases/{id} {status} → Case. POST /cases/{id}/members {user_id} → {ok:true} (admin or owner). POST /cases/{id}/notes {body} → note.
- GET /cases/{id}/report → downloadable JSON containing the case, notes, evidence register, checks, custody, relationships and case activity. Access recorded.

## Evidence

- GET /evidence?q=&case_id=&integrity= → Evidence[]. POST /evidence (multipart form): case_id, title, classification, location, optional description, optional file → Evidence. Classification: document, image, video, audio, device, archive, other. File optional for reference-only items. 10 MiB upload limit.
- Evidence → {id,code,case_id,case_code,title,description,classification,location,custodian_id,custodian_name,status,integrity,filename,size_bytes,sha256,created_at,verified_at}. status: registered, transferred. integrity: recorded (no file), hashed (ingest digest), verified, mismatch. Reference-only records have null file fields.
- GET /evidence/{id} → Evidence plus {custody:[{id,from_name,to_name,location,reason,created_at,actor_name}],relationships:[{id,target_id,target_code,target_title,kind}],events:[{id,action,actor_name,created_at}],checks:[{id,digest,matches,actor_name,created_at}]}.
- POST /evidence/{id}/verify (empty body) → {matches,sha256,verified_at}; recalculates actual stored bytes. GET /evidence/{id}/download → attachment. POST /evidence/{id}/custody {to_user_id,location,reason} → {ok:true}. Only current custodian/admin may transfer; recipient must be active and have case access.
- POST /evidence/{id}/relationships {target_id,kind} → {ok:true}. Both evidence items must be in same case; kind: related_to, derived_from, corroborates. Opposite item shows inverse label for derived_from.

## Workspace

- GET /dashboard → {counts:{cases,open_cases,evidence,verified},by_classification:[{label,count}],by_status:[{label,count}],recent_cases:Case[],recent_events:Event[]}. Counts and lists reflect caller's actual records.
- GET /audit?case_id=&q=&limit= → Event[] newest first; default 100, maximum 500. Event → {id,action,actor_name,case_id,case_code,evidence_id,evidence_code,subject_id,subject_name,created_at}. Admins see system/auth activity too.
- GET /docs (at host /api/docs) → interactive OpenAPI. GET /openapi.json (at /api/openapi.json) → API schema.

All evidence and case operations require case visibility. Viewers can download, read and export; verification, transfers, uploads and edits require investigator or admin. Case creation requires investigator/admin. Cases in closed status cannot receive updates, evidence, notes, transfers or relationships until reopened. Verification and report generation remain available for closed cases.

## Backend source map

| Location | Responsibility |
| --- | --- |
| `app/main.py` | ASGI routing, migration startup, request limits, request marker, safe error messages, security headers and Swagger. |
| `app/accounts.py`, `app/security.py` | Self-registration, account administration, registration and sign-in throttling, salted scrypt password hashes, signed HttpOnly JWTs and session revocation. |
| `app/db.py`, `migrations/` | Versioned SQLite schema, per-request transaction, case access predicate, audit recording and database-level custody/file constraints. |
| `app/cases.py` | Case state, assignment, case notes and JSON export. |
| `app/evidence.py` | Transactional file intake, SHA-256 baseline, content re-check, read/download logging, transfers and typed evidence links. |
| `app/workspace.py` | Permission-filtered dashboard aggregates, recent records and audit search. |
| `app/schemas.py`, `app/outputs.py` | Validated mutation input and explicit public response models in OpenAPI. |
| `app/cli.py` | Schema migration, first administrator provisioning and operator password recovery. |
| `tests/test_registration.py`, `tests/test_workflow.py` | SQLite checks for registration, concurrent first launch, authentication, permissions and evidence workflows. |

The API accesses a private SQLite database file on the server. Set `FORENSIQ_DB_PATH` to select its path. Keep the directory outside any public static directory, protect local backups, and grant write access only to the application operator.
