# Bisleri Gate Entry App

A digital gate entry management system for Bisleri plant operations. Tracks all Finished Goods (FG) and Raw Materials (RM) vehicle movements — Gate-In and Gate-Out — replacing manual paper-based gate registers. Also includes a Co-Packer quality capture module and IBM WatsonX OCR integration for automated document reading.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Features](#features)
- [Network & Deployment](#network--deployment)
- [Prerequisites](#prerequisites)
- [Infrastructure Setup](#infrastructure-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Supported Devices](#supported-devices)
- [Key Notes for Developers](#key-notes-for-developers)

---

## Overview

The Bisleri Gate Entry App is used at plant/warehouse locations to record every vehicle entering or exiting the gate. Security guards log entries in real time from Android tablets. Supervisors and admins view insights, manage users, and track operational data from Windows desktops via a web browser.

The system integrates with the Mfabric ERP to validate documents (Delivery Challans, Invoices, Transfer Orders, RGP) against incoming/outgoing vehicles. A background scheduler syncs Mfabric data into local staging tables automatically every 10 minutes.

JWT token revocation is enforced via Redis — logging out, resetting a password, or changing a user's role immediately invalidates their active session on all devices.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo (web + Android) |
| Backend | FastAPI (Python 3.10+) |
| Database | PostgreSQL 14+ |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Reverse Proxy | Nginx |
| Authentication | JWT (python-jose + passlib bcrypt) |
| Token Revocation | Redis (blocklist keyed by JWT `jti` claim) |
| Background Jobs | APScheduler (Mfabric sync every 10 minutes) |
| OCR | IBM WatsonX (llama-4-maverick via IBM Cloud) |
| ERP Integration | Mfabric (Azure Blob / data sync service) |

---

## Project Structure

```
Bisleri-Gate-Entry-App/
│
├── bisleri-backend/                   # FastAPI backend
│   ├── app/
│   │   ├── main.py                    # App entry, CORS, router registration,
│   │   │                              # APScheduler startup, Redis auto-start
│   │   ├── auth.py                    # JWT creation, password hashing,
│   │   │                              # get_current_user (with Redis blocklist check)
│   │   ├── redis_client.py            # Shared Redis connection + token revocation helpers
│   │   ├── config.py                  # All settings loaded from .env (pydantic-settings)
│   │   ├── database.py                # SQLAlchemy engine + session factory
│   │   │
│   │   ├── models/                    # SQLAlchemy ORM table definitions
│   │   │   ├── users.py               # UsersMaster, LocationMaster
│   │   │   ├── insights.py            # InsightsData (FG gate entry log)
│   │   │   ├── documents.py           # DocumentData, Mfabric staging tables
│   │   │   ├── raw_materials.py       # RawMaterialsData (RM gate entry log)
│   │   │   └── copacker.py            # CopackerEntry, CopackerLocation
│   │   │
│   │   ├── routers/                   # FastAPI route handlers
│   │   │   ├── auth.py                # POST /login  — issues JWT + stores jti in Redis
│   │   │   │                          # POST /logout — revokes token in Redis
│   │   │   ├── gate.py                # FG gate entry creation
│   │   │   ├── insights.py            # FG movement insights + operational edit
│   │   │   ├── admin.py               # User management (IT Admin only)
│   │   │   │                          # reset-password / modify-user revoke active tokens
│   │   │   ├── documents.py           # Mfabric document lookup
│   │   │   ├── raw_materials.py       # RM entry endpoints
│   │   │   ├── copacker.py            # Co-packer entries + authenticated image serving
│   │   │   ├── sync.py                # Manual sync trigger + logs (IT Admin only)
│   │   │   └── ping.py                # Health check endpoints
│   │   │
│   │   ├── schemas/                   # Pydantic request/response models
│   │   │   ├── user_schemas.py
│   │   │   ├── gate_schemas.py
│   │   │   ├── document_schemas.py
│   │   │   ├── raw_materials_schemas.py
│   │   │   ├── copacker_schemas.py
│   │   │   └── token_schemas.py
│   │   │
│   │   ├── services/                  # Business logic
│   │   │   ├── data_sync_service.py   # Mfabric → document_data sync logic
│   │   │   ├── db_service.py          # Shared DB helpers
│   │   │   └── watsonx_ocr.py         # IBM WatsonX OCR API integration
│   │   │
│   │   └── utils/
│   │       ├── helpers.py             # Shared utility functions
│   │       └── security.py            # Role checking helpers
│   │
│   ├── csv_to_DB.py                   # Mfabric CSV → PostgreSQL push script
│   │                                  # Auto-imported by APScheduler on startup
│   ├── scheduler.py                   # Standalone scheduler (legacy, not used in prod)
│   ├── migrations/                    # Alembic migration versions
│   ├── alembic.ini
│   ├── requirements.txt               # Python dependencies
│   └── .env                           # Backend secrets — NEVER commit this file
│
├── gate-entry-app/                    # Expo React Native frontend
│   ├── app/
│   │   ├── index.js                   # Root entry point / auth redirect
│   │   ├── LoginScreen.js             # Login page
│   │   │
│   │   ├── landing/                   # Post-login role selection screen
│   │   │   └── LandingScreen.js
│   │   │
│   │   ├── security/                  # Security Guard dashboard
│   │   │   ├── SecurityDashboard.js
│   │   │   ├── components/
│   │   │   │   ├── GateEntryTab.js         # FG vehicle entry form
│   │   │   │   ├── SecurityInsightsTab.js  # FG history + 48h edit window
│   │   │   │   ├── RMInsightsTab.js        # RM movement history
│   │   │   │   ├── RMEntryTab.js           # RM vehicle entry form
│   │   │   │   ├── OperationalEditModal.js # Driver/KM/loader data completion
│   │   │   │   ├── Header.js
│   │   │   │   ├── Sidebar.js
│   │   │   │   └── TabNavigation.js
│   │   │   └── manual-entry/               # Manual gate entry flow
│   │   │       ├── ManualEntryScreen.js
│   │   │       └── ManualEntryForm.js
│   │   │
│   │   ├── admin/                     # Admin dashboard (IT Admin / Security Admin)
│   │   │   ├── AdminDashboard.js
│   │   │   └── screens/
│   │   │       ├── AdminInsightsScreen.js  # Full movement history, all warehouses
│   │   │       ├── RegisterScreen.js       # Create new users
│   │   │       ├── ModifyUserScreen.js     # Edit user details / roles
│   │   │       └── ResetPasswordScreen.js  # Reset any user's password
│   │   │
│   │   └── copacker/                  # Co-Packer quality capture module
│   │       └── CoPackerDashboard.js   # Session-based capture, photo upload, image preview
│   │
│   ├── services/
│   │   └── api.js                     # Axios client — auto-attaches Bearer token to all requests
│   │
│   ├── utils/
│   │   ├── jwtUtils.js                # Token decode + current user helper
│   │   ├── storage.js                 # expo-secure-store wrapper
│   │   └── customModal.js             # Cross-platform alert helper
│   │
│   ├── .env                           # Frontend API URL — NEVER commit this
│   ├── .env.example                   # Template — commit this instead
│   └── .gitignore
│
├── schema.sql                         # Full PostgreSQL schema + seed data
└── README.md
```

---

## User Roles

Roles are stored as comma-separated strings in `users_master.role`. A user can hold multiple roles (e.g. `Security Guard, Security Admin`). All role checks in the backend normalize to lowercase with spaces removed (e.g. `securityguard`, `itadmin`).

| Role | Access |
|---|---|
| `Security Guard` | FG Gate Entry, FG Insights, RM Insights, RM Entry tabs |
| `Security Admin` | Admin Dashboard → Admin Insights tab only |
| `IT Admin` | Full access — all tabs + Register / Modify / Reset Password + Sync controls |
| `Co Packer` | Co-Packer Dashboard only — quality capture and image review for their assigned location |

> **Co Packer is an exclusive role** and cannot be combined with any other role. A Co Packer user must be assigned a `copacker_location` when the role is set. This is enforced on both the backend and the Modify User screen.

---

## Features

### Security Guard Dashboard

**FG Gate Entry** — Log Finished Goods vehicle movements (Gate-In / Gate-Out). Searches and validates against Mfabric documents (Delivery Challan, Invoice, Transfer Order, RGP). Supports IBM WatsonX OCR for automated document number reading from photos.

**RM Entry** — Log Raw Materials vehicle entries with document reference and weights.

**FG Insights** — View historical FG gate entries with date/vehicle filters. Supports operational data completion within a 48-hour edit window.

**RM Insights** — View Raw Materials vehicle movement history.

**Manual Entry** — Bypass document lookup and create a gate entry record manually when ERP data is unavailable.

### 3-Colour Edit System (FG Insights)

Each gate entry record shows an edit button coloured by completion status:

| Colour | Meaning | Action |
|---|---|---|
| Yellow | Missing operational data (Driver Name, KM Reading, Loader Names) | Must complete |
| Green | All data complete, within 48-hour window | Can edit optionally |
| Black | 48-hour edit window expired | View only, no edit |

### Admin Dashboard

**Admin Insights** — Full movement history across all warehouses with site/warehouse filters and export.

**Register Users** — Create new user accounts with role and warehouse assignment *(IT Admin only)*.

**Modify Users** — Update existing user roles and details. Changing a role immediately revokes the user's active token — they must re-login to get a token reflecting the updated role *(IT Admin only)*.

**Reset Password** — Reset any user's password. Immediately revokes the affected user's active token so they must re-login with the new credentials *(IT Admin only)*.

### Co-Packer Dashboard

Session-based quality capture for co-packer locations. Each session records product, batch, date, inspector details, and inline quality check photos. Images are stored on the server filesystem and served via an authenticated endpoint — never as public static files.

### Mfabric ERP Integration

Delivery Challan, Invoice, Transfer Order, and RGP data is synced from Mfabric into local `document_data` staging tables. Documents validate and auto-fill vehicle details during gate entry.

**Sync runs automatically every 10 minutes** via APScheduler (started with the backend). An initial sync runs on startup. IT Admins can also trigger a manual sync or view sync logs via the `/sync` endpoints.

### JWT Token Revocation (Redis)

Every token contains a unique `jti` (JWT ID). On login, the `jti` is stored in Redis with a TTL matching the token lifetime. On logout, password reset, role change, or user deletion — the `jti` is added to a Redis blocklist and all subsequent requests using that token are rejected with HTTP 401, even if the token has not expired yet. Redis starts automatically with the backend — no manual management required.

---

## Network & Deployment

```
Internet / Bisleri Network
        │
        ▼
   Nginx (192.168.1.56 / 123.63.20.237)
        │
        ├── Port 19000 (HTTPS — Public URL)
        │       ├── /api/*  →  FastAPI backend  (127.0.0.1:8000)
        │       └── /*      →  Expo Web App     (127.0.0.1:8081)
        │
        └── Port 443 (HTTPS — Streamlit apps)
```

| URL | Used By | Access |
|---|---|---|
| `https://123.63.20.237:19000` | All users (tablets + desktops) | Public internet / Bisleri network |
| `http://192.168.1.56:8081` | Developers / IT (direct frontend) | Bisleri network or VPN only |

> The internal URL (`192.168.1.56:8081`) is accessible only from within the Bisleri office network or over VPN. API calls from both URLs route through Nginx to the backend.

---

## Prerequisites

Install all of the following on the Windows Server before setting up the application.

| Tool | Minimum Version | Download |
|---|---|---|
| Python | 3.10+ | python.org |
| Node.js | 18+ | nodejs.org |
| PostgreSQL | 14+ | postgresql.org |
| Redis | 5.0+ | github.com/tporadowski/redis/releases |

---

## Infrastructure Setup

### Step 1 — Clone the Repository

```
git clone <repo-url>
cd Bisleri-Gate-Entry-App
```

### Step 2 — Install Redis

1. Download `Redis-x64-5.0.14.1.zip` (or later) from:
   `https://github.com/tporadowski/redis/releases`

2. Extract to a permanent folder — the project expects it at:
   `C:\Automation\Redis-x64-5.0.14.1\`

3. Verify it works — open Command Prompt:
   ```
   C:\Automation\Redis-x64-5.0.14.1\redis-server.exe
   ```
   You should see Redis start with its logo and `Ready to accept connections`.

4. Open a second Command Prompt to confirm:
   ```
   C:\Automation\Redis-x64-5.0.14.1\redis-cli.exe ping
   ```
   Should return `PONG`. Press Ctrl+C to stop — the backend manages starting it automatically.

5. If you install Redis to a different folder, update `_REDIS_EXE` in `bisleri-backend/app/main.py`.

### Step 3 — Backend Python Environment

```
cd bisleri-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install redis
```

Key packages:
- `fastapi`, `uvicorn` — web server
- `sqlalchemy`, `alembic`, `psycopg2-binary` — database
- `python-jose[cryptography]`, `passlib[bcrypt]` — JWT auth
- `apscheduler` — background sync scheduler
- `redis` — token revocation
- `ibm-watsonx-ai` — OCR integration

### Step 4 — Frontend Node Environment

```
cd gate-entry-app
npm install --legacy-peer-deps
```

---

## Environment Configuration

### Backend — `bisleri-backend/.env`

Create this file manually. **Never commit it to Git.**

```env
# ── Database ──────────────────────────────────────────────────────────────────
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Bisleri_01

# ── JWT Authentication ────────────────────────────────────────────────────────
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=paste_generated_secret_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# ── Co-Packer Feature ─────────────────────────────────────────────────────────
COPACKER_FEATURE_ENABLED=true
COPACKER_IMAGE_PATH=C:\path\to\copacker_images
ENABLE_FIELD_EDIT=false

# ── IBM WatsonX OCR ───────────────────────────────────────────────────────────
IBM_API_KEY=your_ibm_api_key
IBM_SERVICE_URL=https://eu-de.ml.cloud.ibm.com
IBM_PROJECT_ID=your_ibm_project_id
WATSONX_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct-fp8
```

| Variable | Description |
|---|---|
| `SECRET_KEY` | Used to sign all JWT tokens. Must be a random 32-byte hex string. A weak value allows anyone to forge tokens. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes. Default 480 (8 hours). Redis blocklist entries use the same TTL. |
| `COPACKER_IMAGE_PATH` | Absolute path on the server where co-packer images are stored. The directory is created automatically on startup. |
| `IBM_API_KEY` | IBM Cloud API key for WatsonX OCR. Rotate regularly in the IBM Cloud console. |

### Frontend — `gate-entry-app/.env`

Copy `.env.example` to `.env`. **Never commit `.env` to Git.**

```env
# Production (through Nginx)
EXPO_PUBLIC_API_URL=https://123.63.20.237:19000/api

# Local development (use your PC's actual LAN IP — not localhost)
# EXPO_PUBLIC_API_URL=http://192.168.1.XX:8000
```

> When testing on a physical Android tablet, never use `localhost`. The tablet is a separate device and cannot reach your PC on `localhost`. Use the PC's actual local IP address (find it with `ipconfig`).

---

## Database Setup

### Fresh Installation

```bash
# 1. Create the database
psql -U postgres -c "CREATE DATABASE Bisleri_01;" -W

# 2. Run the schema (creates all tables + seeds warehouse data + default IT Admin)
psql -U postgres -d Bisleri_01 -f schema.sql -W
```

The `schema.sql` file creates all tables, seeds 555 warehouse locations, and creates a default IT Admin user.

**Default login after fresh install:**
```
Username : itadmin
Password : Admin@123
```

Change this password immediately after first login via Admin → Reset Password.

### Existing Installation — Apply Migrations Only

```bash
cd bisleri-backend
alembic upgrade head
```

Run this any time you pull code that changes model files.

---

## Running the App

### Backend

```
cd bisleri-backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On startup the backend will automatically:

1. Start Redis (if not already running at the configured path)
2. Start the APScheduler background job (Mfabric sync every 10 minutes, IST)
3. Run an immediate Mfabric sync so data is fresh before the first request

Confirm everything started correctly — you should see these lines in the console:

```
[Redis] Redis ready after 2s.
Background sync scheduler started — runs every 10 minutes (IST).
Running initial sync on startup...
Application startup complete.
```

If you see `[Redis] store_active_jti failed` warnings, Redis did not start. Check that the path in `_REDIS_EXE` in `app/main.py` matches your actual Redis installation folder.

### Frontend

```
cd gate-entry-app
npx expo start -c
```

| Platform | How to open |
|---|---|
| Web browser | Press `w` in the terminal after `expo start` |
| Android tablet | Press `a` or scan the QR code with Expo Go |

---

## Supported Devices

| Device | Access Method |
|---|---|
| Android tablets (plant floor / co-packer) | Expo Go app or installed APK |
| Windows desktops (office / admin) | Web browser — Chrome recommended |

iOS is not supported. The application is designed for the Bisleri internal network environment.

---

## Key Notes for Developers

**Never commit `.env` files.** They contain the database password, the JWT secret key, and IBM API credentials. Only `.env.example` goes to Git.

**Always run `alembic upgrade head` after pulling.** Any code change that modifies a model file requires this command inside `bisleri-backend/` before starting the server.

**The `/api/` Nginx prefix is stripped.** The proxy removes `/api/` before forwarding to FastAPI. Backend routes do not include `/api/` in their paths.

**Redis is required for token revocation.** If Redis cannot be started, all authentication still works (fail-open by design) but logout and forced token invalidation will not take effect. Check the uvicorn console for `[Redis] WARNING` lines if you suspect an issue.

**Redis path must match your installation.** The executable path is hardcoded in `app/main.py` as `_REDIS_EXE = r"C:\Automation\Redis-x64-5.0.14.1\redis-server.exe"`. If you move or upgrade Redis, update this line.

**Co-packer images are not public.** Images are served via `GET /copacker/image/{path}` which requires a valid Bearer token with `copacker` or `itadmin` role. Path traversal is also blocked server-side. The `StaticFiles` mount has been removed.

**Sync endpoints require IT Admin.** `POST /sync/manual`, `GET /sync/status`, and `GET /sync/logs` all require an authenticated IT Admin token.

**Token lifetime is 480 minutes (8 hours).** Configured via `ACCESS_TOKEN_EXPIRE_MINUTES` in `.env`. Redis blocklist entries expire at the same time as the token they block — Redis never accumulates stale data.

**Role format in the database.** Roles are stored as comma-separated display strings, e.g. `IT Admin, Security Guard`. All role checks in the codebase normalize to lowercase with spaces removed before comparing (`itadmin`, `securityguard`). Never compare `current_user.role` directly to a string literal.

**The 48-hour edit window is server-enforced.** Gate entry records cannot be edited after 48 hours regardless of what the frontend shows. The timestamp check runs on the backend on every edit request.

**`csv_to_DB.py` uses a named logger.** It uses `logging.getLogger("csv_to_DB")` with `propagate=False` so its file handler is not silently skipped when the module is imported by FastAPI. Do not change it back to `logging.basicConfig()`.

**`dump.rdb` in the backend folder.** This is Redis's default persistence file written to whichever directory the process runs from. It is harmless — the blocklist data in it expires naturally and does not need to be preserved across restarts. You can safely add `dump.rdb` to `.gitignore`.
