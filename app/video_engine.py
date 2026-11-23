from __future__ import annotations

import array
import ctypes
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

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
            t = round(float(ts_str), 6)
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


def generate_waveform_peaks(
    file_path: str | Path,
    duration: float,
    max_bars: int = 800,
) -> List[float]:
    """
    Fast single-pass mono audio peak extraction for timeline waveform visualization.
    Returns normalized peak values in [0.0, 1.0]. Returns [] if file has no audio.
    """
    if duration <= 0.05:
        return []

    sample_rate = 2000
    cmd = [
        get_ffmpeg_path(),
        "-v",
        "error",
        "-i",
        str(file_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "s16le",
        "-",
    ]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            creationflags=SUBPROCESS_FLAGS,
            timeout=25,
        )
    except Exception:
        return []

    if res.returncode != 0 or not res.stdout:
        return []

    raw = res.stdout
    usable_len = len(raw) - (len(raw) % 2)
    if usable_len < 4:
        return []

    samples = array.array("h")
    samples.frombytes(raw[:usable_len])
    if sys.byteorder == "big":
        samples.byteswap()

    total_samples = len(samples)
    if total_samples == 0:
        return []

    target_bars = min(max_bars, max(120, int(duration * 20)))
    target_bars = min(target_bars, total_samples)
    step = total_samples / target_bars

    peaks: List[int] = []
    for i in range(target_bars):
        lo = int(i * step)
        hi = max(lo + 1, int((i + 1) * step))
        hi = min(hi, total_samples)
        peak = 0
        for s in samples[lo:hi]:
            a = -s if s < 0 else s
            if a > peak:
                peak = a
        peaks.append(peak)

    if not peaks:
        return []

    # Normalize against 99th percentile peak so a single loud click doesn't flatten the waveform
    sorted_peaks = sorted(peaks)
    p99_idx = min(len(sorted_peaks) - 1, int(len(sorted_peaks) * 0.99))
    norm_ref = max(sorted_peaks[p99_idx], sorted_peaks[-1] // 4, 1)

    return [round(min(1.0, p / norm_ref), 3) for p in peaks]


def _normalize_curve(values: List[float], percentile: float = 0.98) -> List[float]:
    if not values:
        return []
    sv = sorted(values)
    if sv[-1] <= 1e-6:
        return [0.0 for _ in values]
    lo = sv[int(len(sv) * 0.15)]
    hi = max(sv[min(len(sv) - 1, max(0, int(len(sv) * percentile)))], sv[-1] * 0.4, lo + 1e-6)
    return [min(1.0, max(0.0, (v - lo) / (hi - lo))) for v in values]


def detect_audio_rms_curve(
    file_path: str | Path,
    duration: float,
    n_bins: int,
) -> tuple[List[float], bool]:
    """
    Compute true RMS loudness + local surge curve from primary audio stream (0:a:0).
    Unlike raw peak amplitude, RMS does not saturate on constant loud game/music audio.
    """
    if duration <= 0.2 or n_bins <= 0:
        return [0.0] * max(1, n_bins), False

    cmd = [
        get_ffmpeg_path(),
        "-v",
        "error",
        "-i",
        str(file_path),
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "4000",
        "-f",
        "s16le",
        "-",
    ]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            creationflags=SUBPROCESS_FLAGS,
            timeout=25,
        )
    except Exception:
        return [0.0] * n_bins, False

    if res.returncode != 0 or len(res.stdout) < 4:
        return [0.0] * n_bins, False

    raw = res.stdout[: len(res.stdout) - (len(res.stdout) % 2)]
    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder == "big":
        samples.byteswap()
    if not samples:
        return [0.0] * n_bins, False

    raw_rms: List[float] = []
    step = len(samples) / n_bins
    for i in range(n_bins):
        lo = int(i * step)
        hi = max(lo + 1, min(len(samples), int((i + 1) * step)))
        sq = sum(x * x for x in samples[lo:hi]) / max(1, hi - lo)
        raw_rms.append(math.sqrt(sq) / 32768.0)

    if max(raw_rms) < 0.008 or (max(raw_rms) - min(raw_rms)) < 0.005:
        return [0.0] * n_bins, False

    # Emphasize sustained loudness + sudden surges over local ~±4s baseline
    radius = max(4, int(4.0 / 0.5))
    boosted: List[float] = []
    for i in range(n_bins):
        w_lo = max(0, i - radius)
        w_hi = min(n_bins, i + radius + 1)
        local_avg = sum(raw_rms[w_lo:w_hi]) / max(1, w_hi - w_lo)
        surge = max(0.0, raw_rms[i] - local_avg)
        boosted.append(0.65 * raw_rms[i] + 0.35 * (raw_rms[i] + surge * 2.5))

    return _normalize_curve(boosted, 0.98), True


