# app/routers/library.py - Documents section (27 Nov 2026): Process Solution
# Documents (IT Admin only) and User Guides (every signed-in user).
#
# The PDFs live in plain folders on the server, set in the backend .env:
#     PSD_FOLDER=D:\Bisleri Ops Hub\1_Documents\Process Solution Documents
#     GUIDES_FOLDER=D:\Bisleri Ops Hub\1_Documents\User Guides
# Adding or updating a document = copying the PDF into the folder. Only PDFs
# directly in the folder are listed; sub-folders (e.g. "Archive") are ignored.
#
# Naming: <Process_Name>_PSD_v<N>.pdf  ->  "Process Name", version "v<N>".
# If two versions of the same name are in the folder, only the highest shows.
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.auth import get_current_user
from app.config import settings
from app.models import UsersMaster
from app.utils.roles import normalize_roles

router = APIRouter(prefix="/library", tags=["Documents"])
IST = ZoneInfo("Asia/Kolkata")
KINDS = {"psd": ("PSD_FOLDER", "Process Solution Documents"), "guides": ("GUIDES_FOLDER", "User Guides")}
_NAME = re.compile(r"^(?P<name>.+?)(?:_(?:PSD|User_Guide|Guide))?_v(?P<ver>\d+(?:\.\d+)*)$", re.IGNORECASE)


def _folder(kind: str, user: UsersMaster) -> str:
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Unknown document list")
    if kind == "psd" and "itadmin" not in normalize_roles(user.role):
        raise HTTPException(status_code=403, detail="Process Solution Documents are available to IT Admin only")
    setting, label = KINDS[kind]
    folder = (getattr(settings, setting, "") or "").strip()
    if not folder or not os.path.isdir(folder):
        raise HTTPException(status_code=503, detail=f"The {label} folder is not set up on the server yet "
                                                    f"({setting} in the backend .env).")
    return os.path.realpath(folder)


def parse_name(filename: str) -> dict:
    stem = filename[:-4] if filename.lower().endswith(".pdf") else filename
    m = _NAME.match(stem)
    if m:
        name, ver = m.group("name"), m.group("ver")
    else:
        name, ver = stem, None
    return {"name": re.sub(r"[_]+", " ", name).strip(), "version": f"v{ver}" if ver else None}


def _ver_key(v):
    return tuple(int(x) for x in re.findall(r"\d+", v or "0"))


def list_folder(folder: str) -> list:
    latest = {}
    for f in os.listdir(folder):
        p = os.path.join(folder, f)
        if not f.lower().endswith(".pdf") or not os.path.isfile(p) or f.startswith(("~", ".")):
            continue
        info = parse_name(f)
        st = os.stat(p)
        row = {"file": f, **info, "size": st.st_size,
               "updated": datetime.fromtimestamp(st.st_mtime, IST).isoformat()}
        key = info["name"].lower()
        if key not in latest or _ver_key(row["version"]) > _ver_key(latest[key]["version"]):
            latest[key] = row
    return sorted(latest.values(), key=lambda r: r["name"].lower())


@router.get("/{kind}")
def list_documents(kind: str, current_user: UsersMaster = Depends(get_current_user)):
    return {"documents": list_folder(_folder(kind, current_user))}


@router.get("/{kind}/download")
def download_document(kind: str, file: str = Query(..., max_length=255),
                      current_user: UsersMaster = Depends(get_current_user)):
    folder = _folder(kind, current_user)
    # Only an exact name of a PDF that is directly in the folder is served —
    # no paths, no "..", nothing outside the folder.
    if file != os.path.basename(file) or "/" in file or "\\" in file or not file.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file name")
    if file not in os.listdir(folder):
        raise HTTPException(status_code=404, detail="Document not found")
    path = os.path.realpath(os.path.join(folder, file))
    if os.path.dirname(path) != folder or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(path, media_type="application/pdf", filename=file)
