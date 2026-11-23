from __future__ import annotations

import asyncio
import hashlib
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.video_engine import (
    ROOT_DIR,
    SUBPROCESS_FLAGS,
    SUPPORTED_VIDEO_EXTS,
    build_unique_output_path,
    detect_best_moments,
    generate_filmstrip,
    generate_thumbnail,
    generate_waveform_peaks,
    get_ffmpeg_path,
    get_keyframes,
    move_files_to_recycle_bin,
    probe_video,
    trim_video,
)

STATIC_DIR = ROOT_DIR / "static"
CACHE_DIR = ROOT_DIR / ".cache"
MEDIA_CACHE_DIR = CACHE_DIR / "media"
UPLOAD_CACHE_DIR = CACHE_DIR / "uploads"
SESSION_FILE = CACHE_DIR / "session.json"

MEDIA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="EventCut Studio API", version="1.1.0")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# In-memory state (local single-user desktop studio)
CLIPS_LOCK = threading.Lock()
CLIPS: Dict[str, Dict[str, Any]] = {}
KEYFRAME_CACHE: Dict[str, List[float]] = {}
JOBS_LOCK = threading.Lock()
JOBS: Dict[str, Dict[str, Any]] = {}
SESSION_LOCK = threading.Lock()

LAST_BROWSE_DIR: Optional[str] = None


def _file_fingerprint(path: Path) -> str:
    st = path.stat()
    raw = f"{path.resolve()}|{st.st_size}|{st.st_mtime_ns}".encode("utf-8", errors="ignore")
    return hashlib.sha1(raw).hexdigest()[:16]


def _register_single_video(file_path: Path, is_uploaded: bool = False) -> Optional[Dict[str, Any]]:
    resolved = file_path.resolve()
    if not resolved.exists() or not resolved.is_file():
        return None
    if resolved.suffix.lower() not in SUPPORTED_VIDEO_EXTS:
        return None

    with CLIPS_LOCK:
        for existing in CLIPS.values():
            if existing["path"].lower() == str(resolved).lower():
                return existing

    meta = probe_video(resolved)
    clip_id = uuid.uuid4().hex[:12]
    fp = _file_fingerprint(resolved)

    # Default smart trim: last 5s (or full duration if shorter than 5s)
    default_dur = min(5.0, meta.duration) if meta.duration > 0 else 5.0
    default_start = round(max(0.0, meta.duration - default_dur), 3)
    default_end = round(meta.duration, 3)

    record = {
        "id": clip_id,
        "fingerprint": fp,
        "name": resolved.name,
        "path": str(resolved),
        "dir": str(resolved.parent),
        "ext": resolved.suffix.lower(),
        "is_uploaded": is_uploaded,
        "meta": meta.to_dict(),
        "default_start": default_start,
        "default_end": default_end,
    }

    with CLIPS_LOCK:
        CLIPS[clip_id] = record
    return record


def _register_many(paths: List[Path], is_uploaded: bool = False) -> tuple[List[Dict[str, Any]], List[str]]:
    added: List[Dict[str, Any]] = []
    errors: List[str] = []

    valid_paths = [p for p in paths if p.exists() and p.is_file() and p.suffix.lower() in SUPPORTED_VIDEO_EXTS]
    if not valid_paths:
        return added, errors

    with ThreadPoolExecutor(max_workers=min(8, len(valid_paths))) as pool:
        future_map = {pool.submit(_register_single_video, p, is_uploaded): p for p in valid_paths}
        results_by_path: Dict[Path, Dict[str, Any]] = {}
        for fut in as_completed(future_map):
            src = future_map[fut]
            try:
                rec = fut.result()
                if rec:
                    results_by_path[src] = rec
            except Exception as exc:
                errors.append(f"{src.name}: {exc}")

    # Keep natural original order
    for p in valid_paths:
        if p in results_by_path:
            added.append(results_by_path[p])

    return added, errors


