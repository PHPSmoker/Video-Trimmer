from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys

DIALOG_TEXTS = {
    "pl": {
        "files_title": "Wybierz filmy do skrócenia (możesz zaznaczyć wiele)",
        "video_files": "Pliki wideo",
        "all_files": "Wszystkie pliki",
        "folder_title": "Wybierz folder z filmami",
        "output_title": "Wybierz folder docelowy dla przyciętych filmów",
    },
    "en": {
        "files_title": "Select videos to trim (multiple selection supported)",
        "video_files": "Video files",
        "all_files": "All files",
        "folder_title": "Select folder with videos",
        "output_title": "Select output folder for trimmed videos",
    },
}


def _enable_dpi_awareness() -> None:
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def _pick_via_tkinter(mode: str, txt: dict, initial_dir: str | None):
    import tkinter as tk
    from tkinter import filedialog

    _enable_dpi_awareness()
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    root.update()
    try:
        if mode == "files":
            paths = filedialog.askopenfilenames(
                parent=root,
                title=txt["files_title"],
                initialdir=initial_dir,
                filetypes=[
                    (
                        txt["video_files"],
                        "*.mp4 *.mkv *.mov *.webm *.avi *.m4v *.ts *.mts *.m2ts *.flv *.wmv",
                    ),
                    (txt["all_files"], "*.*"),
                ],
            )
            return list(paths) if paths else []
        if mode == "folder":
            folder = filedialog.askdirectory(
                parent=root,
                title=txt["folder_title"],
                initialdir=initial_dir,
                mustexist=True,
            )
            return folder or ""
        if mode == "output":
            folder = filedialog.askdirectory(
                parent=root,
                title=txt["output_title"],
                initialdir=initial_dir,
            )
            return folder or ""
        return None
    finally:
        root.destroy()


def _pick_via_powershell(mode: str, txt: dict, initial_dir: str | None):
    """Fallback native Windows picker using .NET System.Windows.Forms if tkinter is unavailable."""
    env = os.environ.copy()
    env["EC_INIT_DIR"] = initial_dir or ""

    if mode == "files":
        env["EC_TITLE"] = txt["files_title"]
        env["EC_FILTER"] = (
            f"{txt['video_files']}|*.mp4;*.mkv;*.mov;*.webm;*.avi;*.m4v;*.ts;*.mts;*.m2ts;*.flv;*.wmv"
            f"|{txt['all_files']}|*.*"
        )
        ps = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$d = New-Object System.Windows.Forms.OpenFileDialog; "
            "$d.Title = $env:EC_TITLE; $d.Filter = $env:EC_FILTER; $d.Multiselect = $true; "
            "if ($env:EC_INIT_DIR -and (Test-Path $env:EC_INIT_DIR)) { $d.InitialDirectory = $env:EC_INIT_DIR }; "
            "if ($d.ShowDialog() -eq 'OK') { ConvertTo-Json -InputObject @($d.FileNames) -Compress } else { '[]' }"
        )
    else:
        env["EC_TITLE"] = txt["folder_title"] if mode == "folder" else txt["output_title"]
        ps = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$d = New-Object System.Windows.Forms.FolderBrowserDialog; "
            "$d.Description = $env:EC_TITLE; $d.ShowNewFolderButton = $true; "
            "if ($env:EC_INIT_DIR -and (Test-Path $env:EC_INIT_DIR)) { $d.SelectedPath = $env:EC_INIT_DIR }; "
            "if ($d.ShowDialog() -eq 'OK') { ConvertTo-Json -InputObject $d.SelectedPath -Compress } else { '\"\"' }"
        )

    res = subprocess.run(
        ["powershell", "-NoProfile", "-STA", "-Command", ps],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        timeout=300,
    )
    out = res.stdout.strip()
    return json.loads(out) if out else ([] if mode == "files" else "")


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "files"
    lang = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] in DIALOG_TEXTS else "pl"
    initial_dir = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    txt = DIALOG_TEXTS[lang]

    try:
        result = _pick_via_tkinter(mode, txt, initial_dir)
    except Exception:
        result = _pick_via_powershell(mode, txt, initial_dir)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
