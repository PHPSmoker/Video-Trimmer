from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
BIN_DIR = ROOT_DIR / "bin"

SUPPORTED_VIDEO_EXTS = {
    ".mp4",
    ".mkv",
    ".mov",
    ".webm",
    ".avi",
    ".m4v",
    ".flv",
    ".ts",
    ".mts",
    ".m2ts",
    ".wmv",
}

SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0


def get_ffmpeg_path() -> str:
    local = BIN_DIR / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if local.exists():
        return str(local)
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise FileNotFoundError(
        "Nie znaleziono FFmpeg. Umieść ffmpeg.exe w folderze bin/ lub zainstaluj FFmpeg w PATH."
    )


def get_ffprobe_path() -> str:
    local = BIN_DIR / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if local.exists():
        return str(local)
    found = shutil.which("ffprobe")
    if found:
        return found
    raise FileNotFoundError(
        "Nie znaleziono FFprobe. Umieść ffprobe.exe w folderze bin/ lub zainstaluj FFmpeg w PATH."
    )


@dataclass
class VideoMetadata:
    duration: float
    width: int
    height: int
    fps: float
    video_codec: str
    audio_codec: Optional[str]
    audio_tracks: int
    bitrate: int
    size_bytes: int
    format_name: str
    pix_fmt: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _parse_fps(rate_str: str) -> float:
    if not rate_str or rate_str in ("0/0", "N/A"):
        return 0.0
    if "/" in rate_str:
        num_s, den_s = rate_str.split("/", 1)
        try:
            num, den = float(num_s), float(den_s)
            return round(num / den, 2) if den > 0 else 0.0
        except ValueError:
            return 0.0
    try:
        return round(float(rate_str), 2)
    except ValueError:
        return 0.0


def probe_video(file_path: str | Path) -> VideoMetadata:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Plik nie istnieje: {path}")

    cmd = [
        get_ffprobe_path(),
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    res = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=SUBPROCESS_FLAGS,
        timeout=20,
    )
    if res.returncode != 0:
        raise RuntimeError(f"FFprobe error dla {path.name}: {res.stderr.strip()}")

    data = json.loads(res.stdout or "{}")
    fmt = data.get("format", {})
    streams = data.get("streams", [])

    v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    a_streams = [s for s in streams if s.get("codec_type") == "audio"]

    if v_stream is None:
        raise ValueError(f"Plik {path.name} nie zawiera strumienia wideo.")

    duration = 0.0
    for candidate in (fmt.get("duration"), v_stream.get("duration")):
        if candidate is not None and candidate != "N/A":
            try:
                val = float(candidate)
                if val > 0:
                    duration = val
                    break
            except (TypeError, ValueError):
                pass

    fps = _parse_fps(v_stream.get("avg_frame_rate") or v_stream.get("r_frame_rate") or "0/1")
    if fps <= 0:
        fps = _parse_fps(v_stream.get("r_frame_rate") or "0/1")

    bitrate = 0
    try:
        bitrate = int(fmt.get("bit_rate") or v_stream.get("bit_rate") or 0)
    except (TypeError, ValueError):
        bitrate = 0

    return VideoMetadata(
        duration=round(duration, 3),
        width=int(v_stream.get("width") or 0),
        height=int(v_stream.get("height") or 0),
        fps=fps,
        video_codec=str(v_stream.get("codec_name") or "unknown").upper(),
        audio_codec=(
            str(a_streams[0].get("codec_name") or "").upper() if a_streams else None
        ),
        audio_tracks=len(a_streams),
        bitrate=bitrate,
        size_bytes=path.stat().st_size,
        format_name=str(fmt.get("format_name") or path.suffix.lstrip(".")),
        pix_fmt=v_stream.get("pix_fmt"),
    )