def detect_visual_motion_curve(
    file_path: str | Path,
    duration: float,
    n_bins: int,
) -> tuple[List[float], bool]:
    """
    Fast low-res visual motion + scene-change scoring using FFmpeg scdet
    with -skip_frame noref for faster 60fps decoding.
    Caps isolated 1-frame scene cuts so menu/replay switches do not dominate sustained action.
    """
    if duration <= 0.2 or n_bins <= 0:
        return [0.0] * max(1, n_bins), False

    sample_fps = 2 if duration <= 180.0 else 1
    cmd = [
        get_ffmpeg_path(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-skip_frame",
        "noref",
        "-i",
        str(file_path),
        "-vf",
        f"fps={sample_fps},scale=160:90:flags=fast_bilinear,scdet=t=0,metadata=print:file=-",
        "-an",
        "-f",
        "null",
        "-",
    ]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=SUBPROCESS_FLAGS,
            timeout=35,
        )
    except Exception:
        return [0.0] * n_bins, False

    if res.returncode != 0 or not res.stdout:
        return [0.0] * n_bins, False

    mafd_bins = [0.0] * n_bins
    score_bins = [0.0] * n_bins
    cur_time: Optional[float] = None
    cur_mafd = 0.0
    cur_score = 0.0

    def commit_frame() -> None:
        if cur_time is None or cur_time < 0.0:
            return
        idx = min(n_bins - 1, max(0, int((cur_time / duration) * n_bins)))
        if cur_mafd > mafd_bins[idx]:
            mafd_bins[idx] = cur_mafd
        if cur_score > score_bins[idx]:
            score_bins[idx] = cur_score

    for line in res.stdout.splitlines():
        s = line.strip()
        if s.startswith("frame:"):
            commit_frame()
            cur_time = None
            cur_mafd = 0.0
            cur_score = 0.0
            if "pts_time:" in s:
                try:
                    t_part = s.split("pts_time:", 1)[1].split()[0]
                    cur_time = float(t_part)
                except ValueError:
                    cur_time = None
        elif s.startswith("lavfi.scd.mafd="):
            try:
                cur_mafd = float(s.split("=", 1)[1])
            except ValueError:
                pass
        elif s.startswith("lavfi.scd.score="):
            try:
                cur_score = float(s.split("=", 1)[1])
            except ValueError:
                pass
    commit_frame()

    # Suppress frame-0 initialization jump (black -> first frame)
    if n_bins > 2:
        mafd_bins[0] *= 0.15
        score_bins[0] *= 0.15

    # Prefer sustained visual motion (mafd) and cap single-frame hard camera cuts (score)
    raw_vis = [0.75 * mafd_bins[i] + 0.25 * min(score_bins[i], 35.0) for i in range(n_bins)]
    has_motion = max(raw_vis) > 0.2
    return _normalize_curve(raw_vis, 0.96), has_motion


def _event_recency_weight(pos_ratio: float, duration: float) -> float:
    """
    Gentle temporal prior for instant-replay / event clips (12s..120s):
    - Discounts very early clip start (often previous play / old replay)
    - Boosts the 62%..84% sweet spot (where users save clips 4-10s after the highlight)
    - Tapers down in the final 16% (where replay/killcam camera cuts & hotkey presses happen)
    For very short (<12s) or long (>120s) videos, remains flat (1.0).
    """
    if duration < 12.0 or duration > 120.0:
        return 1.0
    if pos_ratio < 0.12:
        return 0.55 + (pos_ratio / 0.12) * 0.17
    if pos_ratio < 0.62:
        return 0.72 + ((pos_ratio - 0.12) / 0.50) * 0.18
    if pos_ratio <= 0.84:
        return 1.24
    return 1.24 - ((pos_ratio - 0.84) / 0.16) * 0.74