def _run_win_dialog(mode: str, initial_dir: Optional[str] = None, lang: str = "pl") -> Any:
    safe_lang = "en" if lang == "en" else "pl"
    cmd = [sys.executable, "-m", "app.win_dialogs", mode, safe_lang]
    if initial_dir and Path(initial_dir).exists():
        cmd.append(initial_dir)

    res = subprocess.run(
        cmd,
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=SUBPROCESS_FLAGS,
        timeout=300,
    )
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or "Nie udało się otworzyć okna dialogowego Windows.")
    out = res.stdout.strip()
    return json.loads(out) if out else None


# ── Models ───────────────────────────────────────────────────────────────────

class AddPathsRequest(BaseModel):
    paths: List[str]


class ExportClipItem(BaseModel):
    clip_id: str
    start: float = Field(ge=0.0)
    end: float = Field(gt=0.0)


class ExportStartRequest(BaseModel):
    items: List[ExportClipItem]
    mode: str = Field(default="lossless", pattern="^(lossless|smart|precise)$")
    snap_keyframe: bool = False
    output_dir: Optional[str] = None
    use_source_subfolder: bool = True
    subfolder_name: str = "Przyciete"
    suffix: str = "_cut"
    overwrite: bool = False


class SessionClipState(BaseModel):
    path: str
    start: float = Field(ge=0.0)
    end: float = Field(gt=0.0)
    selected: bool = True
    reviewed: bool = False


class SessionSaveRequest(BaseModel):
    clips: List[SessionClipState] = Field(default_factory=list)
    active_path: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class BestMomentsBatchRequest(BaseModel):
    clip_ids: List[str]
    target_duration: float = Field(default=5.0, gt=0.1, le=600.0)


class OpenFolderRequest(BaseModel):
    path: str


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health_check() -> dict:
    ffmpeg_ok = False
    ffmpeg_version = ""
    try:
        ff = get_ffmpeg_path()
        res = subprocess.run(
            [ff, "-version"],
            capture_output=True,
            text=True,
            creationflags=SUBPROCESS_FLAGS,
            timeout=5,
        )
        if res.returncode == 0:
            ffmpeg_ok = True
            ffmpeg_version = res.stdout.splitlines()[0] if res.stdout else "FFmpeg OK"
    except Exception as exc:
        ffmpeg_version = str(exc)

    return {
        "status": "ok",
        "ffmpeg_ok": ffmpeg_ok,
        "ffmpeg_version": ffmpeg_version,
        "default_output_dir": str(ROOT_DIR / "Eksport"),
    }


@app.get("/api/clips")
def list_clips() -> dict:
    with CLIPS_LOCK:
        return {"clips": list(CLIPS.values())}


@app.delete("/api/clips/{clip_id}")
def delete_clip(clip_id: str) -> dict:
    with CLIPS_LOCK:
        removed = CLIPS.pop(clip_id, None)
    KEYFRAME_CACHE.pop(clip_id, None)
    if not removed:
        raise HTTPException(status_code=404, detail="Nie znaleziono klipu.")
    return {"deleted": clip_id}


@app.post("/api/clips/clear")
def clear_clips() -> dict:
    with CLIPS_LOCK:
        CLIPS.clear()
    KEYFRAME_CACHE.clear()
    return {"cleared": True}


@app.post("/api/dialogs/pick-files")
async def pick_files_dialog(lang: str = "pl") -> dict:
    global LAST_BROWSE_DIR
    loop = asyncio.get_running_loop()
    selected = await loop.run_in_executor(None, _run_win_dialog, "files", LAST_BROWSE_DIR, lang)
    if not selected:
        return {"clips": [], "errors": [], "cancelled": True}

    paths = [Path(p) for p in selected]
    if paths:
        LAST_BROWSE_DIR = str(paths[0].parent)

    added, errors = await loop.run_in_executor(None, _register_many, paths, False)
    return {"clips": added, "errors": errors, "cancelled": False}


