# Bisleri Gate Entry App

A digital gate entry management system for Bisleri plant operations. Tracks all Finished Goods (FG) and Raw Materials (RM) vehicle movements — Gate-In and Gate-Out — replacing manual paper-based gate registers.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Features](#features)
- [Network & Deployment Setup](#network--deployment-setup)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Supported Devices](#supported-devices)

---

## Overview

The Bisleri Gate Entry App is used at plant/warehouse locations to record every vehicle entering or exiting the gate. Security guards log entries in real time from Android tablets. Supervisors and admins can view insights, manage users, and track operational data from Windows desktops via a web browser.

The system integrates with the Mfabric ERP to validate documents (Delivery Challans, Invoices, Transfer Orders, RGP) against incoming/outgoing vehicles.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo (web + Android) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL 14+ |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Reverse Proxy | Nginx |
| Authentication | JWT (python-jose + passlib bcrypt) |
| ERP Integration | Mfabric (Azure Blob / data sync service) |

---

## Project Structure

```
Bisleri-Gate-Entry-App/
│
├── bisleri-backend/              # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App entry point, CORS, router registration
│   │   ├── auth.py               # JWT authentication logic
│   │   ├── config.py             # Settings from .env
│   │   ├── database.py           # SQLAlchemy engine + session
│   │   ├── dependencies.py       # FastAPI dependency injection
│   │   ├── models/               # SQLAlchemy table models
│   │   │   ├── users.py          # UsersMaster, LocationMaster
│   │   │   ├── insights.py       # InsightsData (FG gate entry log)
│   │   │   ├── documents.py      # DocumentData, Mfabric staging tables
│   │   │   └── raw_materials.py  # RawMaterialsData (RM gate entry log)
│   │   ├── routers/              # API route handlers
│   │   │   ├── auth.py           # Login / logout
│   │   │   ├── gate.py           # Gate entry creation
│   │   │   ├── insights.py       # FG movement insights + operational edit
│   │   │   ├── admin.py          # Warehouse data, user management
│   │   │   ├── documents.py      # Document lookup
│   │   │   ├── raw_materials.py  # RM entry endpoints
│   │   │   ├── sync.py           # Mfabric data sync trigger
│   │   │   └── ping.py           # Health check
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── services/             # Business logic services
│   │   └── utils/                # Helpers, security utilities
│   ├── migrations/               # Alembic migration versions
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env                      # Backend secrets (DB credentials, JWT key)
│
├── gate-entry-app/               # Expo React Native frontend
│   ├── app/
│   │   ├── LoginScreen.js        # Login page
│   │   ├── landing/              # Role selection screen (Guard / Admin)
│   │   ├── security/             # Security Guard dashboard + tabs
│   │   │   ├── SecurityDashboard.js
│   │   │   └── components/
│   │   │       ├── GateEntryTab.js        # FG vehicle entry form
│   │   │       ├── SecurityInsightsTab.js # FG movement history + edit
│   │   │       ├── RMInsightsTab.js       # RM movement history
│   │   │       └── OperationalEditModal.js
│   │   └── admin/                # Admin dashboard + screens
│   │       ├── AdminDashboard.js
│   │       └── screens/
│   │           ├── AdminInsightsScreen.js # Full movement insights
│   │           ├── RegisterScreen.js      # Create new users
│   │           ├── ModifyUserScreen.js    # Edit existing users
│   │           └── ResetPasswordScreen.js
│   ├── services/
│   │   └── api.js                # Axios API client (all backend calls)
│   ├── utils/
│   │   ├── jwtUtils.js           # Token decode + current user helper
│   │   ├── storage.js            # SecureStore wrapper
│   │   └── customModal.js        # Cross-platform alert helper
│   ├── .env                      # Frontend API URL (not committed to Git)
│   ├── .env.example              # Template for .env — commit this
│   └── .gitignore
│
├── setup.py                      # One-command setup script
├── schema.sql                    # Full PostgreSQL schema + seed data
└── README.md
```

---

## User Roles

| Role | Access |
|---|---|
| `securityguard` | FG Gate Entry form, FG Insights tab, RM Insights tab |
| `securityadmin` | Admin Dashboard → Admin Insights tab only |
| `itadmin` | Full access — all tabs + Register Users, Modify Users, Reset Password |

Roles are stored as comma-separated strings in `users_master.role`. A user can hold multiple roles (e.g. `securityguard,securityadmin`).

---

## Features

### Security Guard Dashboard
- **FG Gate Entry** — Log Finished Goods vehicle movements (Gate-In / Gate-Out). Searches and validates against Mfabric documents (Delivery Challan, Invoice, Transfer Order, RGP).
- **FG Insights** — View historical FG gate entries with date/vehicle filters. Supports operational data completion within a 48-hour edit window.
- **RM Insights** — View Raw Materials vehicle movement history.

### 3-Colour Edit System (FG Insights)
Each gate entry record shows an edit button colour based on its completion status:

| Colour | Meaning | Action |
|---|---|---|
| 🟡 Yellow | Missing operational data (Driver Name, KM Reading, Loader Names) | Must complete |
| 🟢 Green | All data complete, within 48-hour window | Can edit optionally |
| ⚫ Black | 48-hour edit window expired | View only |

### Admin Dashboard
- **Admin Insights** — Full movement history across all warehouses with site/warehouse filters, export capability.
- **Register Users** — Create new user accounts with role and warehouse assignment *(IT Admin only)*.
- **Modify Users** — Update existing user details *(IT Admin only)*.
- **Reset Password** — Reset any user's password *(IT Admin only)*.

### Mfabric ERP Integration
- Delivery Challan, Invoice, and Transfer Order / RGP data is synced from Mfabric into local staging tables.
- Documents are used to validate and auto-fill vehicle details during gate entry.
- Sync can be triggered via the `/sync` API endpoint.

---

## Network & Deployment Setup

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

> **Note:** The internal URL (`192.168.1.56:8081`) is accessible only from within the Bisleri office network or when connected via VPN. API calls from both URLs route through Nginx to the backend.

---

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 14+ |
| Alembic | Installed via pip |

### One-Command Setup

From the root of the project:

```bash
python setup.py
```

This will:
1. Install all Python backend packages from `bisleri-backend/app/dependencies.txt`
2. Run Alembic database migrations (`alembic upgrade head`)
3. Install all frontend npm packages (`npm install --legacy-peer-deps`)

---

## Environment Configuration

### Backend (`bisleri-backend/.env`)

```env
SECRET_KEY=your_super_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=720

DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Bisleri_01
```

### Frontend (`gate-entry-app/.env`)

This file is **not committed to Git**. Copy `.env.example` to `.env` and fill in your URL:

```env
# Production server (through Nginx)
EXPO_PUBLIC_API_URL=https://123.63.20.237:19000/api

# Local development (direct to backend)
# EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000
```

> **First time setup:** Copy `.env.example` → rename to `.env` → set the correct URL. You never need to touch `api.js` to change server addresses.

---

## Database Setup

### Fresh Installation

```bash
# 1. Create the database
psql -U postgres -c "CREATE DATABASE Bisleri_01;" -W

# 2. Run the schema (creates all tables + seeds warehouse data + default admin)
psql -U postgres -d Bisleri_01 -f schema.sql -W
```

The `schema.sql` file:
- Creates all 8 tables
- Seeds all 555 warehouse locations from Warehouse Master
- Creates a default IT Admin user

**Default login after fresh install:**
```
Username : itadmin
Password : Admin@123
```
> Change this password immediately after first login via Admin → Reset Password.

### Existing Installation (apply new migrations only)

```bash
cd bisleri-backend
alembic upgrade head
```

---

## Running the App

### Backend

```bash
cd bisleri-backend
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.

### Frontend

```bash
cd gate-entry-app
npx expo start -c
```

| Platform | Command |
|---|---|
| Web browser | Press `w` after `expo start` |
| Android tablet | Press `a` or scan QR code with Expo Go |

---

## Supported Devices

| Device | Access Method |
|---|---|
| Android tablets (plant floor) | Expo Go app or installed APK |
| Windows desktops (office) | Web browser (Chrome recommended) |

iOS is not supported. The application is designed for the Bisleri internal network environment.

---

## Key Notes for Developers

- **Never commit `.env`** — it contains server IPs and secrets. Only `.env.example` goes to GitHub.
- **Always run migrations** after pulling code that changes models — `alembic upgrade head` inside `bisleri-backend/`.
- **The `/api/` Nginx proxy** strips the `/api/` prefix before forwarding to FastAPI. Backend routes do not have `/api/` in their paths.
- **Token expiry** is set to 720 minutes (12 hours) in the backend `.env`.
- **The 48-hour edit window** for gate entry records is enforced on the backend — records cannot be edited after 48 hours regardless of frontend state.