def detect_best_moments(
    file_path: str | Path,
    duration: float,
    has_audio: bool = True,
    waveform_peaks: Optional[List[float]] = None,
    max_moments: int = 3,
) -> List[Dict[str, Any]]:
    """
    Detect the top 1..3 most exciting moments in a video by fusing:
    - True RMS audio loudness + sudden surge over local baseline (non-saturating)
    - Fast sustained visual motion + capped scene-change score (FFmpeg scdet)
    - Synergy bonus when both audio and visual motion peak simultaneously
    - 2.5s Gaussian smoothing to prefer real sustained action over 1-frame glitches
    - Gentle event-clip recency prior for 12s..120s replay clips
    Returns list of {"time": float, "score": float, "reason": "audio_motion"|"audio"|"motion"}.
    """
    if duration <= 0.5:
        return [{"time": round(duration * 0.5, 2), "score": 1.0, "reason": "motion"}]

    bin_sec = 0.5
    n_bins = max(4, int(round(duration / bin_sec)))

    # 1) True RMS audio energy + local surge curve
    audio_curve = [0.0] * n_bins
    has_dynamic_audio = False
    if has_audio:
        audio_curve, has_dynamic_audio = detect_audio_rms_curve(file_path, duration, n_bins)

    # 2) Fast visual motion / scene change curve
    motion_curve, has_motion = detect_visual_motion_curve(file_path, duration, n_bins)

    # 3) Fuse curves cleanly with audio+motion synergy bonus
    combined = [0.0] * n_bins
    for i in range(n_bins):
        if has_dynamic_audio and has_motion:
            combined[i] = (
                0.55 * audio_curve[i]
                + 0.45 * motion_curve[i]
                + 0.15 * min(audio_curve[i], motion_curve[i])
            )
        elif has_dynamic_audio:
            combined[i] = audio_curve[i]
        elif has_motion:
            combined[i] = motion_curve[i]
        else:
            combined[i] = 0.5

    # 5-bin Gaussian smoothing (~2.5s sustained action window) + gentle recency prior
    kernel = (0.10, 0.22, 0.36, 0.22, 0.10)
    smoothed = [0.0] * n_bins
    for i in range(n_bins):
        acc = 0.0
        wsum = 0.0
        for k_idx, kw in enumerate(kernel):
            j = i + k_idx - 2
            if 0 <= j < n_bins:
                acc += combined[j] * kw
                wsum += kw
        pos_ratio = (i + 0.5) / n_bins
        smoothed[i] = (acc / wsum) * _event_recency_weight(pos_ratio, duration)

    # Slight edge attenuation on very first 0.5s (intro/fade-in)
    if n_bins > 4:
        smoothed[0] *= 0.6

    # 4) Greedy non-maximum suppression for Top K distinct moments
    min_gap_sec = max(2.5, min(6.0, duration * 0.18))
    min_gap_bins = max(1, int(round(min_gap_sec / bin_sec)))
    ranked_indices = sorted(range(n_bins), key=lambda idx: smoothed[idx], reverse=True)

    chosen: List[int] = []
    for idx in ranked_indices:
        if len(chosen) >= max_moments:
            break
        if all(abs(idx - c) >= min_gap_bins for c in chosen):
            chosen.append(idx)

    if not chosen:
        chosen = [n_bins // 2]

    max_score = max((smoothed[i] for i in chosen), default=1.0) or 1.0
    moments: List[Dict[str, Any]] = []
    for idx in chosen:
        t_sec = round(min(duration, max(0.0, (idx + 0.5) * (duration / n_bins))), 2)
        a_v = audio_curve[idx] if has_dynamic_audio else 0.0
        m_v = motion_curve[idx] if has_motion else 0.0
        if has_dynamic_audio and has_motion and a_v > 0.35 and m_v > 0.35:
            reason = "audio_motion"
        elif a_v >= m_v and has_dynamic_audio:
            reason = "audio"
        else:
            reason = "motion"

        moments.append(
            {
                "time": t_sec,
                "score": round(min(1.0, smoothed[idx] / max_score), 3),
                "reason": reason,
            }
        )

    return moments


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


def _probe_smart_cut_info(file_path: Path) -> Dict[str, Any]:
    cmd = [
        get_ffprobe_path(),
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate:format=format_name",
        "-of",
        "json",
        str(file_path),
    ]
    res = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=SUBPROCESS_FLAGS,
        timeout=15,
    )
    if res.returncode != 0:
        return {}
    try:
        data = json.loads(res.stdout or "{}")
    except json.JSONDecodeError:
        return {}
    streams = data.get("streams") or []
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    fmt = data.get("format") or {}
    return {
        "codec_name": str(v.get("codec_name") or "").lower(),
        "profile": str(v.get("profile") or "").lower(),
        "pix_fmt": str(v.get("pix_fmt") or "yuv420p"),
        "format_name": str(fmt.get("format_name") or "").lower(),
        "has_audio": has_audio,
    }


