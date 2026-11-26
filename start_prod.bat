@echo off
REM ==========================================================================
REM  Bisleri Ops Hub - start on the PRODUCTION server (26 Nov 2026)
REM  Paths come from this file's folder. Nginx (TLS) forwards:
REM     /api/*  -> 127.0.0.1:%BACKEND_PORT%   (backend)
REM     /*      -> 127.0.0.1:%FRONTEND_PORT%  (web app)
REM  Backend runs WITHOUT --reload and with ONE worker, so the scheduled jobs
REM  (syncs, nightly dormant-account check) run exactly once.
REM ==========================================================================
setlocal EnableExtensions

REM ---- settings ------------------------------------------------------------
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=8081"
REM  CONDA_ENV empty = use bisleri-backend\venv; or e.g. set "CONDA_ENV=watsonx"
set "CONDA_ENV="
REM -------------------------------------------------------------------------

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\bisleri-backend"
set "FRONTEND=%ROOT%\gate-entry-app"

if not exist "%BACKEND%\.env" (
  echo bisleri-backend\.env is missing - run setup.bat first.
  pause & exit /b 1
)
findstr /i /r "^ENABLE_DOCS *= *true" "%BACKEND%\.env" >nul && (
  echo WARNING: ENABLE_DOCS=true in bisleri-backend\.env - API docs are exposed. Set it to false for production.
  echo.
)

if defined CONDA_ENV (
  set "ACTIVATE=call conda activate %CONDA_ENV%"
) else (
  if not exist "%BACKEND%\venv\Scripts\activate.bat" (
    echo bisleri-backend\venv is missing - run setup.bat first ^(or set CONDA_ENV in this file^).
    pause & exit /b 1
  )
  set "ACTIVATE=call "%BACKEND%\venv\Scripts\activate.bat""
)

echo Starting Bisleri Ops Hub (PRODUCTION) from %ROOT%
echo Database changes are NOT applied automatically - run "alembic upgrade head" yourself when a release needs it.
echo.

start "Ops Hub PROD - backend" cmd /k "%ACTIVATE% && cd /d "%BACKEND%" && uvicorn app.main:app --host 127.0.0.1 --port %BACKEND_PORT% --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1"
start "Ops Hub PROD - web app" cmd /k "cd /d "%FRONTEND%" && npx expo start --web --no-dev --minify --host localhost --port %FRONTEND_PORT%"
endlocal