def get_keyframes(file_path: str | Path) -> List[float]:
    """Fast packet-level keyframe extraction (does not decode video frames)."""
    cmd = [
        get_ffprobe_path(),
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "packet=pts_time,dts_time,flags",
        "-of",
        "csv=p=0",
        str(file_path),
    ]
    res = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=SUBPROCESS_FLAGS,
        timeout=25,
    )
    if res.returncode != 0:
        return []

    keyframes: List[float] = []
    for line in res.stdout.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 3:
            continue
        pts_s, dts_s, flags = parts[0], parts[1], parts[2]
        if "K" not in flags:
            continue
        ts_str = pts_s if pts_s and pts_s != "N/A" else dts_s
        try:
            t = round(float(ts_str), 3)
            if t >= 0:
                keyframes.append(t)
        except ValueError:
            continue

    # Deduplicate and sort
    return sorted(set(keyframes))


def snap_to_keyframe(target_start: float, keyframes: List[float]) -> float:
    """Snap start timestamp to nearest preceding keyframe (with tiny forward tolerance)."""
    if not keyframes:
        return max(0.0, target_start)
    best = 0.0
    for kf in keyframes:
        if kf <= target_start + 0.06:
            best = kf
        else:
            break
    return round(max(0.0, best), 3)


def generate_thumbnail(
    file_path: str | Path, out_path: str | Path, timestamp: float = 1.0
) -> bool:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    ts = max(0.0, timestamp)
    cmd = [
        get_ffmpeg_path(),
        "-y",
        "-ss",
        f"{ts:.3f}",
        "-i",
        str(file_path),
        "-frames:v",
        "1",
        "-vf",
        "scale=320:-2:flags=fast_bilinear",
        "-q:v",
        "4",
        str(out),
    ]
    res = subprocess.run(
        cmd,
        capture_output=True,
        creationflags=SUBPROCESS_FLAGS,
        timeout=15,
    )
    if res.returncode == 0 and out.exists() and out.stat().st_size > 0:
        return True

    # Fallback at 0.0s for very short videos
    if ts > 0:
        cmd[3] = "0.000"
        res = subprocess.run(
            cmd,
            capture_output=True,
            creationflags=SUBPROCESS_FLAGS,
            timeout=15,
        )
        return res.returncode == 0 and out.exists() and out.stat().st_size > 0
    return False


def generate_filmstrip(
    file_path: str | Path,
    duration: float,
    out_path: str | Path,
    count: int = 8,
) -> bool:
    """Generate a horizontal filmstrip using fast input seeking per frame."""
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    if duration <= 0.2:
        return generate_thumbnail(file_path, out, 0.0)

    count = max(2, min(count, 12))
    step = duration / count
    timestamps = [round(min(duration - 0.05, (i + 0.5) * step), 3) for i in range(count)]

    cmd = [get_ffmpeg_path(), "-y"]
    for ts in timestamps:
        cmd.extend(["-ss", f"{max(0.0, ts):.3f}", "-i", str(file_path)])

    filter_parts = []
    labels = []
    for i in range(count):
        filter_parts.append(
            f"[{i}:v]scale=160:90:force_original_aspect_ratio=increase,crop=160:90[v{i}]"
        )
        labels.append(f"[v{i}]")
    filter_complex = ";".join(filter_parts) + f";{''.join(labels)}hstack=inputs={count}"

    cmd.extend(
        [
            "-filter_complex",
            filter_complex,
            "-frames:v",
            "1",
            "-q:v",
            "5",
            str(out),
        ]
    )

    res = subprocess.run(
        cmd,
        capture_output=True,
        creationflags=SUBPROCESS_FLAGS,
        timeout=25,
    )
    return res.returncode == 0 and out.exists() and out.stat().st_size > 0


