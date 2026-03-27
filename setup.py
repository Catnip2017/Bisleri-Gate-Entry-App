"""
Bisleri Gate Entry App — one-command setup.
Run: python setup.py
"""
import subprocess
import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DIVIDER = "=" * 56

def run(cmd, cwd=None):
    # shell=True required on Windows so npm.cmd / npx.cmd are found
    return subprocess.call(cmd, cwd=cwd, shell=True)

def main():
    print(DIVIDER)
    print("  Bisleri Gate Entry App — Setup")
    print(DIVIDER)

    # 1. Python packages (backend)
    backend_path = os.path.join(BASE_DIR, "bisleri-backend")
    deps_file    = os.path.join(backend_path, "requirements.txt")

    print("\n[1/3] Installing Python packages ...")
    if os.path.isfile(deps_file):
        result = run(f'"{sys.executable}" -m pip install -r "{deps_file}"')
        if result != 0:
            print("      FAILED — check pip is available.")
            sys.exit(result)
        print("      Done.")
    else:
        print("      requirements.txt not found — skipping.")

    # 2. Alembic migrations
    print("\n[2/3] Running database migrations (Alembic) ...")
    if os.path.isdir(backend_path):
        result = run(f'"{sys.executable}" -m alembic upgrade head', cwd=backend_path)
        if result != 0:
            print("      FAILED — make sure PostgreSQL is running and .env is configured.")
            print("      You can run migrations manually later:")
            print("        cd bisleri-backend && alembic upgrade head")
        else:
            print("      Done.")
    else:
        print("      /bisleri-backend folder not found — skipping.")

    # 3. Frontend npm packages (Expo / React Native)
    frontend_path = os.path.join(BASE_DIR, "gate-entry-app")
    print("\n[3/3] Installing frontend npm packages ...")
    if os.path.isdir(frontend_path):
        result = run("npm install --legacy-peer-deps", cwd=frontend_path)
        if result != 0:
            print("      FAILED — check Node.js / npm is installed.")
            sys.exit(result)
        print("      Done.")
    else:
        print("      /gate-entry-app folder not found — skipping.")

    print("\n" + DIVIDER)
    print("  Setup complete!")
    print()
    print("  ── LOCAL DEVELOPMENT ──────────────────────────────")
    print("  Backend  : cd bisleri-backend")
    print("             uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload")
    print()
    print("  Frontend : cd gate-entry-app")
    print("             npx expo start --port 8082 -c")
    print()
    print("  .env     : EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8001")
    print()
    print("  ── PRODUCTION (SERVER) ────────────────────────────")
    print("  Backend  : cd bisleri-backend")
    print("             uvicorn app.main:app --host 127.0.0.1 --port 8000")
    print()
    print("  Frontend : cd gate-entry-app")
    print("             npx expo start --port 8081")
    print()
    print("  .env     : EXPO_PUBLIC_API_URL=https://123.63.20.237:19000/api")
    print(DIVIDER + "\n")

if __name__ == "__main__":
    main()
