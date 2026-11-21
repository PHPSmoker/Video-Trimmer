from __future__ import annotations

import os
import shutil
import socket
import subprocess
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn

from app.server import app


def find_free_port(preferred: int = 8765) -> int:
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 0


def find_app_browser() -> str | None:
    candidates = [
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return shutil.which("msedge") or shutil.which("chrome")


def open_when_ready(url: str) -> None:
    health_url = f"{url}/api/health"
    for _ in range(40):
        try:
            with urllib.request.urlopen(health_url, timeout=0.5) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.15)

    browser = find_app_browser()
    if browser:
        try:
            subprocess.Popen(
                [browser, f"--app={url}", "--window-size=1420,880"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return
        except Exception:
            pass
    webbrowser.open(url)


def main() -> None:
    port = int(os.environ.get("EVENTCUT_PORT", "0")) or find_free_port(8765)
    url = f"http://127.0.0.1:{port}"
    print("=" * 56)
    print("  EventCut Studio — Bezstratne przycinanie filmow")
    print(f"  Adres lokalny: {url}")
    print("  Zamknij to okno, aby wylaczyc serwer aplikacji.")
    print("=" * 56)

    if os.environ.get("EVENTCUT_NO_BROWSER") != "1":
        threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