@app.post("/api/dialogs/pick-folder")
async def pick_folder_dialog(lang: str = "pl") -> dict:
    global LAST_BROWSE_DIR
    loop = asyncio.get_running_loop()
    folder = await loop.run_in_executor(None, _run_win_dialog, "folder", LAST_BROWSE_DIR, lang)
    if not folder:
        return {"clips": [], "errors": [], "cancelled": True}

    folder_path = Path(folder)
    LAST_BROWSE_DIR = str(folder_path)
    video_files = sorted(
        [
            p
            for p in folder_path.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED_VIDEO_EXTS
        ],
        key=lambda x: x.name.lower(),
    )
    added, errors = await loop.run_in_executor(None, _register_many, video_files, False)
    return {"clips": added, "errors": errors, "folder": str(folder_path), "cancelled": False}


@app.post("/api/dialogs/pick-output-dir")
async def pick_output_dir_dialog(lang: str = "pl") -> dict:
    loop = asyncio.get_running_loop()
    folder = await loop.run_in_executor(None, _run_win_dialog, "output", LAST_BROWSE_DIR, lang)
    return {"path": folder or "", "cancelled": not bool(folder)}


@app.post("/api/files/add-paths")
async def add_paths(req: AddPathsRequest) -> dict:
    expanded: List[Path] = []
    for raw in req.paths:
        p = Path(raw.strip().strip('"'))
        if p.is_dir():
            expanded.extend(
                sorted(
                    [f for f in p.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_VIDEO_EXTS],
                    key=lambda x: x.name.lower(),
                )
            )
        elif p.is_file():
            expanded.append(p)

    loop = asyncio.get_running_loop()
    added, errors = await loop.run_in_executor(None, _register_many, expanded, False)
    return {"clips": added, "errors": errors}


@app.post("/api/files/upload")
async def upload_files(files: List[UploadFile] = File(...)) -> dict:
    saved_paths: List[Path] = []
    errors: List[str] = []

    for up in files:
        filename = Path(up.filename or "clip.mp4").name
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_VIDEO_EXTS:
            errors.append(f"{filename}: nieobsługiwany format wideo.")
            continue

        dest = UPLOAD_CACHE_DIR / filename
        if dest.exists():
            dest = UPLOAD_CACHE_DIR / f"{Path(filename).stem}_{uuid.uuid4().hex[:6]}{ext}"

        with dest.open("wb") as out_f:
            shutil.copyfileobj(up.file, out_f)
        saved_paths.append(dest)

    loop = asyncio.get_running_loop()
    added, probe_errors = await loop.run_in_executor(None, _register_many, saved_paths, True)
    return {"clips": added, "errors": errors + probe_errors}


def _get_clip_or_404(clip_id: str) -> Dict[str, Any]:
    with CLIPS_LOCK:
        clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Nie znaleziono klipu.")
    return clip


@app.get("/api/media/{clip_id}/thumb")
async def get_clip_thumb(clip_id: str) -> FileResponse:
    clip = _get_clip_or_404(clip_id)
    out_path = MEDIA_CACHE_DIR / f"{clip['fingerprint']}_thumb.jpg"
    if not out_path.exists():
        dur = float(clip["meta"].get("duration") or 0.0)
        ts = min(max(0.5, dur * 0.2), max(0.0, dur - 0.1)) if dur > 0 else 0.0
        loop = asyncio.get_running_loop()
        ok = await loop.run_in_executor(None, generate_thumbnail, clip["path"], out_path, ts)
        if not ok:
            raise HTTPException(status_code=404, detail="Nie udało się wygenerować miniatury.")
    return FileResponse(out_path, media_type="image/jpeg")


@app.get("/api/media/{clip_id}/filmstrip")
async def get_clip_filmstrip(clip_id: str) -> FileResponse:
    clip = _get_clip_or_404(clip_id)
    out_path = MEDIA_CACHE_DIR / f"{clip['fingerprint']}_strip.jpg"
    if not out_path.exists():
        dur = float(clip["meta"].get("duration") or 0.0)
        loop = asyncio.get_running_loop()
        ok = await loop.run_in_executor(None, generate_filmstrip, clip["path"], dur, out_path, 8)
        if not ok:
            raise HTTPException(status_code=404, detail="Nie udało się wygenerować podglądu osi czasu.")
    return FileResponse(out_path, media_type="image/jpeg")


