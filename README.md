# ✂️ EventCut Studio — Lossless Batch Video Trimmer (EN / PL)

Local Windows desktop web app built with **Python (FastAPI)** and **FFmpeg** for batch-trimming dozens of event recordings (e.g. 15 clips of 30s trimmed down to 5s) with **0% quality loss**.

- **Zero setup required** — no Python or FFmpeg installation needed. On first launch, `START.bat` automatically downloads a local portable **Python 3.12** (if missing) and portable **FFmpeg + FFprobe** without admin rights or modifying your system.
- **Built-in `PL | EN` language switcher** in the top bar (auto-detects browser language and remembers your choice).

---

## 🇬🇧 Quick Start (English)

### Requirements
- **None!** On Windows 10 / 11, double-clicking `START.bat` automatically downloads a local portable **Python 3.12** into `.tools/` (if you don't have Python 3.10+ installed), installs dependencies, and fetches portable **FFmpeg + FFprobe** into `bin/` on first run — no admin rights needed.

### Option 1: Download ZIP (Windows — zero setup)
1. Click **Code → Download ZIP** on GitHub and extract the folder.
2. Double-click **`START.bat`**.
3. Wait a moment for automatic first-time setup — **EventCut Studio** will open automatically in a clean standalone app window.

### Option 2: Git Clone
```bash
git clone https://github.com/PHPSmoker/Video-Trimmer.git
cd Video-Trimmer
```
- Double-click **`START.bat`** (or run `python run_app.py` if you already have Python & dependencies installed).

### Features
- **100% Lossless Cutting (`Stream Copy` / `-c copy`)**: Copies original video and all audio tracks bit-for-bit without re-encoding. Resolution, FPS, codec, and bitrate remain untouched, and exporting 15 clips takes ~1–2 seconds.
- **Keyframe (I-Frame) Visualization & Snapping**: Shows exact keyframe ticks along the timeline and optionally snaps the start cut to the nearest I-frame to avoid black/frozen lead-in frames.
- **Frame-Exact Mode (Optional)**: Need strictly `5.00s` regardless of keyframe distance? Switch to visually lossless mode (`H.264 CRF 15` + lossless audio copy).
- **1-Click Batch Trimming + Individual Fine-Tuning**: Apply one rule to all selected clips (*Last N sec*, *First N sec*, *Middle*, or *Custom range*), then quickly step through clips (`↑`/`↓`) and slide the entire trim window across the filmstrip timeline with instant looped playback.
- **Zero-Copy File & Folder Import**: Select dozens of large 4K/60fps videos straight from disk without copying them into browser memory (standard Drag & Drop is also supported).
- **Safe Non-Destructive Export**: Originals are never overwritten — trimmed clips are saved into a `Trimmed` (`Przyciete`) subfolder or any custom output folder.

### Keyboard Shortcuts
| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `I` | Set trim start (IN) at playhead |
| `O` | Set trim end (OUT) at playhead |
| `←` / `→` | Seek 0.5s (`+Shift`: 0.1s) |
| `↑` / `↓` | Previous / Next clip in queue |
| `L` | Toggle selection loop playback |
| `M` | Mute / Unmute audio |

### FAQ (English)

<details>
<summary><strong>Windows shows "Unknown publisher" / SmartScreen warning when opening <code>START.bat</code></strong></summary>

This is normal for any unsigned `.bat` script downloaded in a `.zip` file from GitHub (Windows tags browser downloads with *Mark of the Web*). You have three safe options:
1. Click **Run** (or **More info → Run anyway**).
2. Before extracting the `.zip`, right-click it → **Properties** → check **Unblock** → **OK**, then extract.
3. Download via `git clone` (or run `python run_app.py` if you have Python installed), which avoids the `.bat` prompt completely.

All source code is plain-text Python/HTML/JS in this repository so you can inspect everything before running.
</details>

<details>
<summary><strong>Do I need Python or FFmpeg installed on my computer?</strong></summary>

No! If Python 3.10+ is missing on your laptop, `START.bat` automatically downloads a lightweight portable Python 3.12 into a local `.tools/` folder (no admin rights needed, nothing added to system `PATH`). Likewise, if FFmpeg is not found in `bin/` or `PATH`, `START.bat` downloads portable `ffmpeg.exe` and `ffprobe.exe` into `bin/` automatically on first launch.
</details>

<details>
<summary><strong>Does EventCut Studio overwrite or delete my original videos?</strong></summary>

Never. The app always creates **new files** (by default inside a `Trimmed` / `Przyciete` subfolder next to your originals, with a `_cut` suffix). Even if you clear the suffix and pick the same folder, a safety guard prevents overwriting source files. Removing clips from the queue only clears them from the UI list.
</details>

<details>
<summary><strong>Why can lossless Stream Copy length differ by ~0.2–1.5 seconds?</strong></summary>

Lossless stream copying (`-c copy`) does zero re-encoding, so cuts must start on a keyframe (I-frame) encoded in the original video. Enabling **Snap start point to nearest keyframe** ensures clean playback without black/frozen lead-in frames. If you ever need exact `0.01s` precision, switch to **Frame-Exact (Visually Lossless)** mode (`H.264 CRF 15` + 100% lossless audio copy).
</details>

<details>
<summary><strong>Where are trimmed videos saved?</strong></summary>

By default, next to your source videos in a subfolder named `Trimmed` (EN) or `Przyciete` (PL). You can also uncheck that option in the right panel and pick any custom output folder. After export completes, click **Open output folder** to jump straight to your files in Windows Explorer.
</details>

---

## 🇵🇱 Szybki start (Polski)

### Wymagania
- **Brak wymagań!** Nie musisz mieć zainstalowanego ani Pythona, ani FFmpeg. Przy pierwszym uruchomieniu **`START.bat`** automatycznie pobierze lokalną, przenośną wersję **Pythona 3.12** do folderu `.tools/` (bez uprawnień administratora i bez zaśmiecania systemu), zainstaluje zależności oraz pobierze przenośne **FFmpeg + FFprobe** do folderu `bin/`.

### Uruchomienie (Windows 10 / 11)
1. Pobierz repozytorium (**Code → Download ZIP**) i rozpakuj albo sklonuj przez `git clone https://github.com/PHPSmoker/Video-Trimmer.git`.
2. Kliknij dwukrotnie **`START.bat`**.
3. Przy pierwszym uruchomieniu skrypt pobierze wszystko automatycznie i otworzy **EventCut Studio** w czystym oknie aplikacji.

### Najważniejsze funkcje
- **100% bezstratne cięcie (`Stream Copy` / `-c copy`)**: Kopiuje oryginalne strumienie wideo oraz wszystkie ścieżki audio bit w bit, bez rekompresji. Rozdzielczość, FPS, kodek i bitrate zostają identyczne, a eksport 15 klipów trwa ok. 1–2 sekundy.
- **Podgląd i wyrównanie do klatek kluczowych (I-frame)**: Złote znaczniki na osi czasu pokazują klatki kluczowe, a wyrównanie punktu startu zapobiega czarnym/zamrożonym pierwszym klatkom.
- **Tryb „Co do klatki” (opcjonalny)**: Gdy potrzebujesz idealnie `5.00s` niezależnie od klatek kluczowych — dostępny jest tryb wizualnie bezstratny (`H.264 CRF 15` + bezstratne audio).
- **Masowe przycinanie 1 kliknięciem + szybka korekta**: Ustawiasz jedną regułę dla wszystkich filmów (*Ostatnie N s*, *Pierwsze N s*, *Środek* lub *Własny zakres*), a potem możesz jednym ruchem przesuwać całe 5-sekundowe okno po osi czasu z zapętlonym podglądem.
- **Natywny wybór plików/folderów bez kopiowania**: Błyskawicznie wczytuje dziesiątki dużych plików 4K prosto z dysku (działa też Drag & Drop).
- **Przełącznik języka `PL | EN`** w prawym górnym rogu.

### Skróty klawiszowe
| Klawisz | Działanie |
| --- | --- |
| `Spacja` | Odtwórz / Pauza |
| `I` | Ustaw początek wycinka (IN) |
| `O` | Ustaw koniec wycinka (OUT) |
| `←` / `→` | Przesuń kursor o 0.5s (`+Shift`: 0.1s) |
| `↑` / `↓` | Poprzedni / Następny film z listy |
| `L` | Włącz / Wyłącz pętlę wycinka |
| `M` | Wycisz / Włącz dźwięk |

### FAQ (Polski)

<details>
<summary><strong>Windows pokazuje komunikat „Nie można zweryfikować wydawcy” / SmartScreen przy <code>START.bat</code></strong></summary>

To standardowe zabezpieczenie systemu Windows dla każdego niepodpisanego pliku `.bat` pobranego z przeglądarki w archiwum `.zip`. Masz trzy bezpieczne rozwiązania:
1. Kliknij **Uruchom** (lub **Więcej informacji → Uruchom mimo to**).
2. Przed rozpakowaniem pliku `.zip` kliknij go prawym przyciskiem → **Właściwości** → zaznacz **Odblokuj** → **OK** i dopiero rozpakuj.
3. Pobierz repozytorium przez `git clone` (lub uruchom `python run_app.py`, jeśli masz Pythona) — wtedy komunikat w ogóle się nie pojawia.

Cały kod projektu jest jawny w tym repozytorium i możesz go przejrzeć przed uruchomieniem.
</details>

<details>
<summary><strong>Czy muszę mieć zainstalowanego Pythona albo FFmpeg?</strong></summary>

Nie! Jeśli nie masz Pythona 3.10+ na laptopie, skrypt `START.bat` automatycznie pobierze lekką, przenośną wersję Pythona 3.12 do lokalnego folderu `.tools/` (bez uprawnień administratora i bez zmian w systemie). Tak samo, jeśli brakuje FFmpeg w `bin/` lub `PATH`, skrypt pobierze przenośne `ffmpeg.exe` i `ffprobe.exe` automatycznie przy pierwszym uruchomieniu.
</details>

<details>
<summary><strong>Czy aplikacja nadpisuje lub usuwa moje oryginalne filmy?</strong></summary>

Nigdy. Program zawsze tworzy **nowe pliki** (domyślnie w podfolderze `Przyciete` obok oryginałów, z dopiskiem `_cut`). Nawet przy usunięciu dopisku kod posiada twardą blokadę przed nadpisaniem pliku źródłowego. Usunięcie klipu z kolejki usuwa go wyłącznie z listy w aplikacji.
</details>

<details>
<summary><strong>Dlaczego w trybie bezstratnym długość może się różnić o ok. 0.2–1.5 sekundy?</strong></summary>

Bezstratne cięcie (`Stream Copy`) nie rekompresuje wideo, dlatego musi zaczynać się od klatki kluczowej (I-frame) zapisanej w oryginalnym pliku. Włączona opcja **Wyrównaj początek do klatki kluczowej** gwarantuje płynny start bez czarnych klatek. Jeśli potrzebujesz dokładności co do `0.01s`, przełącz tryb na **Co do klatki (Wizualnie bezstratny)** (`H.264 CRF 15` + 100% bezstratne audio).
</details>

<details>
<summary><strong>Gdzie zapisują się przycięte filmy?</strong></summary>

Domyślnie obok oryginalnych nagrań w podfolderze `Przyciete` (lub `Trimmed` w wersji EN). Możesz też odznaczyć tę opcję w prawym panelu i wybrać dowolny własny folder docelowy. Po zakończeniu eksportu kliknij **Otwórz folder z wynikami**, aby od razu otworzyć go w Eksploratorze Windows.
</details>

---

## License
[MIT](LICENSE)
