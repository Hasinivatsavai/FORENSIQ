# FORENSIQ

**Digital Forensics Evidence Management System · Product 50**

FORENSIQ follows an item from registration in a case to a documented handoff, a fresh integrity check, and a case report. The React interface, FastAPI API and SQLite schema are included. The opening screen pairs an interactive thumbprint from the supplied reference with **Sign in** and **Create account**. The light palette pairs periwinkle and lilac with a mint specimen plate. The theme control switches to midnight blue with phosphor-green ridges.

## Start the website

Install 64-bit Node.js 22.12 or newer with npm. Extract the entire ZIP into a **new folder**. Open a terminal in the folder containing this README and the top-level `package.json`.

```sh
npm ci
npm run dev
```

Open the **Local** URL printed in the terminal, usually **http://127.0.0.1:5173/**. The first run needs internet access to install the frontend packages and prepare the private Python runtime for FastAPI. SQLite is built into that runtime. The launcher starts the API and React together and creates the database automatically. Use **Ctrl+C** to stop. On subsequent visits, run `npm run dev` in the same folder.

Choose **Create account** on your first visit. The first account on an empty local installation becomes administrator. Later accounts receive investigator access. Both account creation and sign-in are on the opening screen.

## Your database

Accounts, cases, uploaded evidence bytes, integrity checks, custody records and audit history are saved in `forensiq.sqlite3` outside the source folder. The launcher prints the location. Windows defaults to `%LOCALAPPDATA%\FORENSIQ\local\forensiq.sqlite3`, macOS to `~/Library/Application Support/FORENSIQ/local/forensiq.sqlite3`, and Linux to `$XDG_DATA_HOME/FORENSIQ/local/forensiq.sqlite3` (normally `~/.local/share/FORENSIQ/local/forensiq.sqlite3`). SQLite can also maintain journal files in this directory.

This edition starts with an empty SQLite database on first use. It leaves any previous PostgreSQL data in place and does not import those accounts or cases. Give the database directory the same access protection as the evidence it contains. For an offline backup, shut down FORENSIQ and copy the database along with any adjacent `-wal` and `-shm` files. Restore while the app is stopped.

## Use the workspace

| Task | Where to go |
| --- | --- |
| Start an investigation | **Case files → Create case**. Set a priority, describe the investigation and add dated notes. |
| Give someone case access | They choose **Create account** on the opening screen, or an administrator provisions their account in **Team directory**. The case owner or an administrator then assigns them on the case page. |
| Register evidence | Open the case, select **Register evidence**, then attach a file or record an external storage reference. Each item receives its own evidence code. |
| Verify file integrity | Open the evidence and choose **Verify stored file**. The server reads the stored bytes, recomputes SHA-256 and records the result and time. |
| Record custody | Choose **Transfer**. Select an active recipient with access to the case, document the destination and give a reason. |
| Relate two items | Open **Linked evidence → Add link** and choose another item from the same case. Direction is preserved for a derivation. |
| Review activity | Open **Audit trail** or the evidence detail. The overview counts and distributions follow the signed-in user's case access. |
| Produce a dossier | Open **Case reports**, select a case and open the printable dossier or export its JSON snapshot. Both use the server's case report. |

**Evidence handling.** Attached files are limited to **10 MiB each**. Larger artifacts such as disk images can be registered with an external storage reference. An intake hash records the attached bytes. A later verification compares them to that baseline. A custody entry records a person's documented handoff. The app reports these as distinct facts.

**Access.** Administrators manage users and have access to all cases. Investigators create cases and work on cases they own or are assigned. Viewers can read and export assigned cases. The active custodian or an administrator records a transfer. Closing a case restricts changes while keeping its files and reports available. The illustration on the sign-in page is a visual study. Authentication uses the account credentials.

## Optional deployment

The root Dockerfile serves the compiled React site and the API from one origin. The included Compose setup stores the database on a named volume. To run the production build locally with Docker, use `docker compose up --build -d` and open **http://localhost:8080**. The default two-command npm setup above works independently.

To host the app, run one service instance with a writable, persistent local disk and set `FORENSIQ_DB_PATH` to its database file. Mount the whole data directory so SQLite can write its journals. Serve the public site over HTTPS and set `COOKIE_SECURE=true`. Run `python -m app.cli init-admin` in the container to provision a hosted administrator. The optional Render Blueprint uses a paid web service with a persistent disk. Review the provider settings before deploying.

## Source map

| Files | Purpose |
| --- | --- |
| `package.json`, `package-lock.json`, `scripts/` | Two-command launcher, managed Python and locked dependencies |
| `frontend/src/Login.jsx`, `frontend/src/main.jsx`, `frontend/src/styles.css` | Entry forms, sessions, theme, layout and the authentication-success animation |
| `frontend/src/motion/` | Fingerprint SVG, cursor interaction, pigment shaders and reduced-motion handling |
| `frontend/src/workspace/` | Dashboard, evidence and case workflows, reports and teams |
| `backend/app/`, `backend/migrations/` | FastAPI services, authorization, SQLite tables, constraints and audit records |
| `backend/tests/`, `frontend/tests/` | Database-backed API tests and interface tests |
| `server.py`, `Dockerfile`, `compose.yaml`, `render.yaml` | Single-origin production service and persistent storage |
| `docs/` | Demonstration, design record, verification and Postman collection |

The API description is available under `/api/docs` and `/api/openapi.json`. Run frontend checks with `npm test` and `npm run build`. See `backend/README.md` for API-only development and integration tests.