@app.get("/api/media/{clip_id}/keyframes")
async def get_clip_keyframes(clip_id: str) -> dict:
    clip = _get_clip_or_404(clip_id)
    if clip_id not in KEYFRAME_CACHE:
        loop = asyncio.get_running_loop()
        kfs = await loop.run_in_executor(None, get_keyframes, clip["path"])
        KEYFRAME_CACHE[clip_id] = kfs
    return {"clip_id": clip_id, "keyframes": KEYFRAME_CACHE[clip_id]}


@app.get("/api/media/{clip_id}/waveform")
async def get_clip_waveform(clip_id: str) -> dict:
    clip = _get_clip_or_404(clip_id)
    if not clip["meta"].get("audio_tracks"):
        return {"clip_id": clip_id, "peaks": []}

    cache_path = MEDIA_CACHE_DIR / f"{clip['fingerprint']}_wave.json"
    if cache_path.exists():
        try:
            peaks = json.loads(cache_path.read_text(encoding="utf-8"))
            if isinstance(peaks, list):
                return {"clip_id": clip_id, "peaks": peaks}
        except Exception:
            pass

    dur = float(clip["meta"].get("duration") or 0.0)
    loop = asyncio.get_running_loop()
    peaks = await loop.run_in_executor(None, generate_waveform_peaks, clip["path"], dur, 800)
    try:
        cache_path.write_text(json.dumps(peaks), encoding="utf-8")
    except OSError:
        pass
    return {"clip_id": clip_id, "peaks": peaks}


def _get_or_detect_moments(clip: Dict[str, Any]) -> List[Dict[str, Any]]:
    cache_path = MEDIA_CACHE_DIR / f"{clip['fingerprint']}_moments_v3.json"
    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if isinstance(cached, list) and cached:
                return cached
        except Exception:
            pass

    dur = float(clip["meta"].get("duration") or 0.0)
    has_audio = bool(clip["meta"].get("audio_tracks"))

    moments = detect_best_moments(
        clip["path"],
        duration=dur,
        has_audio=has_audio,
        max_moments=3,
    )
    try:
        cache_path.write_text(json.dumps(moments), encoding="utf-8")
    except OSError:
        pass
    return moments


def _frame_window_around_peak(duration: float, peak_time: float, target_dur: float) -> tuple[float, float]:
    if duration <= 0.1:
        return 0.0, max(0.1, duration or target_dur)
    safe_dur = min(max(0.2, target_dur), duration)
    # Place peak at ~40% of the trim window (lead-in before action, payoff after)
    start = max(0.0, min(duration - safe_dur, peak_time - safe_dur * 0.4))
    end = min(duration, start + safe_dur)
    return round(start, 2), round(end, 2)


@app.get("/api/media/{clip_id}/best-moments")
async def get_clip_best_moments(clip_id: str) -> dict:
    clip = _get_clip_or_404(clip_id)
    loop = asyncio.get_running_loop()
    moments = await loop.run_in_executor(None, _get_or_detect_moments, clip)
    return {"clip_id": clip_id, "moments": moments}


@app.post("/api/clips/detect-best-moments")
async def detect_batch_best_moments(req: BestMomentsBatchRequest) -> dict:
    clips_to_run: List[Dict[str, Any]] = []
    with CLIPS_LOCK:
        for cid in req.clip_ids:
            c = CLIPS.get(cid)
            if c:
                clips_to_run.append(c)

    if not clips_to_run:
        return {"results": {}}

    def run_all() -> Dict[str, Any]:
        out: Dict[str, Any] = {}
        workers = min(4, len(clips_to_run))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            fmap = {pool.submit(_get_or_detect_moments, c): c for c in clips_to_run}
            for fut in as_completed(fmap):
                clip = fmap[fut]
                dur = float(clip["meta"].get("duration") or 0.0)
                try:
                    moments = fut.result()
                except Exception:
                    moments = [{"time": round(dur * 0.5, 2), "score": 0.5, "reason": "motion"}]
                peak_t = float(moments[0]["time"]) if moments else dur * 0.5
                s, e = _frame_window_around_peak(dur, peak_t, req.target_duration)
                out[clip["id"]] = {
                    "start": s,
                    "end": e,
                    "moments": moments,
                }
        return out

    loop = asyncio.get_running_loop()
    results = await loop.run_in_executor(None, run_all)
    return {"results": results}


