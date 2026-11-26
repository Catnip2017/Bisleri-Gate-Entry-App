@echo off
REM ==========================================================================
REM  Bisleri Ops Hub - start for local development (26 Nov 2026)
REM  For anyone who cloned the repo: all paths come from THIS file's folder,
REM  so it works wherever the repo was cloned (C:\..., D:\..., any name).
REM  Opens two windows: backend (auto-reload) and Expo dev server.
REM ==========================================================================
setlocal EnableExtensions

REM ---- settings ------------------------------------------------------------
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=9001"
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
if not exist "%FRONTEND%\node_modules" (
  echo gate-entry-app\node_modules is missing - run setup.bat first.
  pause & exit /b 1
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

echo Starting Bisleri Ops Hub from %ROOT%
echo   Backend : http://localhost:%BACKEND_PORT%  (auto-reload)
echo   Frontend: http://localhost:%FRONTEND_PORT%  (Expo, press w for web)
echo.
echo Pending database changes? From bisleri-backend run:  alembic upgrade head
echo.

start "Ops Hub - backend" cmd /k "%ACTIVATE% && cd /d "%BACKEND%" && uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%"
start "Ops Hub - frontend" cmd /k "cd /d "%FRONTEND%" && npx expo start -c --port %FRONTEND_PORT%"
endlocal
