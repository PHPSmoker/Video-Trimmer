(() => {
  "use strict";

  const STORAGE_KEY = "eventcut_lang";

  const TRANSLATIONS = {
    pl: {
      page_title: "EventCut Studio — Bezstratne przycinanie filmów",
      engine_ok: "100% Bezstratny • FFmpeg",
      engine_no_ffmpeg: "Brak FFmpeg!",
      engine_offline: "Brak połączenia z backendem",

      btn_add_files: "Dodaj filmy",
      btn_add_files_title: "Wybierz wiele filmów z dysku (bez kopiowania)",
      btn_add_folder: "Dodaj folder",
      btn_add_folder_title: "Wczytaj wszystkie filmy z wybranego folderu",
      btn_shortcuts: "Skróty",
      btn_shortcuts_title: "Skróty klawiszowe",
      btn_export: "Eksportuj",

      queue_title: "Kolejka eventów",
      queue_reviewed_title: "Sprawdzone klipy (Enter = zatwierdź i następny)",
      queue_select_all_title: "Zaznacz / Odznacz wszystkie",
      queue_clear_title: "Wyczyść całą listę",
      queue_empty_title: "Brak wczytanych filmów.",
      queue_empty_desc: "Dodaj pliki przyciskiem powyżej lub przeciągnij je tutaj.",
      clip_include_title: "Uwzględnij w eksporcie",
      clip_remove_title: "Usuń z listy",
      clip_reviewed_badge: "Sprawdzony",

      hero_title: "Skracaj dziesiątki klipów bez utraty jakości",
      hero_subtitle_html:
        "Wybierz np. 15 nagrań z eventami po 30 sekund i przytnij je hurtowo do 5 sekund — <strong>bit w bit w oryginalnej jakości</strong> (Stream Copy) w zaledwie kilka sekund.",
      hero_btn_files: "Wybierz filmy z dysku",
      hero_btn_folder: "Wybierz cały folder",
      hero_drop_note: "lub przeciągnij i upuść pliki MP4 / MKV / MOV bezpośrednio w to okno",
      hero_feat_lossless: "0% straty jakości (Stream Copy)",
      hero_feat_timeline: "Przesuwane okno wycinka na osi czasu",
      hero_feat_batch: "Masowe przycinanie 1 kliknięciem",

      btn_review: "Zatwierdź",
      btn_reviewed_done: "Sprawdzony",
      btn_review_title: "Zatwierdź wycinek i przejdź do następnego (Enter / Shift+Enter)",
      btn_prev: "Poprzedni",
      btn_prev_title: "Poprzedni film (Strzałka w górę)",
      btn_next: "Następny",
      btn_next_title: "Następny film (Strzałka w dół)",
      codec_notice_title: "Podgląd niedostępny dla tego kodeka w przeglądarce",
      codec_notice_desc:
        "Bez obaw — FFmpeg i tak przytnie ten plik 100% bezstratnie! Możesz ustawić czas wycinka na osi czasu poniżej.",
      loop_badge: "Podgląd wycinka (pętla)",

      play_pause_title: "Odtwórz / Pauza (Spacja)",
      kf_prev_title: "Poprzednia klatka kluczowa I-frame (Ctrl + ←)",
      kf_next_title: "Następna klatka kluczowa I-frame (Ctrl + →)",
      frame_back_title: "Cofnij o 1 klatkę (,)",
      frame_fwd_title: "Naprzód o 1 klatkę (.)",
      step_back_title: "Cofnij o 0.5s (←)",
      step_fwd_title: "Naprzód o 0.5s (→)",
      btn_loop: "Pętla",
      btn_loop_title: "Zapętlaj tylko zaznaczony fragment (L)",
      btn_set_in: "Początek tutaj",
      btn_set_in_title: "Ustaw początek wycinka w miejscu kursora (I)",
      btn_set_out: "Koniec tutaj",
      btn_set_out_title: "Ustaw koniec wycinka w miejscu kursora (O)",
      speed_title: "Prędkość podglądu",
      mute_title: "Wycisz / Włącz dźwięk (M)",

      tl_start: "START (IN)",
      tl_duration: "DŁUGOŚĆ",
      tl_end: "KONIEC (OUT)",
      tl_waveform_title: "Pokaż / Ukryj wykres fali dźwiękowej (Audio Waveform)",
      tl_zoom_title: "Przybliżenie osi czasu (kółko myszy na osi)",
      tl_zoom_reset_title: "Resetuj powiększenie do 1.0x",
      tl_pan_title: "Przeciągnij, aby przesuwać powiększoną oś czasu (lub Shift + kółko myszy)",
      tl_keyframes: "Klatki kluczowe",
      tl_keyframes_loading: "Wykrywanie klatek kluczowych...",
      tl_keyframes_count: "{n} klatek kluczowych (I-frame)",
      tl_keyframes_title:
        "Złote znaczniki na dole osi to klatki kluczowe (I-frames) dla bezstratnego cięcia",
      tl_selection_title: "Przeciągnij środek, aby przesunąć cały wycinek w czasie",
      tl_handle_left_title: "Przeciągnij, aby zmienić początek (IN)",
      tl_handle_right_title: "Przeciągnij, aby zmienić koniec (OUT)",
      quick_duration: "Długość:",
      quick_position: "Pozycja wycinka:",
      anchor_start: "Początek",
      anchor_middle: "Środek",
      anchor_end: "Koniec",
      anchor_playhead: "Wokół kursora",
      anchor_best: "✨ Najlepszy moment",
      anchor_best_title:
        "Automatycznie znajdź najciekawszy moment (kolejne kliknięcia pokazują 2. i 3. moment)",

      batch_title: "Masowe przycinanie",
      batch_tag: "Wszystkie filmy",
      batch_desc:
        "Ustaw jedną regułę dla wszystkich zaznaczonych klipów (np. skróć 15 filmów do ostatnich 5 sekund), a potem doprecyzuj wybrane na osi czasu.",
      batch_duration_label: "Docelowa długość (sekundy)",
      batch_anchor_label: "Który fragment zachować?",
      batch_opt_end: "Ostatnie N sekund (idealne do eventów)",
      batch_opt_best: "✨ Najlepszy moment (Auto — dźwięk i ruch)",
      batch_opt_start: "Pierwsze N sekund",
      batch_opt_middle: "Środek klipu (N sekund)",
      batch_opt_custom: "Własny zakres (od sekundy X do Y)",
      batch_from: "Od (s)",
      batch_to: "Do (s)",
      batch_apply_prefix: "Zastosuj do zaznaczonych",
      batch_detecting_best: "Szukanie najlepszych momentów...",

      quality_title: "Jakość i silnik cięcia",
      mode_lossless_title: "100% Bezstratny (Stream Copy)",
      mode_lossless_pill: "0% straty",
      mode_lossless_desc:
        "Kopiuje oryginalne strumienie wideo i audio bez rekompresji. Jakość identyczna co do bita, błyskawiczny zapis (~0.1s/film).",
      snap_kf_label: "Wyrównaj początek do klatki kluczowej (I-frame)",
      snap_kf_hint:
        "Zapobiega czarnym/zamrożonym pierwszym klatkom przy cięciu bezstratnym. Długość może się różnić o 0.2–1.5s w zależności od klipu.",
      mode_smart_title: "Hybrydowy — Smart Cut",
      mode_smart_pill: "~95% copy • 0.01s",
      mode_smart_desc:
        "Rekompresuje tylko pierwszy ułamek sekundy do najbliższego I-frame, a resztę kopiuje bit w bit. Dokładny i błyskawiczny.",
      mode_precise_title: "Co do klatki (Wizualnie bezstratny)",
      mode_precise_pill: "0.01s",
      mode_precise_desc:
        "Dokładne cięcie niezależnie od klatek kluczowych (H.264 CRF 15 — nieodróżnialne od oryginału, dźwięk 100% bezstratny).",

      output_title: "Zapis plików",
      output_subfolder_html:
        "Zapisz w podfolderze <code>Przyciete</code> obok oryginałów",
      output_subfolder_name: "Przyciete",
      output_dir_empty: "Nie wybrano folderu",
      output_dir_title: "Wybierz folder docelowy",
      btn_change: "Zmień...",
      suffix_label: "Dopisek do nazwy pliku",
      preview_label: "Podgląd:",
      overwrite_label: "Nadpisuj istniejące pliki w folderze docelowym",

      footer_ready: "Gotowe do eksportu: {selected} z {total}",
      footer_mode_lossless: "Stream Copy • 0% straty",
      footer_mode_smart: "Smart Cut • Hybrydowy",
      footer_mode_precise: "CRF 15 • Co do klatki",
      btn_trim_and_save: "Przytnij i zapisz",

      drag_title: "Upuść filmy tutaj",
      drag_desc: "Obsługiwane formaty: MP4, MKV, MOV, WEBM, AVI, TS",

      modal_export_running: "Przycinanie filmów...",
      modal_export_sub_lossless:
        "Silnik FFmpeg Stream Copy (100% bezstratny, bez rekompresji)",
      modal_export_sub_smart:
        "Silnik Smart Cut (hybrydowe cięcie co do klatki — kopiuje resztę bit w bit)",
      modal_export_sub_precise:
        "Silnik FFmpeg Precyzyjny (co do klatki, CRF 15 + bezstratne audio)",
      modal_export_done: "Gotowe! Wszystkie filmy przycięte",
      modal_export_warn: "Zakończono z ostrzeżeniami",
      modal_close: "Zamknij",
      modal_open_folder: "Otwórz folder z wynikami",
      btn_trash_originals: "Przenieś oryginały do Kosza ({size})",
      recycle_confirm_prompt:
        "Czy na pewno przenieść {n} oryginalny(ch) plik(ów) ({size}) do Kosza Windows? Przycięte kopie są już bezpiecznie zapisane na dysku.",
      recycle_cancel: "Anuluj",
      recycle_confirm: "Tak, przenieś do Kosza",
      recycle_done_banner:
        "Przeniesiono {n} oryginalny(ch) plik(ów) do Kosza Windows — zwolniono {size} miejsca na dysku.",
      export_progress_videos: "{done} / {total} filmów",
      export_status_processing: "Przetwarzanie...",
      export_status_queued: "W kolejce",
      export_status_error: "Błąd",
      export_summary_ok:
        "Sukces! {ok}/{total} filmów zapisanych {mode} w {sec}s • Zaoszczędzono {saved} miejsca ({before} → {after}).",
      export_summary_err:
        "Przycięto {ok}/{total} filmów w {sec}s ({failed} błędów). Zaoszczędzono {saved} miejsca na dysku.",
      export_mode_lossless_adv: "100% bezstratnie",
      export_mode_smart_adv: "hybrydowo (Smart Cut)",
      export_mode_precise_adv: "co do klatki",

      shortcuts_title: "Skróty klawiszowe",
      sc_space_key: "Spacja",
      sc_space: "Odtwórz / Pauza",
      sc_i: "Ustaw początek wycinka (IN)",
      sc_o: "Ustaw koniec wycinka (OUT)",
      sc_frame: "Przesuń o dokładnie 1 klatkę",
      sc_lr: "Przesuń kursor o 0.5s (+Shift: 0.1s)",
      sc_kf: "Poprzednia / Następna klatka kluczowa (I-frame)",
      sc_ud: "Poprzedni / Następny film z listy",
      sc_enter: "Zatwierdź klip i przejdź do następnego",
      sc_l: "Włącz / Wyłącz pętlę wycinka",
      sc_m: "Wycisz / Włącz dźwięk",
      sc_scroll_key: "Kółko myszy",
      sc_scroll: "Przybliżenie osi czasu (+Shift: przewijanie)",

      audio_tracks: "{n} ścieżki audio",
      toast_no_ffmpeg: "Nie wykryto FFmpeg. Sprawdź folder bin/.",
      toast_added_one: "Dodano 1 film do kolejki.",
      toast_added_many: "Dodano {n} filmów do kolejki!",
      toast_session_restored: "Przywrócono poprzednią sesję ({n} filmów).",
      toast_all_reviewed: "Świetnie! Wszystkie klipy w kolejce zostały sprawdzone.",
      toast_no_keyframes: "Brak wykrytych klatek kluczowych dla tego klipu.",
      toast_kf_jump: "Klatka kluczowa (I-frame): {t}s",
      toast_recycled_ok: "Przeniesiono {n} oryginał(ów) do Kosza Windows ({size}).",
      toast_recycled_partial: "Nie udało się przenieść {n} pliku(ów) (może być otwarty w innym programie).",
      moment_reason_both: "dźwięk + ruch",
      moment_reason_audio: "skok dźwięku",
      moment_reason_motion: "ruch w obrazie",
      toast_best_batch_done: "Znaleziono najlepszy moment ({d}s) na {n} filmach!",
      toast_best_single: "✨ Najlepszy moment #{idx}/{total} ({t}s • {reason})",
      toast_skipped: "Pominięto {n} plik(ów): {err}",
      toast_folder_empty:
        "W wybranym folderze nie znaleziono obsługiwanych plików wideo.",
      toast_uploading: "Wczytywanie {n} pliku(ów)...",
      toast_upload_err: "Błąd przesyłania plików.",
      toast_cleared: "Wyczyszczono kolejkę filmów.",
      toast_batch_applied: "Zastosowano przycięcie do {range} na {n} filmach!",
      toast_range_end: "ostatnich {d}s",
      toast_range_start: "pierwszych {d}s",
      toast_range_middle: "środkowych {d}s",
      toast_range_custom: "zakresu {s}s – {e}s",
      toast_select_one: "Zaznacz przynajmniej jeden film do eksportu.",
      toast_pick_dir:
        "Wybierz folder docelowy lub włącz zapis w podfolderze Przyciete.",
      toast_lost_status: "Utracono status eksportu: {err}",
      toast_set_in: "Ustawiono początek (IN) na {t}s",
      toast_set_out: "Ustawiono koniec (OUT) na {t}s",
      server_err: "Błąd serwera ({status})",
    },

    en: {
      page_title: "EventCut Studio — Lossless Batch Video Trimmer",
      engine_ok: "100% Lossless • FFmpeg",
      engine_no_ffmpeg: "FFmpeg missing!",
      engine_offline: "Backend disconnected",

      btn_add_files: "Add videos",
      btn_add_files_title: "Pick multiple video files from disk (zero-copy)",
      btn_add_folder: "Add folder",
      btn_add_folder_title: "Load all videos from a folder",
      btn_shortcuts: "Shortcuts",
      btn_shortcuts_title: "Keyboard shortcuts",
      btn_export: "Export",

      queue_title: "Event Queue",
      queue_reviewed_title: "Reviewed clips (Enter = approve & next)",
      queue_select_all_title: "Select / Deselect all",
      queue_clear_title: "Clear queue",
      queue_empty_title: "No videos loaded.",
      queue_empty_desc: "Click Add videos above or drag & drop files here.",
      clip_include_title: "Include in export",
      clip_remove_title: "Remove from list",
      clip_reviewed_badge: "Reviewed",

      hero_title: "Trim dozens of event clips with zero quality loss",
      hero_subtitle_html:
        "Select e.g. 15 30-second event recordings and batch-trim them to 5 seconds — <strong>bit-for-bit original quality</strong> (Stream Copy) in just a couple of seconds.",
      hero_btn_files: "Choose videos from disk",
      hero_btn_folder: "Choose entire folder",
      hero_drop_note: "or drag & drop MP4 / MKV / MOV files straight into this window",
      hero_feat_lossless: "0% quality loss (Stream Copy)",
      hero_feat_timeline: "Draggable trim window on timeline",
      hero_feat_batch: "1-click batch trimming",

      btn_review: "Approve",
      btn_reviewed_done: "Reviewed",
      btn_review_title: "Mark clip as reviewed and jump to next (Enter / Shift+Enter)",
      btn_prev: "Previous",
      btn_prev_title: "Previous clip (Up Arrow)",
      btn_next: "Next",
      btn_next_title: "Next clip (Down Arrow)",
      codec_notice_title: "Browser preview unavailable for this codec",
      codec_notice_desc:
        "No worries — FFmpeg will still trim this file 100% losslessly! You can set the trim range on the timeline below.",
      loop_badge: "Looping selection",

      play_pause_title: "Play / Pause (Space)",
      kf_prev_title: "Previous keyframe I-frame (Ctrl + ←)",
      kf_next_title: "Next keyframe I-frame (Ctrl + →)",
      frame_back_title: "Step back 1 frame (,)",
      frame_fwd_title: "Step forward 1 frame (.)",
      step_back_title: "Step back 0.5s (←)",
      step_fwd_title: "Step forward 0.5s (→)",
      btn_loop: "Loop",
      btn_loop_title: "Loop selected trim segment only (L)",
      btn_set_in: "Set IN here",
      btn_set_in_title: "Set trim start at playhead (I)",
      btn_set_out: "Set OUT here",
      btn_set_out_title: "Set trim end at playhead (O)",
      speed_title: "Playback speed",
      mute_title: "Mute / Unmute audio (M)",

      tl_start: "START (IN)",
      tl_duration: "LENGTH",
      tl_end: "END (OUT)",
      tl_waveform_title: "Show / Hide Audio Waveform",
      tl_zoom_title: "Timeline zoom (scroll wheel on timeline)",
      tl_zoom_reset_title: "Reset zoom to 1.0x",
      tl_pan_title: "Drag to pan zoomed timeline (or Shift + scroll wheel)",
      tl_keyframes: "Keyframes",
      tl_keyframes_loading: "Detecting keyframes...",
      tl_keyframes_count: "{n} keyframes (I-frames)",
      tl_keyframes_title:
        "Amber ticks along the bottom mark keyframes (I-frames) for lossless cutting",
      tl_selection_title: "Drag the center window to slide the entire trim range",
      tl_handle_left_title: "Drag to adjust start point (IN)",
      tl_handle_right_title: "Drag to adjust end point (OUT)",
      quick_duration: "Length:",
      quick_position: "Window position:",
      anchor_start: "Start",
      anchor_middle: "Middle",
      anchor_end: "End",
      anchor_playhead: "Around playhead",
      anchor_best: "✨ Best moment",
      anchor_best_title:
        "Automatically detect the most exciting moment (click again to cycle 2nd & 3rd peaks)",

      batch_title: "Batch Trimming",
      batch_tag: "All clips",
      batch_desc:
        "Apply one rule to all selected clips (e.g. trim 15 videos to the last 5 seconds), then fine-tune individual clips on the timeline.",
      batch_duration_label: "Target length (seconds)",
      batch_anchor_label: "Which segment to keep?",
      batch_opt_end: "Last N seconds (ideal for events)",
      batch_opt_best: "✨ Best moment (Auto — audio & motion)",
      batch_opt_start: "First N seconds",
      batch_opt_middle: "Middle of clip (N seconds)",
      batch_opt_custom: "Custom range (from X to Y sec)",
      batch_from: "From (s)",
      batch_to: "To (s)",
      batch_apply_prefix: "Apply to selected",
      batch_detecting_best: "Finding best moments...",

      quality_title: "Quality & Cut Engine",
      mode_lossless_title: "100% Lossless (Stream Copy)",
      mode_lossless_pill: "0% loss",
      mode_lossless_desc:
        "Copies original video & audio streams without re-encoding. Bit-identical quality and instant export (~0.1s/clip).",
      snap_kf_label: "Snap start point to nearest keyframe (I-frame)",
      snap_kf_hint:
        "Prevents black or frozen lead-in frames during lossless cutting. Resulting length may vary by 0.2–1.5s depending on keyframe spacing.",
      mode_smart_title: "Hybrid — Smart Cut",
      mode_smart_pill: "~95% copy • 0.01s",
      mode_smart_desc:
        "Re-encodes only the tiny leading fraction up to the next I-frame, then bit-for-bit stream-copies the rest. Fast & frame-exact.",
      mode_precise_title: "Frame-Exact (Visually Lossless)",
      mode_precise_pill: "0.01s",
      mode_precise_desc:
        "Exact frame cutting regardless of keyframes (H.264 CRF 15 — visually indistinguishable, audio copied 100% losslessly).",

      output_title: "Output Files",
      output_subfolder_html:
        "Save in <code>Trimmed</code> subfolder next to originals",
      output_subfolder_name: "Trimmed",
      output_dir_empty: "No folder selected",
      output_dir_title: "Choose output folder",
      btn_change: "Browse...",
      suffix_label: "Filename suffix",
      preview_label: "Preview:",
      overwrite_label: "Overwrite existing files in output folder",

      footer_ready: "Ready to export: {selected} of {total}",
      footer_mode_lossless: "Stream Copy • 0% loss",
      footer_mode_smart: "Smart Cut • Hybrid",
      footer_mode_precise: "CRF 15 • Frame-exact",
      btn_trim_and_save: "Trim & Save",

      drag_title: "Drop videos here",
      drag_desc: "Supported formats: MP4, MKV, MOV, WEBM, AVI, TS",

      modal_export_running: "Trimming videos...",
      modal_export_sub_lossless:
        "FFmpeg Stream Copy engine (100% lossless, zero re-encoding)",
      modal_export_sub_smart:
        "Smart Cut hybrid engine (frame-exact lead-in + lossless stream copy)",
      modal_export_sub_precise:
        "FFmpeg Frame-Exact engine (CRF 15 video + lossless audio copy)",
      modal_export_done: "Done! All videos trimmed",
      modal_export_warn: "Finished with warnings",
      modal_close: "Close",
      modal_open_folder: "Open output folder",
      btn_trash_originals: "Move originals to Recycle Bin ({size})",
      recycle_confirm_prompt:
        "Move {n} original source file(s) ({size}) to the Windows Recycle Bin? Your trimmed outputs are already safely saved on disk.",
      recycle_cancel: "Cancel",
      recycle_confirm: "Yes, move to Recycle Bin",
      recycle_done_banner:
        "Moved {n} original file(s) to the Windows Recycle Bin — freed {size} of disk space.",
      export_progress_videos: "{done} / {total} videos",
      export_status_processing: "Processing...",
      export_status_queued: "Queued",
      export_status_error: "Error",
      export_summary_ok:
        "Success! {ok}/{total} videos saved {mode} in {sec}s • Saved {saved} of disk space ({before} → {after}).",
      export_summary_err:
        "Trimmed {ok}/{total} videos in {sec}s ({failed} errors). Saved {saved} of disk space.",
      export_mode_lossless_adv: "100% losslessly",
      export_mode_smart_adv: "with Smart Cut",
      export_mode_precise_adv: "frame-accurately",

      shortcuts_title: "Keyboard Shortcuts",
      sc_space_key: "Space",
      sc_space: "Play / Pause",
      sc_i: "Set trim start (IN)",
      sc_o: "Set trim end (OUT)",
      sc_frame: "Step by 1 exact frame",
      sc_lr: "Seek 0.5s (+Shift: 0.1s)",
      sc_kf: "Previous / Next keyframe (I-frame)",
      sc_ud: "Previous / Next clip in queue",
      sc_enter: "Mark reviewed & jump to next clip",
      sc_l: "Toggle selection loop",
      sc_m: "Mute / Unmute audio",
      sc_scroll_key: "Mouse wheel",
      sc_scroll: "Timeline zoom (+Shift: pan)",

      audio_tracks: "{n} audio tracks",
      toast_no_ffmpeg: "FFmpeg not detected. Check the bin/ folder.",
      toast_added_one: "Added 1 video to the queue.",
      toast_added_many: "Added {n} videos to the queue!",
      toast_session_restored: "Restored previous session ({n} videos).",
      toast_all_reviewed: "Nice! All clips in the queue are marked as reviewed.",
      toast_no_keyframes: "No keyframes detected for this clip.",
      toast_kf_jump: "Keyframe (I-frame): {t}s",
      toast_recycled_ok: "Moved {n} original file(s) to Recycle Bin ({size}).",
      toast_recycled_partial: "Could not move {n} file(s) (may be open in another app).",
      moment_reason_both: "audio + motion",
      moment_reason_audio: "audio spike",
      moment_reason_motion: "visual motion",
      toast_best_batch_done: "Found best moment ({d}s) on {n} video(s)!",
      toast_best_single: "✨ Best moment #{idx}/{total} ({t}s • {reason})",
      toast_skipped: "Skipped {n} file(s): {err}",
      toast_folder_empty: "No supported video files found in the selected folder.",
      toast_uploading: "Loading {n} file(s)...",
      toast_upload_err: "Failed to upload files.",
      toast_cleared: "Cleared the video queue.",
      toast_batch_applied: "Applied trim to {range} on {n} video(s)!",
      toast_range_end: "last {d}s",
      toast_range_start: "first {d}s",
      toast_range_middle: "middle {d}s",
      toast_range_custom: "range {s}s – {e}s",
      toast_select_one: "Select at least one video to export.",
      toast_pick_dir:
        "Choose an output folder or enable saving in the Trimmed subfolder.",
      toast_lost_status: "Lost export status: {err}",
      toast_set_in: "Set start (IN) to {t}s",
      toast_set_out: "Set end (OUT) to {t}s",
      server_err: "Server error ({status})",
    },
  };

  function detectInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "pl" || saved === "en") return saved;
    } catch (_) {}
    const browserLang = (navigator.language || "en").toLowerCase();
    return browserLang.startsWith("pl") ? "pl" : "en";
  }

  let currentLang = detectInitialLang();
  const listeners = [];

  function t(key, vars = {}) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    let str = dict[key] !== undefined ? dict[key] : TRANSLATIONS.en[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
    return str;
  }

  function formatVideoCount(n) {
    if (currentLang === "pl") {
      if (n === 1) return "1 film";
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return `${n} filmy`;
      }
      return `${n} filmów`;
    }
    return n === 1 ? "1 video" : `${n} videos`;
  }

  function applyStaticTranslations() {
    document.documentElement.lang = currentLang;
    document.title = t("page_title");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (key) el.innerHTML = t(key);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.dataset.i18nTitle;
      if (key) el.title = t(key);
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === currentLang);
    });
  }

  function setLang(lang) {
    if (lang !== "pl" && lang !== "en") return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
    applyStaticTranslations();
    listeners.forEach((fn) => {
      try {
        fn(lang);
      } catch (_) {}
    });
  }

  function getLang() {
    return currentLang;
  }

  function onLangChange(fn) {
    listeners.push(fn);
  }

  window.I18N = {
    t,
    getLang,
    setLang,
    onLangChange,
    applyStaticTranslations,
    formatVideoCount,
  };
})();
