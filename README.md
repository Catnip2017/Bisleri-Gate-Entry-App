# Bisleri Gate Entry App

A digital gate-entry management system for Bisleri plant and warehouse operations. It records every Finished Goods (FG) and Raw Materials (RM) vehicle movement — Gate-In and Gate-Out — replacing manual paper gate registers, and adds a Gate Pass module (returnable / non-returnable material passes), a Co-Packer quality-capture module, RPA dashboards, and IBM WatsonX OCR for automated document reading.

The backend is a FastAPI service backed by PostgreSQL; the frontend is a single Expo React Native codebase that runs both as a web app (desktops) and on Android tablets. The system integrates with the Mfabric ERP feed to validate documents (Delivery Challans, Invoices, Transfer Orders, RGP) against vehicles at the gate.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Modules](#modules)
- [User Roles & Access Model](#user-roles--access-model)
- [Authentication & Authorization](#authentication--authorization)
- [Data Model](#data-model)
- [API Surface](#api-surface)
- [Mfabric ERP Sync](#mfabric-erp-sync)
- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup & Migrations](#database-setup--migrations)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [Logging & Error Handling](#logging--error-handling)
- [Network & Deployment](#network--deployment)
- [Supported Devices](#supported-devices)
- [Developer Notes & Conventions](#developer-notes--conventions)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo (Expo Router), runs on web + Android |
| Backend | FastAPI (Python 3.10+), Uvicorn ASGI server |
| Database | PostgreSQL 14+ |
| ORM | SQLAlchemy 2.x |
| Validation | Pydantic v2 / pydantic-settings |
| Auth | JWT (python-jose) + password hashing (passlib / bcrypt) |
| Background jobs | APScheduler (Mfabric sync on an interval) |
| OCR | IBM WatsonX (llama-4-maverick via IBM Cloud) |
| ERP integration | Mfabric staging tables + data-sync service |
| Reverse proxy | Nginx (TLS termination, path routing) |
| Tests | pytest + Starlette TestClient (SQLite-backed) |
| Secondary dashboards | `dashboard-web/` — separately built static bundle for RPA / load analytics |

---

## Architecture

Two independently deployable pieces behind one Nginx reverse proxy:

- **`bisleri-backend/`** — the FastAPI application. Owns the database, authentication, all business logic, the Mfabric sync scheduler, and the WatsonX OCR calls. Stateless HTTP; every request carries a JWT.
- **`gate-entry-app/`** — the Expo React Native client. One codebase serves the browser (Expo web) and Android tablets (Expo Go / dev client). It holds no business rules of its own — every action is validated server-side; the UI only reflects what the API permits.

The client never touches the database directly. All reads and writes go through the API, which is the single authority for access control, validation, and data integrity.

---

## Project Structure

```
Bisleri-Gate-Entry-App/
│
├── bisleri-backend/                     # FastAPI backend
│   ├── app/
│   │   ├── main.py                      # App entry: FastAPI() config, CORS, router
│   │   │                                # registration, APScheduler lifespan, logging
│   │   ├── auth.py                      # JWT create/verify, password hashing,
│   │   │                                # get_current_user dependency (per-request checks)
│   │   ├── config.py                    # Settings from .env (pydantic-settings)
│   │   ├── database.py                  # SQLAlchemy engine, session factory, Base, get_db
│   │   │
│   │   ├── models/                      # SQLAlchemy ORM tables
│   │   │   ├── users.py                 # UsersMaster, LocationMaster
│   │   │   ├── insights.py              # InsightsData (FG gate-entry log)
│   │   │   ├── raw_materials.py         # RawMaterialsData (RM gate-entry log)
│   │   │   ├── documents.py             # DocumentData + Mfabric staging tables
│   │   │   ├── gate_pass.py             # Gate Pass header/line/event/sequence/party/
│   │   │   │                            # item/cancel-reason/location + UserGatePassLocation
│   │   │   └── copacker.py              # CopackerEntry, CopackerLocation, sessions
│   │   │
│   │   ├── routers/                     # HTTP route handlers (one module per area)
│   │   │   ├── auth.py                  # POST /login, POST /logout
│   │   │   ├── gate.py                  # FG gate-entry creation (batch / manual / multi-doc)
│   │   │   ├── insights.py              # FG movement lists + operational edit
│   │   │   ├── raw_materials.py         # RM entry create + lists (/rm/*)
│   │   │   ├── gate_pass.py             # Gate Pass lifecycle (create/release/dispatch/
│   │   │   │                            # inward/cancel/force-close) + lookups
│   │   │   ├── admin.py                 # User management, dashboard stats (IT Admin)
│   │   │   ├── documents.py             # Mfabric document lookup / consolidation
│   │   │   ├── copacker.py              # Co-packer entries + authenticated image serving
│   │   │   ├── dashboard.py             # RPA / load dashboard API
│   │   │   ├── rpa.py                   # RPA data endpoints
│   │   │   ├── sync.py                  # Manual Mfabric sync trigger + status/logs
│   │   │   └── ping.py                  # Health checks
│   │   │
│   │   ├── schemas/                     # Pydantic request/response models
│   │   │   ├── user_schemas.py          # UserCreate/Response/RoleUpdate, GP location assignment
│   │   │   ├── gate_schemas.py          # Gate entry + operational-edit schemas
│   │   │   ├── gate_pass_schemas.py     # Gate Pass typed request/response (Pydantic v2)
│   │   │   ├── raw_materials_schemas.py
│   │   │   ├── document_schemas.py
│   │   │   ├── filter_schemas.py        # MovementFilters (typed list filters + pagination)
│   │   │   └── token_schemas.py
│   │   │
│   │   ├── services/                    # Business logic (kept out of routers/models)
│   │   │   ├── data_sync_service.py     # Mfabric → document_data sync
│   │   │   ├── db_service.py            # Shared DB helpers
│   │   │   ├── edit_service.py          # 3-colour edit-window logic for InsightsData
│   │   │   └── watsonx_ocr.py           # IBM WatsonX OCR integration
│   │   │
│   │   ├── utils/
│   │   │   ├── roles.py                 # normalize_roles() — single source for role parsing
│   │   │   ├── edit_window.py           # 48-hour edit-window helpers (single source)
│   │   │   ├── errors.py                # Safe error responses (ref-ID + server-side logging)
│   │   │   ├── helpers.py               # Gate-entry number generation, misc helpers
│   │   │   └── security.py              # Role-check helpers
│   │   │
│   │   └── dashboard/etl/               # RPA/load dashboard ETL jobs
│   │
│   ├── tests/                           # pytest suite (SQLite-backed TestClient)
│   │   ├── conftest.py                  # Fixtures: in-memory DB, role-switching client
│   │   ├── test_roles.py                # utils/roles unit tests
│   │   ├── test_edit_window.py          # utils/edit_window unit tests
│   │   ├── test_edit_service.py         # 3-colour edit logic
│   │   ├── test_errors.py               # safe-error / ref-ID behaviour
│   │   ├── test_filter_endpoints.py     # typed filters + GET list endpoints
│   │   ├── test_pagination.py           # skip/limit + total_count
│   │   ├── test_dashboard_stats.py      # aggregated admin stats
│   │   ├── test_gate_pass_flow.py       # Gate Pass lifecycle + access rules
│   │   ├── test_gatepassuser_role.py    # Gate Pass User role + multi-location
│   │   ├── test_security_admin_viewonly.py
│   │   └── test_is_active.py            # account activation / kill switch
│   │
│   ├── csv_to_DB.py                     # Mfabric staging → document_data push
│   │                                    # (imported and run by the APScheduler job)
│   ├── pytest.ini                       # Test configuration
│   ├── requirements.txt                 # Python dependencies
│   ├── alembic.ini + migrations/        # Alembic (baseline; see SQL migrations note below)
│   ├── .env.example                     # Backend config template
│   └── .env                             # Backend secrets — NEVER commit
│
├── gate-entry-app/                      # Expo React Native frontend
│   ├── app/                             # Expo Router routes (file-based)
│   │   ├── LoginScreen.js
│   │   ├── index.js                     # Root redirect / auth gate
│   │   ├── landing/                     # Post-login role-based routing
│   │   ├── security/                    # Security dashboard (gate entry + insights tabs)
│   │   │   └── components/              # GateEntryTab, RM tabs, insights, guard gate-pass tab
│   │   ├── gate-pass/                   # Gate Pass module (dashboard, form, list, print)
│   │   ├── admin/ + admin-hub/          # User management + admin hub tiles
│   │   ├── copacker/                    # Co-Packer capture module
│   │   └── rpa/                         # RPA dashboard screens
│   │   │
│   ├── config/navConfig.js              # Role → menu / landing routing config
│   ├── services/api.js                  # Axios client — attaches Bearer token to requests
│   ├── utils/
│   │   ├── jwtUtils.js                  # Token decode + current-user helper + role routing
│   │   ├── storage.js                   # expo-secure-store (mobile) / localStorage (web)
│   │   ├── printGatePass.js             # Printable gate pass (web)
│   │   └── customModal.js               # Cross-platform alert
│   ├── .env.example                     # Frontend config template
│   └── .env                             # Frontend API URL — NEVER commit
│
├── dashboard-web/                       # Separately built static dashboard bundle (RPA/load)
│
├── DB Schemas/                          # Authoritative schema references (per database)
│   ├── schema_bisleri_01.sql           # Main DB — generated from the ORM (25 tables)
│   ├── schema_bisleri_dashboard.sql    # Vehicle/load dashboard DB (ETL-defined)
│   └── schema_rpa_automation.sql       # RPA DB reference (externally owned, read-only)
│
├── legacy_sql/                          # Archived pre-Alembic migrations — DO NOT run
│   ├── README.md                       # Why they're archived (effects already applied)
│   ├── schema.sql                      # Old 8-table schema (SUPERSEDED)
│   └── *_migration.sql                 # The hand-written feature migrations
│
└── README.md
```

---

## Modules

**FG Gate Entry** — Log Finished Goods movements (Gate-In / Gate-Out). Searches and validates against Mfabric documents; supports WatsonX OCR for reading document numbers from photos; supports a manual-entry path when ERP data is unavailable.

**RM Gate Entry** — Log Raw Materials vehicle entries with document reference, party, description, and quantity.

**Insights (FG & RM)** — Filterable movement history (date range, vehicle, warehouse, site, movement type), paginated, warehouse-scoped by role. FG insights include the 3-colour operational-edit system within a 48-hour window.

**3-Colour Edit System** — Each FG record surfaces an edit control coloured by state:

| Colour | Meaning |
|---|---|
| Yellow | Inside the 48-hour window, required operational fields (driver, KM, loaders) missing |
| Green | Inside the window, all fields complete |
| Black | 48-hour window expired — view only |

The window and all edit-permission logic are computed server-side (`utils/edit_window.py` + `services/edit_service.py`); the button config the API returns is what the UI renders.

**Gate Pass** — Returnable (R) and Non-Returnable (NR) material passes with a strict lifecycle: `Open → Released → Dispatched`, and for returnable passes `→ [Partially Received →] Inward Received`. Passes are never edited — a wrong pass is cancelled (with a mandatory reason) and recreated. Pass numbers are assigned at submit under a row lock, incremental per (location, type), and never reused. Returnable passes support line-level partial returns (append-only receipt events) and an admin force-close for material that will never return.

**Co-Packer** — Session-based quality capture per co-packer location: product, batch, inspector details, and inline photos. Images are stored on the server filesystem and served through an authenticated endpoint (never as public static files).

**User Management (Admin Hub)** — Assign Access, Register User, and Reset Password screens. Handles roles, warehouse scope, gate-pass location scope, department, and account activation.

**RPA / Load Dashboards** — Analytics served from `dashboard.py` / `rpa.py` and the `dashboard-web/` static bundle.

---

## User Roles & Access Model

Roles are stored as a comma-separated display string in `users_master.role` (e.g. `IT Admin, Security Guard`). A user may hold multiple roles. Every backend check normalizes roles to lowercase-no-spaces (`itadmin`, `securityguard`, `securityadmin`, `gatepassuser`, `copacker`) via `app/utils/roles.py` — never compare `current_user.role` to a literal.

| Role | Capability |
|---|---|
| `Security Guard` | Create/edit FG & RM gate entries (own warehouse, within the 48-hour window); process the Gate Pass guard worklist (dispatch / inward) at their assigned gate-pass location(s). |
| `Security Admin` | Oversight, view-only: reads gate-entry insights scoped to their warehouse/site; the Gate Entry form is view-only; no edit controls; no Gate Pass access. |
| `IT Admin` | Full administration: user management, dashboards, sync controls, Gate Pass administration. View-only in the gate-entry form. |
| `Gate Pass User` | Create / release / cancel gate passes for their department at their assigned location(s); sees only their own department + location passes. |
| `Co Packer` | Co-Packer capture for their assigned location. Exclusive role — cannot be combined with any other, and requires a `copacker_location`. |

Two scoping attributes accompany roles: **warehouse** (gate-entry visibility/edit) and **gate-pass location(s)** (Gate Pass visibility/actions). A user can be assigned multiple gate-pass locations via the `user_gate_pass_locations` junction table, exactly one marked as the default.

---

## Authentication & Authorization

- **Login** issues a signed JWT (`sub` = username, plus role and scope claims). Tokens are bearer tokens sent in the `Authorization` header. Lifetime is configurable (`ACCESS_TOKEN_EXPIRE_MINUTES`, default 480 = 8h).
- **Token storage (client):** `expo-secure-store` on Android; browser storage on web (`utils/storage.js` abstracts both).
- **`get_current_user`** (in `app/auth.py`) is the shared dependency for every protected route. It decodes the JWT, loads the user from the database on each request, and enforces the account-activation check — so an account switched off takes effect on the user's next request, not only at next login.
- **Role gates** are applied per router/endpoint using the normalized-role helpers. Access decisions are always server-side; the frontend menu (`config/navConfig.js`) mirrors them for UX only.
- **No-role users** are blocked at login with a clear message and never reach the app shell.

---

## Data Model

Core tables (see `DB Schemas/schema_bisleri_01.sql` — generated from the ORM models — for the authoritative DDL):

- **`users_master`** — username (PK), first/last name, `role` (CSV string), `password` (bcrypt hash), `warehouse_code` / `warehouse_name` / `site_code`, `copacker_location`, `department`, `gate_pass_location`, `is_active`, `last_login`.
- **`location_master`** — warehouse code → name / site mappings.
- **`insights_data`** — FG gate-entry log: gate entry no, document type/no, vehicle, warehouse, date/time, movement type, operational fields (driver, KM, loaders), edit tracking. Indexed on `warehouse_code`, `date`, `movement_type` (+ composite).
- **`raw_materials_data`** — RM gate-entry log: gate entry no, gate type, vehicle, document, party, description, quantity, date_time, warehouse/site. Indexed similarly.
- **`document_data`** + **`mfabric_*` staging tables** — consolidated ERP documents and their raw staging feeds.
- **Gate Pass tables** — `gate_pass_headers`, `gate_pass_lines`, `gate_pass_events`, `gate_pass_sequences` (numbering), `gate_pass_parties`, `gate_pass_items`, `gate_pass_cancel_reasons`, `gate_pass_locations`, and `user_gate_pass_locations` (user↔location junction with a default flag).
- **Co-Packer tables** — entries, locations, and session capture (with shift).

---

## API Surface

Route modules and their prefixes (paths below are as seen by FastAPI; Nginx strips the `/api/` prefix before forwarding):

| Router | Prefix / examples |
|---|---|
| `auth.py` | `POST /login`, `POST /logout` |
| `gate.py` | `POST /manual-gate-entry`, `/batch-gate-entry`, `/enhanced-*`, `/multi-document-manual-entry`, `GET /search-recent-documents/{vehicle}` |
| `insights.py` | `GET /movements` (filtered, paginated), `PUT /update-operational-data`, edit statistics |
| `raw_materials.py` | `POST /rm/create-entry`, `GET /rm/entries`, `GET /rm/admin-entries`, `PUT /rm/update-entry` |
| `gate_pass.py` | `GET /gate-pass` (list), `POST /gate-pass`, `POST /gate-pass/{id}/release|cancel|dispatch|inward|force-close`, `GET /gate-pass/{id}`, `GET /gate-pass/my-locations`, lookups (`/locations`, `/departments`, `/parties`, `/items`, `/cancel-reasons`), `GET /gate-pass/guard/pending` |
| `admin.py` | `POST /register`, `PUT /modify-user/{username}`, `PUT /users/{username}/update`, `POST /reset-password`, `GET /list-users`, `GET /search-users`, `GET /admin-dashboard-stats`, `GET /admin-rm-statistics` |
| `documents.py` | Mfabric document lookup / consolidation |
| `copacker.py` | Co-packer entries + `GET /copacker/image/{path}` (authenticated) |
| `sync.py` | `POST /sync/manual`, `GET /sync/status`, `GET /sync/logs` (IT Admin) |
| `dashboard.py` / `rpa.py` | RPA / load analytics |
| `ping.py` | Health checks |

List endpoints accept typed query filters (`from_date`, `to_date`, `warehouse_code`, `site_code`, `vehicle_no`, `movement_type`) and `skip` / `limit` pagination; responses include `count`, `total_count`, `skip`, and `limit`.

---

## Mfabric ERP Sync

Delivery Challan, Invoice, Transfer Order, and RGP records arrive in `mfabric_*` staging tables. `csv_to_DB.py` aggregates them (one row per document) and upserts into the consolidated `document_data` table, which gate entry searches against.

The sync runs on a fixed interval via **APScheduler**, started with the backend in `main.py`, with an initial run on startup. IT Admins can also trigger a manual sync or read sync status/logs through the `/sync/*` endpoints. `csv_to_DB.py` uses a dedicated named logger (`logging.getLogger("csv_to_DB")`, `propagate=False`) so its output is preserved when imported by FastAPI — do not convert it to `logging.basicConfig()`.

---

## Prerequisites

Install on the host before setup:

| Tool | Minimum version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |

---

## Backend Setup

```
cd bisleri-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Key packages: `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `pydantic` / `pydantic-settings`, `python-jose[cryptography]`, `passlib[bcrypt]`, `apscheduler`, `python-dotenv`, `alembic`, plus `pytest` + `httpx` for the test suite.

---

## Frontend Setup

```
cd gate-entry-app
npm install --legacy-peer-deps
```

If Expo reports SDK/package version mismatches, run `npx expo install --fix` locally.

---

## Environment Configuration

### Backend — `bisleri-backend/.env`

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

```env
# Database
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Bisleri_01

# JWT — generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=paste_generated_secret_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Historical / dashboard DB (RPA + load analytics)
HISTORICAL_DB_USER=postgres
HISTORICAL_DB_PASSWORD=your_db_password
HISTORICAL_DB_HOST=localhost
HISTORICAL_DB_PORT=5432
HISTORICAL_DB_NAME=Bisleri_dashboard

# Co-Packer
COPACKER_FEATURE_ENABLED=true
COPACKER_IMAGE_PATH=C:\path\to\copacker_images

# IBM WatsonX OCR
IBM_API_KEY=your_ibm_api_key
IBM_SERVICE_URL=https://eu-de.ml.cloud.ibm.com
IBM_PROJECT_ID=your_ibm_project_id
WATSONX_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct-fp8

# Optional: persistent log file (see Logging section)
FILE_LOGGING=false

# Optional: expose Swagger / API docs. Keep false in production.
ENABLE_DOCS=false
```

| Variable | Description |
|---|---|
| `SECRET_KEY` | Signs all JWTs. Must be a random 32-byte hex string. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes (default 480 = 8h). |
| `COPACKER_IMAGE_PATH` | Absolute server path for co-packer images; created on startup. |
| `IBM_API_KEY` / `IBM_PROJECT_ID` | IBM Cloud credentials for WatsonX OCR. |
| `FILE_LOGGING` | `true` writes a rotating log file; console logging is always on. |
| `ENABLE_DOCS` | `true` exposes `/docs`, `/redoc`, `/openapi.json`; `false` (default) returns 404 for all three. Keep `false` in production; set `true` for local dev. Read once at startup — restart uvicorn after changing. |

### Frontend — `gate-entry-app/.env`

Copy `.env.example` to `.env`. **Never commit `.env`.**

```env
# Production (through Nginx)
EXPO_PUBLIC_API_URL=https://<host>:19000/api

# Local development — use your PC's LAN IP, never localhost (tablets can't reach it)
# EXPO_PUBLIC_API_URL=http://192.168.1.XX:8000
```

---

## Database Setup & Migrations

The project is migrating to **Alembic as the single source of truth** for the main database. Schema changes are driven by the SQLAlchemy ORM models; Alembic autogenerates and tracks the migrations.

> **Note:** the hand-written `*_migration.sql` files that were previously applied by hand have been archived to `legacy_sql/` (their effects are already baked into existing databases — **do not re-run them**). The current authoritative schema lives in `DB Schemas/schema_bisleri_01.sql`, generated from the ORM.

### Fresh installation

Create the database, then let Alembic build the schema from the models:

```bash
psql -U postgres -c "CREATE DATABASE Bisleri_dev;"   # or your target DB
# with the backend .env pointing at that DB:
cd bisleri-backend
alembic upgrade head
```

`DB Schemas/schema_bisleri_01.sql` is the human-readable reference for the resulting 25-table schema. After first login, change the default admin password.

### Ongoing schema changes (Alembic workflow)

```bash
# 1. edit the ORM model(s) under app/models/
# 2. autogenerate a migration
alembic revision --autogenerate -m "describe the change"
# 3. review the generated file in migrations/versions/, then apply
alembic upgrade head
```

Helpers: `alembic current` (where a DB is), `alembic history` (revision list), `alembic downgrade -1` (roll back one). The full adoption plan (squash to a clean baseline + the pending `copacker_captures` fix) is documented in `DB_Schema_Alembic_Migration_Plan.pdf`.

### Other databases

`Bisleri_dashboard` (vehicle/load analytics) self-provisions its tables via the ETL code and is **not** managed by Alembic. `RPA_Automation` is owned by external RPA jobs and is read-only to this app. See `DB Schemas/` for reference DDL of both.

---

## Running the App

### Backend

```
cd bisleri-backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On startup the backend starts the APScheduler Mfabric sync job and runs an initial sync so document data is fresh before the first request.

### Frontend

```
cd gate-entry-app
npx expo start -c
```

| Platform | How to open |
|---|---|
| Web browser | Press `w` in the Expo terminal |
| Android tablet | Press `a`, or scan the QR code with Expo Go |

Tablets load the JavaScript bundle from the running Expo server, so a reload always fetches the latest client code.

---

## Testing

The backend has a pytest suite under `bisleri-backend/tests/`, run against an in-memory SQLite database with the FastAPI routers mounted and auth/DB dependency-overridden (no Postgres or live JWT required).

```
cd bisleri-backend
pip install pytest httpx          # once per environment (also in requirements.txt)
pytest                            # runs the whole suite
pytest tests/test_gate_pass_flow.py   # a single file
```

The tests double as executable specifications of the business rules (role scoping, the gate-pass lifecycle, the edit window, pagination, and input validation).

---

## Logging & Error Handling

- **Console logging** is always on.
- **Safe errors:** unhandled exceptions return a generic client message with a short reference ID; the full stack trace is written server-side under the same ID (`app/utils/errors.py` + a global handler in `main.py`). Set `DEBUG_ERRORS=true` in `.env` to include raw exception text in responses during local development only.
- **Optional file logging:** set `FILE_LOGGING=true` and restart to also write a rotating log file at `bisleri-backend/logs/app.log` (5 MB per file, 5 backups). The `logs/` directory is gitignored.

---

## Network & Deployment

```
Bisleri Network
      │
      ▼
   Nginx (TLS)
      │
      ├── /api/*  →  FastAPI backend  (127.0.0.1:8000)
      └── /*      →  Expo web app     (127.0.0.1:8081)
```

Nginx terminates TLS and strips the `/api/` prefix before forwarding to FastAPI — backend routes do not include `/api/`. The Expo web build is served for all non-API paths.

---

## Supported Devices

| Device | Access |
|---|---|
| Android tablets (gate / plant floor) | Expo Go or a dev/standalone build |
| Windows desktops (office / admin) | Web browser (Chrome recommended) |

iOS is not a target. The app is designed for the Bisleri internal network.

---

## Developer Notes & Conventions

- **Never commit `.env` files.** They hold the DB password, the JWT secret, and IBM credentials. Only `.env.example` belongs in Git.
- **Role checks always normalize.** Use `app/utils/roles.py`; never compare `current_user.role` to a string literal. Roles are CSV display strings; comparisons run on the lowercase-no-space form.
- **The 48-hour edit window is server-enforced.** All window math lives in `app/utils/edit_window.py`; edit permissions in `app/services/edit_service.py`. The frontend renders the button config the API returns — it does not decide edit rights.
- **Access control is server-side.** The frontend menu (`config/navConfig.js`) reflects permissions for UX; the API is the authority. Any new endpoint must apply its own role/scope check via `get_current_user`.
- **Gate passes are immutable.** No edit path exists by design — cancel (with a reason) and recreate. Pass numbers are assigned at submit under a row lock and never reused.
- **List endpoints are typed and paginated.** Filters use the `MovementFilters` schema (unknown fields are rejected); always pass `skip`/`limit` for large result sets.
- **`csv_to_DB.py` is live code**, imported and run by the APScheduler sync job — it is not a throwaway script. Keep its named logger (`propagate=False`); do not switch it to `basicConfig()`.
- **DB changes go through Alembic.** Edit the ORM models, then `alembic revision --autogenerate` and review the result (see [Database Setup & Migrations](#database-setup--migrations)). The old hand-written `*_migration.sql` files are archived in `legacy_sql/` and must not be re-run.
- **Co-packer images are private**, served only via the authenticated `GET /copacker/image/{path}` endpoint with server-side path-traversal protection — never as static files.
- **Run the test suite before committing backend changes:** `pytest` in `bisleri-backend/`.
```
