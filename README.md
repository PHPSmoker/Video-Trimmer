# EventCut Studio — Lossless Batch Video Trimmer

> **[English](#english) | [Polski](#polski)**

---

<a id="english"></a>
## English

**EventCut Studio** is a fast, local Windows desktop web app built for batch-trimming multiple event clips (e.g., 15 ShadowPlay / OBS / Xbox Game Bar / dashcam 30-second recordings trimmed down to 5 seconds) with **zero quality loss**.

### Key Features
- **100% Lossless Cutting (`Stream Copy` / `-c copy`):** Copies original video and all audio tracks bit-for-bit without re-encoding. Original resolution, FPS, codec, and bitrate remain untouched, and exporting 15 clips takes ~1–2 seconds.
- **Keyframe (I-Frame) Visualization & Snapping:** Displays exact keyframe ticks along the timeline and optionally snaps the start cut to the nearest I-frame to avoid black/frozen lead-in frames.
- **Frame-Exact Mode (Optional):** Need strictly `5.00s` regardless of keyframe distance? Switch to visually lossless mode (`H.264 CRF 15` + lossless audio copy).
- **1-Click Batch Trimming + Individual Fine-Tuning:** Apply a global rule to all selected clips (*Last N sec*, *First N sec*, *Middle*, or *Custom range*), then quickly click through clips and drag the entire trim window left/right across the filmstrip timeline.
- **Zero-Copy Windows File & Folder Picker:** Select dozens of large 4K/60fps videos straight from disk without copying them into browser memory (standard Drag & Drop is also supported).
- **Safe Non-Destructive Export:** Originals are never overwritten — trimmed files are saved to a `Trimmed` (`Przyciete`) subfolder or any custom output folder.
- **Instant EN / PL Language Switcher:** Auto-detects browser language on first launch and switches all UI text and Windows dialog titles on the fly.

### Quick Start (Windows 10 / 11)
**Requirements:** [Python 3.10+](https://www.python.org/downloads/) *(check **"Add python.exe to PATH"** during setup)*.

1. Clone the repository (or click **Code → Download ZIP** and extract):
   ```bash
   git clone https://github.com/PHPSmoker/Video-Trimmer.git
   cd Video-Trimmer
   ```
2. Double-click **`START.bat`**.
   - On first launch, it automatically creates a local `.venv`, installs dependencies, downloads portable `ffmpeg.exe` & `ffprobe.exe` into `bin\`, and opens **EventCut Studio** in a clean standalone app window.

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

---

<a id="polski"></a>
## Polski

**EventCut Studio** to szybka, lokalna aplikacja na Windows do masowego skracania wielu nagrań z eventami (np. 15 klipów z ShadowPlay / OBS / Xbox Game Bar / wideorejestratora po 30 sekund przyciętych do 5 sekund) — **bez jakiejkolwiek utraty jakości**.

### Najważniejsze funkcje
- **100% bezstratne cięcie (`Stream Copy` / `-c copy`):** Kopiuje oryginalne strumienie wideo oraz wszystkie ścieżki audio bit w bit, bez rekompresji. Rozdzielczość, FPS, kodek i bitrate zostają identyczne, a eksport 15 klipów trwa ok. 1–2 sekundy.
- **Podgląd i wyrównanie do klatek kluczowych (I-frame):** Wyświetla znaczniki klatek kluczowych bezpośrednio na osi czasu i opcjonalnie wyrównuje punkt startu, zapobiegając czarnym/zamrożonym pierwszym klatkom.
- **Tryb „Co do klatki” (opcjonalny):** Gdy potrzebujesz idealnie `5.00s` niezależnie od odstępu klatek kluczowych — dostępny jest tryb wizualnie bezstratny (`H.264 CRF 15` + bezstratne kopiowanie audio).
- **Masowe przycinanie 1 kliknięciem + szybka korekta:** Ustawiasz jedną regułę dla wszystkich filmów (*Ostatnie N s*, *Pierwsze N s*, *Środek* lub *Własny zakres*), a potem możesz jednym ruchem przesunąć całe 5-sekundowe okno wycinka po osi czasu z podglądem klatek.
- **Natywny wybór plików/folderów bez kopiowania:** Wybierasz naraz dziesiątki dużych plików 4K prosto z dysku (działa też przeciąganie Drag & Drop).
- **Bezpieczny zapis:** Aplikacja nigdy nie nadpisuje oryginałów — zapisuje nowe pliki w podfolderze `Przyciete` lub we wskazanym folderze.
- **Przełącznik języka PL / EN:** Automatycznie wykrywa język systemu/przeglądarki i pozwala przełączać interfejs jednym kliknięciem.

### Szybki start (Windows 10 / 11)
**Wymagania:** [Python 3.10+](https://www.python.org/downloads/) *(zaznacz **„Add python.exe to PATH”** podczas instalacji)*.

1. Sklonuj repozytorium (albo kliknij **Code → Download ZIP** i rozpakuj):
   ```bash
   git clone https://github.com/PHPSmoker/Video-Trimmer.git
   cd Video-Trimmer
   ```
2. Kliknij dwukrotnie **`START.bat`**.
   - Przy pierwszym uruchomieniu skrypt automatycznie utworzy lokalne środowisko `.venv`, zainstaluje zależności, pobierze przenośne `ffmpeg.exe` i `ffprobe.exe` do folderu `bin\` oraz otworzy **EventCut Studio** w czystym oknie aplikacji.

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

---

## Tech Stack
- **Backend:** Python 3, FastAPI, Uvicorn, FFmpeg / FFprobe
- **Frontend:** Vanilla HTML5 / CSS3 / ES6 JavaScript (no Node/build step required)
- **License:** MIT