def _smart_cut_video(
    src: Path,
    dst: Path,
    start: float,
    end: float,
    keyframes: Optional[List[float]],
    is_mp4_like: bool,
) -> Optional[Dict[str, Any]]:
    """
    Hybrid frame-exact Smart Cut:
    Re-encodes ONLY the tiny leading GOP [start, next_keyframe) and bit-for-bit
    stream-copies [next_keyframe, end], muxing original continuous audio losslessly.
    Returns strategy metadata dict on success, or None if fallback to full precise is needed.
    """
    kfs = keyframes if keyframes is not None else get_keyframes(src)
    total_dur = max(0.1, end - start)
    kf_eps = 0.04

    # Case 1: Start is already right on a keyframe -> pure 100% lossless copy!
    if start <= kf_eps or any(abs(kf - start) <= kf_eps for kf in kfs):
        return {
            "strategy": "pure_copy",
            "copied_pct": 100,
            "reencoded_sec": 0.0,
        }

    # Find first keyframe strictly after `start`
    next_kf = next((kf for kf in kfs if kf > start + kf_eps), None)
    if next_kf is None or next_kf >= end - 0.12:
        # Entire selection lies inside a single GOP -> caller runs standard precise cut
        return None

    info = _probe_smart_cut_info(src)
    codec = info.get("codec_name", "")
    ext = dst.suffix.lower()
    if codec not in ("h264", "hevc") or ext in (".webm", ".avi", ".wmv"):
        return None

    head_dur = max(0.04, next_kf - start)
    tail_dur = max(0.05, end - next_kf)
    pix_fmt = info.get("pix_fmt") or "yuv420p"
    is_ts_source = "mpegts" in info.get("format_name", "") or src.suffix.lower() in (
        ".ts",
        ".mts",
        ".m2ts",
    )

    ff = get_ffmpeg_path()

    with tempfile.TemporaryDirectory(prefix="eventcut_sc_") as tmp_str:
        tmp = Path(tmp_str)
        head_ts = tmp / "head.ts"
        tail_ts = tmp / "tail.ts"
        concat_list = tmp / "list.txt"

        # 1) Encode ONLY the short leading GOP [start, next_kf)
        pre_seek = max(0.0, start - 2.0)
        fine_seek = max(0.0, start - pre_seek)
        head_cmd = [
            ff,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{pre_seek:.6f}",
            "-i",
            str(src),
            "-ss",
            f"{fine_seek:.6f}",
            "-t",
            f"{head_dur:.6f}",
            "-map",
            "0:v:0",
            "-an",
        ]

        if codec == "h264":
            head_cmd.extend(
                [
                    "-c:v",
                    "libx264",
                    "-crf",
                    "15",
                    "-preset",
                    "fast",
                    "-pix_fmt",
                    pix_fmt,
                    "-x264-params",
                    "aud=1",
                ]
            )
            prof_map = {
                "baseline": "baseline",
                "constrained baseline": "baseline",
                "main": "main",
                "high": "high",
                "high 10": "high10",
            }
            matched_prof = prof_map.get(info.get("profile", ""))
            if matched_prof:
                head_cmd.extend(["-profile:v", matched_prof])
        else:
            head_cmd.extend(
                [
                    "-c:v",
                    "libx265",
                    "-crf",
                    "17",
                    "-preset",
                    "fast",
                    "-pix_fmt",
                    pix_fmt,
                    "-x265-params",
                    "aud=1:log-level=error",
                ]
            )

        head_cmd.extend(
            [
                "-muxdelay",
                "0",
                "-muxpreload",
                "0",
                "-f",
                "mpegts",
                str(head_ts),
            ]
        )

        r_head = subprocess.run(
            head_cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=SUBPROCESS_FLAGS,
            timeout=120,
        )
        if r_head.returncode != 0 or not head_ts.exists() or head_ts.stat().st_size == 0:
            return None

        # 2) Bit-for-bit stream copy the tail [next_kf, end]
        # Adding +0.0005s ensures input-seeking lands on next_kf rather than jumping back to previous KF
        tail_cmd = [
            ff,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{next_kf + 0.0005:.6f}",
            "-i",
            str(src),
            "-t",
            f"{tail_dur:.6f}",
            "-map",
            "0:v:0",
            "-an",
            "-c:v",
            "copy",
        ]
        if not is_ts_source:
            bsf = "h264_mp4toannexb" if codec == "h264" else "hevc_mp4toannexb"
            tail_cmd.extend(["-bsf:v", bsf])

        tail_cmd.extend(
            [
                "-muxdelay",
                "0",
                "-muxpreload",
                "0",
                "-f",
                "mpegts",
                str(tail_ts),
            ]
        )

        r_tail = subprocess.run(
            tail_cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=SUBPROCESS_FLAGS,
            timeout=120,
        )
        if r_tail.returncode != 0 or not tail_ts.exists() or tail_ts.stat().st_size == 0:
            return None

        # 3) Extract continuous original audio accurately (zero negative PTS / seam pops)
        has_audio = bool(info.get("has_audio"))
        aud_mka = tmp / "aud.mka"
        audio_ready = False
        if has_audio:
            aud_cmd = [
                ff,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{pre_seek:.6f}",
                "-i",
                str(src),
                "-ss",
                f"{fine_seek:.6f}",
                "-t",
                f"{total_dur:.6f}",
                "-vn",
                "-map",
                "0:a?",
                "-c:a",
                "copy",
                str(aud_mka),
            ]
            r_aud = subprocess.run(
                aud_cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=SUBPROCESS_FLAGS,
                timeout=120,
            )
            audio_ready = r_aud.returncode == 0 and aud_mka.exists() and aud_mka.stat().st_size > 0
            if not audio_ready:
                return None

        # 4) Concat video segments losslessly and mux continuous original audio
        head_posix = head_ts.as_posix().replace("'", "'\\''")
        tail_posix = tail_ts.as_posix().replace("'", "'\\''")
        concat_list.write_text(f"file '{head_posix}'\nfile '{tail_posix}'\n", encoding="utf-8")

        mux_cmd = [
            ff,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-fflags",
            "+genpts",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
        ]
        if audio_ready:
            mux_cmd.extend(["-i", str(aud_mka), "-map", "0:v:0", "-map", "1:a?"])
        else:
            mux_cmd.extend(["-map", "0:v:0"])

        mux_cmd.extend(
            [
                "-c:v",
                "copy",
            ]
        )
        if audio_ready:
            mux_cmd.extend(["-c:a", "copy"])

        mux_cmd.extend(
            [
                "-t",
                f"{total_dur:.6f}",
                "-avoid_negative_ts",
                "make_zero",
            ]
        )
        if is_mp4_like:
            mux_cmd.extend(["-movflags", "+faststart"])
        mux_cmd.append(str(dst))

        r_mux = subprocess.run(
            mux_cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=SUBPROCESS_FLAGS,
            timeout=180,
        )
        if r_mux.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
            if dst.exists():
                try:
                    dst.unlink()
                except OSError:
                    pass
            return None

        # Sanity-check resulting duration so broken/mismatched GOP streams safely fall back
        try:
            out_meta = probe_video(dst)
            if abs(out_meta.duration - total_dur) > max(0.45, total_dur * 0.15):
                try:
                    dst.unlink()
                except OSError:
                    pass
                return None
        except Exception:
            return None

    copied_pct = int(round(max(1.0, min(99.0, (tail_dur / total_dur) * 100.0))))
    return {
        "strategy": "hybrid",
        "copied_pct": copied_pct,
        "reencoded_sec": round(head_dur, 2),
    }


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
    - mode == 'smart': Hybrid Smart Cut — re-encodes only the leading partial GOP and stream-copies the rest.
    - mode == 'precise': Frame-exact cut with visually lossless CRF 15 video & lossless audio copy.
    """
    src = Path(input_path)
    dst = Path(output_path)
    dst.parent.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    start = max(0.0, float(start))
    end = max(start + 0.1, float(end))

    ext = dst.suffix.lower()
    is_mp4_like = ext in (".mp4", ".m4v", ".mov")

    smart_strategy: Optional[str] = None
    smart_copied_pct: Optional[int] = None
    smart_reencoded_sec: Optional[float] = None
    effective_mode = mode

    if mode == "smart":
        sc_res = _smart_cut_video(src, dst, start, end, keyframes, is_mp4_like)
        if sc_res and sc_res["strategy"] == "hybrid":
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            in_size = src.stat().st_size
            out_size = dst.stat().st_size
            actual_dur = round(end - start, 2)
            try:
                actual_dur = probe_video(dst).duration
            except Exception:
                pass
            return {
                "output_path": str(dst),
                "output_name": dst.name,
                "input_size": in_size,
                "output_size": out_size,
                "saved_bytes": max(0, in_size - out_size),
                "effective_start": round(start, 3),
                "actual_duration": round(actual_dur, 2),
                "elapsed_ms": elapsed_ms,
                "mode": "smart",
                "smart_strategy": "hybrid",
                "smart_copied_pct": sc_res["copied_pct"],
                "smart_reencoded_sec": sc_res["reencoded_sec"],
            }
        elif sc_res and sc_res["strategy"] == "pure_copy":
            effective_mode = "lossless"
            snap_kf = False
            smart_strategy = "pure_copy"
            smart_copied_pct = 100
            smart_reencoded_sec = 0.0
        else:
            effective_mode = "precise"
            smart_strategy = "fallback_precise"
            smart_copied_pct = 0
            smart_reencoded_sec = round(end - start, 2)

    effective_start = start
    if effective_mode == "lossless" and snap_kf:
        kfs = keyframes if keyframes is not None else get_keyframes(src)
        effective_start = snap_to_keyframe(start, kfs)

    effective_duration = max(0.1, end - effective_start)

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

    if effective_mode == "lossless":
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
    if res.returncode != 0 and effective_mode == "precise":
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

    result_dict: Dict[str, Any] = {
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
    if smart_strategy is not None:
        result_dict["smart_strategy"] = smart_strategy
        result_dict["smart_copied_pct"] = smart_copied_pct
        result_dict["smart_reencoded_sec"] = smart_reencoded_sec
    return result_dict


def move_files_to_recycle_bin(paths: List[Path]) -> Dict[str, Any]:
    """
    Safely move files to the OS Recycle Bin (Windows SHFileOperationW, zero external deps).
    Never permanently deletes files.
    """
    existing: List[Path] = []
    total_bytes = 0
    for p in paths:
        rp = p.resolve()
        if rp.exists() and rp.is_file():
            existing.append(rp)
            try:
                total_bytes += rp.stat().st_size
            except OSError:
                pass

    if not existing:
        return {"moved": [], "failed": [], "freed_bytes": 0}

    if os.name != "nt":
        raise RuntimeError("Recycle Bin is currently supported only on Windows.")

    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        if ctypes.sizeof(ctypes.c_void_p) == 4:
            _pack_ = 1
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("wFunc", wintypes.UINT),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", wintypes.WORD),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", wintypes.LPVOID),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    FO_DELETE = 0x0003
    FOF_SILENT = 0x0004
    FOF_NOCONFIRMATION = 0x0010
    FOF_ALLOWUNDO = 0x0040
    FOF_NOERRORUI = 0x0400

    p_from = "\0".join(str(p) for p in existing) + "\0\0"
    op = SHFILEOPSTRUCTW(
        hwnd=None,
        wFunc=FO_DELETE,
        pFrom=p_from,
        pTo=None,
        fFlags=FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI,
        fAnyOperationsAborted=False,
        hNameMappings=None,
        lpszProgressTitle=None,
    )

    shell32 = ctypes.windll.shell32
    shell32.SHFileOperationW.argtypes = [ctypes.POINTER(SHFILEOPSTRUCTW)]
    shell32.SHFileOperationW.restype = ctypes.c_int

    rc = shell32.SHFileOperationW(ctypes.byref(op))

    moved: List[str] = []
    failed: List[str] = []
    freed_bytes = 0
    # Verify individually which files actually left their original location
    for p in existing:
        if not p.exists():
            moved.append(str(p))
        else:
            failed.append(str(p))

    if rc != 0 and not moved:
        raise RuntimeError(f"SHFileOperationW failed with code {rc}")

    # Recalculate freed bytes accurately
    if len(moved) == len(existing):
        freed_bytes = total_bytes
    else:
        remaining = 0
        for fp in failed:
            try:
                remaining += Path(fp).stat().st_size
            except OSError:
                pass
        freed_bytes = max(0, total_bytes - remaining)

    return {
        "moved": moved,
        "failed": failed,
        "freed_bytes": freed_bytes,
    }
