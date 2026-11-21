from __future__ import annotations

import ctypes
import json
import sys
import tkinter as tk
from tkinter import filedialog

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


def _create_hidden_root() -> tk.Tk:
    _enable_dpi_awareness()
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    root.update()
    return root


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "files"
    lang = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] in DIALOG_TEXTS else "pl"
    initial_dir = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    txt = DIALOG_TEXTS[lang]

    root = _create_hidden_root()
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
            result = list(paths) if paths else []
        elif mode == "folder":
            folder = filedialog.askdirectory(
                parent=root,
                title=txt["folder_title"],
                initialdir=initial_dir,
                mustexist=True,
            )
            result = folder or ""
        elif mode == "output":
            folder = filedialog.askdirectory(
                parent=root,
                title=txt["output_title"],
                initialdir=initial_dir,
            )
            result = folder or ""
        else:
            result = None
    finally:
        root.destroy()

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