# ── Session Auto-Save & Restore ──────────────────────────────────────────────

@app.post("/api/session/save")
def save_session(req: SessionSaveRequest) -> dict:
    payload = {
        "version": 1,
        "saved_at": time.time(),
        "active_path": req.active_path,
        "settings": req.settings,
        "clips": [c.model_dump() for c in req.clips],
    }
    with SESSION_LOCK:
        tmp = SESSION_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(SESSION_FILE)
    return {"saved": True, "count": len(req.clips)}


@app.get("/api/session/restore")
async def restore_session() -> dict:
    with SESSION_LOCK:
        if not SESSION_FILE.exists():
            return {"clips": [], "states_by_path": {}, "active_path": None, "settings": {}}
        try:
            data = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {"clips": [], "states_by_path": {}, "active_path": None, "settings": {}}

    raw_items = data.get("clips") or []
    states_by_path: Dict[str, Dict[str, Any]] = {}
    existing_paths: List[Path] = []
    for item in raw_items:
        raw_p = item.get("path")
        if not raw_p:
            continue
        p = Path(raw_p)
        if p.exists() and p.is_file() and p.suffix.lower() in SUPPORTED_VIDEO_EXTS:
            rp = p.resolve()
            existing_paths.append(rp)
            states_by_path[str(rp).lower()] = {
                "start": float(item.get("start", 0.0)),
                "end": float(item.get("end", 0.0)),
                "selected": bool(item.get("selected", True)),
                "reviewed": bool(item.get("reviewed", False)),
            }

    registered: List[Dict[str, Any]] = []
    if existing_paths:
        loop = asyncio.get_running_loop()
        registered, _ = await loop.run_in_executor(None, _register_many, existing_paths, False)

    return {
        "clips": registered,
        "states_by_path": states_by_path,
        "active_path": data.get("active_path"),
        "settings": data.get("settings") or {},
    }


