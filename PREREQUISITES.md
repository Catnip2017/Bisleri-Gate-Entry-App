# Bisleri Ops Hub — Prerequisites and start-up files

Install these on the machine **before** running `setup.bat`. The versions are
the ones the app is built and tested with; newer patch versions are fine.

| Application | Version | Why | Check with |
|---|---|---|---|
| Windows | 10 / 11 or Windows Server 2019+ | the `.bat` files are for Windows | — |
| Python | 3.10 – 3.13 (64-bit), "Add to PATH" ticked | backend (FastAPI) | `python --version` |
| — or Anaconda / Miniconda | any recent | only if you keep Python in a conda env (e.g. `watsonx`) | `conda --version` |
| Node.js | 20 LTS (18 minimum) — includes npm 10 | frontend (Expo web) | `node --version` |
| PostgreSQL | 16 (14 minimum), with `psql` on PATH | `bisleri_ecosystem` database | `psql --version` |
| Git | 2.40+ | pull / push code | `git --version` |
| Browser | Chrome (latest) | the web app | — |

Network: the backend must reach the PostgreSQL server(s) in `.env` (`bisleri_ecosystem`,
`RPA_Automation`, `Bisleri_dashboard`, `Bisleri_01`). Package installs need internet
(or the company proxy) the first time.

## The three files (all in the repo root)

| File | Use it for | What it does |
|---|---|---|
| `setup.bat` | first time on a machine (or after a big pull) | checks the applications above, creates the Python environment, installs backend + frontend packages, creates `.env` files from the examples, optionally prepares the database and the first IT Admin |
| `start_local.bat` | anyone who cloned the repo, for development | starts the backend (auto-reload) and the Expo dev server in two windows. Works from **wherever the repo was cloned** — every path is taken from the folder the `.bat` file sits in |
| `start_prod.bat` | the production server | starts the backend (no reload, one worker so the scheduled jobs run once) and the web app, bound to `127.0.0.1` behind Nginx |

Ports and the Python environment are set at the top of each `.bat` file
(`BACKEND_PORT`, `FRONTEND_PORT`, `CONDA_ENV`). Leave `CONDA_ENV` empty to use
the `bisleri-backend\venv` that `setup.bat` creates, or set it to your conda
environment name (for example `watsonx`).

## Database changes (26–27 Nov 2026)

Two Alembic migrations, run from `bisleri-backend`:

```
alembic upgrade b9e4d2a7c1f5   # audit trail, last-seen, Security Settings, alerts
alembic upgrade head           # + password policy status (a7c3e5d1f9b2) + Blinkit Inventory Portal
python scripts/load_inventory_masters.py --items FG_Item_Master.xlsx --stores Blinkit_Stores.xlsx
```

Each migration has a `downgrade`. Fresh databases get everything from
`DB Schemas/schema_bisleri_ecosystem.sql` via `scripts/init_db.py`.

## Backend .env lines added on 27 Nov 2026

```
ENFORCE_PASSWORD_POLICY=false
PSD_FOLDER=D:\Bisleri Ops Hub\1_Documents\Process Solution Documents
GUIDES_FOLDER=D:\Bisleri Ops Hub\1_Documents\User Guides
```
