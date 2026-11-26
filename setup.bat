@echo off
REM ==========================================================================
REM  Bisleri Ops Hub - first-time setup (26 Nov 2026)
REM  Run from anywhere: every path is taken from this file's own folder.
REM  See PREREQUISITES.md for the applications and versions needed.
REM ==========================================================================
setlocal EnableExtensions EnableDelayedExpansion

REM ---- settings ------------------------------------------------------------
REM  CONDA_ENV empty = use bisleri-backend\venv (created below).
REM  Set it (e.g. watsonx) to install into an existing conda environment.
set "CONDA_ENV="
REM -------------------------------------------------------------------------

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\bisleri-backend"
set "FRONTEND=%ROOT%\gate-entry-app"

echo ========================================================
echo   Bisleri Ops Hub - Setup
echo   Folder: %ROOT%
echo ========================================================
echo.
echo Prerequisites (see PREREQUISITES.md):
echo   Python 3.10-3.13 (or Anaconda), Node.js 20 LTS (18+), PostgreSQL 16 (14+), Git 2.40+
echo.
echo Checking what is installed ...
set "MISSING="
where python >nul 2>nul && (for /f "delims=" %%v in ('python --version 2^>^&1') do echo   [ok] %%v) || (echo   [!!] Python not found on PATH& set "MISSING=1")
where node   >nul 2>nul && (for /f "delims=" %%v in ('node --version 2^>^&1') do echo   [ok] Node.js %%v) || (echo   [!!] Node.js not found on PATH& set "MISSING=1")
where npm    >nul 2>nul && (for /f "delims=" %%v in ('npm --version 2^>^&1') do echo   [ok] npm %%v) || (echo   [!!] npm not found on PATH& set "MISSING=1")
where psql   >nul 2>nul && (for /f "delims=" %%v in ('psql --version 2^>^&1') do echo   [ok] %%v) || echo   [--] psql not on PATH ^(fine if PostgreSQL runs on another server^)
where git    >nul 2>nul && (for /f "delims=" %%v in ('git --version 2^>^&1') do echo   [ok] %%v) || echo   [--] Git not found ^(needed only to pull code^)
if defined CONDA_ENV (where conda >nul 2>nul && echo   [ok] conda found ^(env: %CONDA_ENV%^) || (echo   [!!] CONDA_ENV is set but conda is not on PATH& set "MISSING=1"))
echo.
if defined MISSING (
  echo Install the missing applications above, then run setup.bat again.
  pause
  exit /b 1
)

REM ---- 1. Python environment + backend packages -----------------------------
echo [1/4] Backend Python packages ...
if defined CONDA_ENV (
  call conda activate %CONDA_ENV% || (echo       Could not activate conda env %CONDA_ENV%& pause & exit /b 1)
) else (
  if not exist "%BACKEND%\venv\Scripts\activate.bat" (
    echo       Creating virtual environment bisleri-backend\venv ...
    python -m venv "%BACKEND%\venv" || (echo       FAILED to create venv& pause & exit /b 1)
  )
  call "%BACKEND%\venv\Scripts\activate.bat"
)
python -m pip install --upgrade pip >nul
python -m pip install -r "%BACKEND%\requirements.txt" || (echo       FAILED - see the messages above& pause & exit /b 1)
echo       Done.

REM ---- 2. Frontend packages ---------------------------------------------------
echo.
echo [2/4] Frontend packages (npm install) ...
pushd "%FRONTEND%"
call npm install --legacy-peer-deps || (popd & echo       FAILED - see the messages above& pause & exit /b 1)
popd
echo       Done.

REM ---- 3. .env files ------------------------------------------------------------
echo.
echo [3/4] Configuration files ...
set "NEED_ENV="
if not exist "%BACKEND%\.env" (
  copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
  echo       Created bisleri-backend\.env from .env.example - EDIT IT ^(DB_*, SECRET_KEY^).
  set "NEED_ENV=1"
) else echo       bisleri-backend\.env already exists - left as it is.
if not exist "%FRONTEND%\.env" (
  copy "%FRONTEND%\.env.example" "%FRONTEND%\.env" >nul
  echo       Created gate-entry-app\.env from .env.example - set EXPO_PUBLIC_API_URL.
  set "NEED_ENV=1"
) else echo       gate-entry-app\.env already exists - left as it is.
if defined NEED_ENV (
  echo.
  echo Fill in the new .env file^(s^), then run setup.bat again to prepare the database.
  pause
  exit /b 0
)

REM ---- 4. Database (optional) ---------------------------------------------------
echo.
echo [4/4] Database
echo       Creates the database if missing and loads the full schema ONLY when it has no tables.
echo       An existing database is never changed - use "alembic upgrade head" for that.
set /p DODB="      Prepare the database now? (Y/N): "
if /i "%DODB%"=="Y" (
  pushd "%BACKEND%"
  set "ADMINFLAG="
  set /p DOADMIN="      Also create the FIRST IT Admin (only works if none exists)? (Y/N): "
  if /i "!DOADMIN!"=="Y" set "ADMINFLAG=--create-admin"
  python scripts\init_db.py !ADMINFLAG!
  popd
)

echo.
echo ========================================================
echo   Setup finished. Start the app with start_local.bat
echo   (or start_prod.bat on the production server).
echo ========================================================
pause
endlocal