@app.get("/api/media/{clip_id}/stream")
def stream_video(clip_id: str, request: Request):
    clip = _get_clip_or_404(clip_id)
    file_path = Path(clip["path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Plik źródłowy zniknął z dysku.")

    file_size = file_path.stat().st_size
    content_type, _ = mimetypes.guess_type(str(file_path))
    if not content_type:
        ext_map = {
            ".mp4": "video/mp4",
            ".m4v": "video/mp4",
            ".mov": "video/quicktime",
            ".webm": "video/webm",
            ".mkv": "video/x-matroska",
            ".avi": "video/x-msvideo",
        }
        content_type = ext_map.get(file_path.suffix.lower(), "application/octet-stream")

    range_header = request.headers.get("range")
    chunk_size = 1024 * 512  # 512 KB streaming chunks

    def iter_range(start_byte: int, end_byte: int):
        with file_path.open("rb") as f:
            f.seek(start_byte)
            remaining = end_byte - start_byte + 1
            while remaining > 0:
                data = f.read(min(chunk_size, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    if range_header and range_header.startswith("bytes="):
        range_spec = range_header.replace("bytes=", "").split(",")[0].strip()
        start_s, _, end_s = range_spec.partition("-")
        try:
            start_b = int(start_s) if start_s else 0
            end_b = int(end_s) if end_s else file_size - 1
        except ValueError:
            raise HTTPException(status_code=416, detail="Invalid Range header")

        if start_b >= file_size or start_b < 0:
            raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")
        end_b = min(end_b, file_size - 1)
        length = end_b - start_b + 1

        headers = {
            "Content-Range": f"bytes {start_b}-{end_b}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        }
        return StreamingResponse(
            iter_range(start_b, end_b),
            status_code=206,
            media_type=content_type,
            headers=headers,
        )

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
    }
    return StreamingResponse(
        iter_range(0, file_size - 1),
        status_code=200,
        media_type=content_type,
        headers=headers,
    )


# ── Batch Export Runner ──────────────────────────────────────────────────────

def _run_export_job(job_id: str, req: ExportStartRequest) -> None:
    t_start = time.perf_counter()
    max_workers = 3 if req.mode == "lossless" else 2

    def process_one(item: ExportClipItem) -> None:
        with CLIPS_LOCK:
            clip = CLIPS.get(item.clip_id)

        with JOBS_LOCK:
            job_item = JOBS[job_id]["items"][item.clip_id]
            job_item["status"] = "processing"

        if not clip:
            with JOBS_LOCK:
                job_item["status"] = "error"
                job_item["error"] = "Klip nie istnieje w sesji."
                JOBS[job_id]["failed"] += 1
                JOBS[job_id]["done"] += 1
            return

        try:
            src_path = Path(clip["path"])
            if req.output_dir and not req.use_source_subfolder:
                out_dir = Path(req.output_dir)
            else:
                if clip.get("is_uploaded"):
                    out_dir = ROOT_DIR / "Eksport"
                else:
                    sub = (req.subfolder_name or "Przyciete").strip() or "Przyciete"
                    out_dir = src_path.parent / sub

            out_path = build_unique_output_path(
                input_path=src_path,
                output_dir=out_dir,
                suffix=req.suffix,
                overwrite=req.overwrite,
            )

            need_kfs = req.snap_keyframe or req.mode == "smart"
            kfs = KEYFRAME_CACHE.get(item.clip_id) if need_kfs else None
            result = trim_video(
                input_path=src_path,
                output_path=out_path,
                start=item.start,
                end=item.end,
                mode=req.mode,
                snap_kf=req.snap_keyframe,
                keyframes=kfs,
            )

            can_recycle = (
                not clip.get("is_uploaded")
                and src_path.exists()
                and Path(result["output_path"]).exists()
                and src_path.resolve() != Path(result["output_path"]).resolve()
            )

            with JOBS_LOCK:
                job_item["status"] = "done"
                job_item["result"] = result
                job_item["can_recycle"] = can_recycle
                JOBS[job_id]["succeeded"] += 1
                JOBS[job_id]["done"] += 1
                JOBS[job_id]["saved_bytes"] += result["saved_bytes"]
                JOBS[job_id]["total_input_bytes"] += result["input_size"]
                JOBS[job_id]["total_output_bytes"] += result["output_size"]
                if can_recycle:
                    JOBS[job_id]["recyclable_count"] += 1
                    JOBS[job_id]["recyclable_bytes"] += result["input_size"]
                parent_str = str(Path(result["output_path"]).parent)
                if parent_str not in JOBS[job_id]["output_dirs"]:
                    JOBS[job_id]["output_dirs"].append(parent_str)
        except Exception as exc:
            with JOBS_LOCK:
                job_item["status"] = "error"
                job_item["error"] = str(exc)
                JOBS[job_id]["failed"] += 1
                JOBS[job_id]["done"] += 1

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(process_one, it) for it in req.items]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception:
                pass

    with JOBS_LOCK:
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["elapsed_ms"] = int((time.perf_counter() - t_start) * 1000)


@app.post("/api/export/start")
def start_export(req: ExportStartRequest) -> dict:
    if not req.items:
        raise HTTPException(status_code=400, detail="Brak filmów do wyeksportowania.")

    job_id = uuid.uuid4().hex[:10]
    items_state: Dict[str, Any] = {}
    with CLIPS_LOCK:
        for it in req.items:
            clip = CLIPS.get(it.clip_id)
            items_state[it.clip_id] = {
                "clip_id": it.clip_id,
                "name": clip["name"] if clip else it.clip_id,
                "source_path": clip["path"] if clip else None,
                "is_uploaded": bool(clip.get("is_uploaded")) if clip else True,
                "can_recycle": False,
                "start": it.start,
                "end": it.end,
                "status": "queued",
                "error": None,
                "result": None,
            }

    with JOBS_LOCK:
        JOBS[job_id] = {
            "job_id": job_id,
            "status": "running",
            "mode": req.mode,
            "total": len(req.items),
            "done": 0,
            "succeeded": 0,
            "failed": 0,
            "saved_bytes": 0,
            "total_input_bytes": 0,
            "total_output_bytes": 0,
            "recyclable_count": 0,
            "recyclable_bytes": 0,
            "recycled": False,
            "recycled_count": 0,
            "recycled_bytes": 0,
            "elapsed_ms": 0,
            "output_dirs": [],
            "items": items_state,
        }

    thread = threading.Thread(target=_run_export_job, args=(job_id, req), daemon=True)
    thread.start()
    return {"job_id": job_id}


@app.get("/api/export/status/{job_id}")
def export_status(job_id: str) -> dict:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Nie znaleziono zadania eksportu.")
        return json.loads(json.dumps(job))


@app.post("/api/export/recycle-originals/{job_id}")
async def recycle_export_originals(job_id: str) -> dict:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Nie znaleziono zadania eksportu.")
        if job["status"] != "completed":
            raise HTTPException(status_code=400, detail="Eksport jeszcze trwa.")
        if job.get("recycled"):
            return {
                "already_recycled": True,
                "moved_count": job.get("recycled_count", 0),
                "failed_count": 0,
                "freed_bytes": job.get("recycled_bytes", 0),
                "removed_clip_ids": [],
            }
        items_snapshot = list(job["items"].values())

    targets: List[Path] = []
    path_to_clip_id: Dict[str, str] = {}
    for it in items_snapshot:
        if it.get("status") != "done" or not it.get("can_recycle"):
            continue
        src_raw = it.get("source_path")
        res = it.get("result") or {}
        out_raw = res.get("output_path")
        if not src_raw or not out_raw:
            continue
        src_p = Path(src_raw)
        out_p = Path(out_raw)
        # Strict safety checks: never recycle unless output exists & is distinct from source
        if not src_p.exists() or not out_p.exists() or out_p.stat().st_size <= 0:
            continue
        if src_p.resolve() == out_p.resolve():
            continue
        resolved = src_p.resolve()
        targets.append(resolved)
        path_to_clip_id[str(resolved).lower()] = it["clip_id"]

    if not targets:
        raise HTTPException(
            status_code=400,
            detail="Brak oryginalnych plików kwalifikujących się do przeniesienia do Kosza.",
        )

    loop = asyncio.get_running_loop()
    recycle_res = await loop.run_in_executor(None, move_files_to_recycle_bin, targets)

    removed_clip_ids: List[str] = []
    with CLIPS_LOCK:
        for moved_str in recycle_res["moved"]:
            cid = path_to_clip_id.get(str(Path(moved_str).resolve()).lower())
            if cid:
                CLIPS.pop(cid, None)
                KEYFRAME_CACHE.pop(cid, None)
                removed_clip_ids.append(cid)

    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job:
            job["recycled"] = len(recycle_res["moved"]) > 0
            job["recycled_count"] = len(recycle_res["moved"])
            job["recycled_bytes"] = recycle_res["freed_bytes"]

    return {
        "already_recycled": False,
        "moved_count": len(recycle_res["moved"]),
        "failed_count": len(recycle_res["failed"]),
        "freed_bytes": recycle_res["freed_bytes"],
        "removed_clip_ids": removed_clip_ids,
    }


@app.post("/api/system/open-folder")
def open_folder(req: OpenFolderRequest) -> dict:
    p = Path(req.path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Folder nie istnieje.")
    target = p if p.is_dir() else p.parent
    try:
        if os.name == "nt":
            os.startfile(str(target))  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", str(target)])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Nie udało się otworzyć folderu: {exc}")
    return {"opened": str(target)}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("EVENTCUT_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