def build_unique_output_path(
    input_path: Path,
    output_dir: Optional[Path],
    suffix: str = "_cut",
    overwrite: bool = False,
) -> Path:
    dest_dir = output_dir if output_dir else (input_path.parent / "Przyciete")
    dest_dir.mkdir(parents=True, exist_ok=True)

    stem = input_path.stem
    ext = input_path.suffix or ".mp4"
    clean_suffix = suffix if suffix is not None else "_cut"
    candidate = dest_dir / f"{stem}{clean_suffix}{ext}"

    # Never overwrite the source file itself
    if candidate.resolve() == input_path.resolve():
        candidate = dest_dir / f"{stem}_cut{ext}"

    if overwrite:
        return candidate

    counter = 1
    while candidate.exists():
        candidate = dest_dir / f"{stem}{clean_suffix}_{counter}{ext}"
        counter += 1
    return candidate


def trim_video(
    input_path: str | Path,
    output_path: str | Path,
    start: float,
    end: float,
    mode: str = "lossless",
    snap_kf: bool = False,
    keyframes: Optional[List[float]] = None,
) -> dict:
    """
    Trim a video file cleanly.
    - mode == 'lossless': 100% bit-for-bit stream copy (-c copy), zero quality loss.
    - mode == 'precise': Frame-exact cut with visually lossless CRF 15 video & lossless audio copy.
    """
    src = Path(input_path)
    dst = Path(output_path)
    dst.parent.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    start = max(0.0, float(start))
    end = max(start + 0.1, float(end))

    effective_start = start
    if mode == "lossless" and snap_kf:
        kfs = keyframes if keyframes is not None else get_keyframes(src)
        effective_start = snap_to_keyframe(start, kfs)

    effective_duration = max(0.1, end - effective_start)
    ext = dst.suffix.lower()
    is_mp4_like = ext in (".mp4", ".m4v", ".mov")

    cmd = [
        get_ffmpeg_path(),
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{effective_start:.3f}",
        "-i",
        str(src),
        "-t",
        f"{effective_duration:.3f}",
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
    ]

    if mode == "lossless":
        cmd.extend(
            [
                "-c",
                "copy",
                "-avoid_negative_ts",
                "make_zero",
            ]
        )
        if is_mp4_like:
            cmd.extend(["-movflags", "+faststart"])
    else:
        # Visually lossless frame-accurate re-encode, keeping original audio untouched
        if ext == ".webm":
            cmd.extend(
                [
                    "-c:v",
                    "libvpx-vp9",
                    "-crf",
                    "18",
                    "-b:v",
                    "0",
                    "-row-mt",
                    "1",
                    "-c:a",
                    "copy",
                ]
            )
        else:
            cmd.extend(
                [
                    "-c:v",
                    "libx264",
                    "-crf",
                    "15",
                    "-preset",
                    "fast",
                    "-c:a",
                    "copy",
                ]
            )
            if is_mp4_like:
                cmd.extend(["-movflags", "+faststart"])

    cmd.append(str(dst))

    res = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=SUBPROCESS_FLAGS,
        timeout=300,
    )

    # Edge-case fallback: if precise audio copy fails due to incompatible audio codec in container
    if res.returncode != 0 and mode == "precise":
        fallback_cmd = [c if c != "copy" else "aac" for c in cmd]
        res = subprocess.run(
            fallback_cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=SUBPROCESS_FLAGS,
            timeout=300,
        )

    if res.returncode != 0 or not dst.exists():
        raise RuntimeError(
            f"Błąd FFmpeg podczas przycinania {src.name}: {res.stderr.strip() or 'nieznany błąd'}"
        )

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    in_size = src.stat().st_size
    out_size = dst.stat().st_size

    # Probe resulting duration quickly
    actual_dur = round(effective_duration, 2)
    try:
        out_meta = probe_video(dst)
        actual_dur = out_meta.duration
    except Exception:
        pass

    return {
        "output_path": str(dst),
        "output_name": dst.name,
        "input_size": in_size,
        "output_size": out_size,
        "saved_bytes": max(0, in_size - out_size),
        "effective_start": round(effective_start, 3),
        "actual_duration": round(actual_dur, 2),
        "elapsed_ms": elapsed_ms,
        "mode": mode,
    }
