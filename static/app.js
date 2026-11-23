(() => {
  "use strict";

  const { t, getLang, setLang, onLangChange, applyStaticTranslations, formatVideoCount } =
    window.I18N;

  // ── App State ─────────────────────────────────────────────────────────────
  const state = {
    clips: [], // { id, name, path, dir, ext, meta, start, end, selected, reviewed, keyframes, waveform }
    activeId: null,
    loopSelection: true,
    showWaveform: true,
    zoom: 1,
    viewStart: 0,
    outputDir: "",
    defaultOutputDir: "",
    exportPollTimer: null,
    lastOutputDir: "",
    lastExportJob: null,
    lastExportJobId: null,
    engineState: "ok", // "ok" | "no_ffmpeg" | "offline"
    isLoadingDialog: false,
    isDetectingBest: false,
    sessionSaveTimer: null,
    isRestoringSession: false,
  };

  // ── DOM References ────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const els = {
    engineStatusBadge: $("engineStatusBadge"),
    engineStatusText: $("engineStatusText"),
    langSwitch: $("langSwitch"),
    headerClipCount: $("headerClipCount"),
    queueCountBadge: $("queueCountBadge"),
    queueReviewedBadge: $("queueReviewedBadge"),
    queueList: $("queueList"),
    queueEmptyHint: $("queueEmptyHint"),

    emptyStage: $("emptyStage"),
    editorStage: $("editorStage"),
    activeClipIndex: $("activeClipIndex"),
    activeClipTitle: $("activeClipTitle"),
    activeClipMetaTags: $("activeClipMetaTags"),

    videoPlayer: $("videoPlayer"),
    playerCodecNotice: $("playerCodecNotice"),
    hudCurrentTime: $("hudCurrentTime"),
    hudTotalTime: $("hudTotalTime"),
    playerLoopBadge: $("playerLoopBadge"),

    btnMarkReviewed: $("btnMarkReviewed"),
    btnMarkReviewedText: $("btnMarkReviewedText"),
    btnPlayPause: $("btnPlayPause"),
    iconPlay: $("iconPlay"),
    iconPause: $("iconPause"),
    btnKfPrev: $("btnKfPrev"),
    btnFrameBack: $("btnFrameBack"),
    btnStepBack: $("btnStepBack"),
    btnStepFwd: $("btnStepFwd"),
    btnFrameFwd: $("btnFrameFwd"),
    btnKfNext: $("btnKfNext"),
    btnLoopToggle: $("btnLoopToggle"),
    btnSetIn: $("btnSetIn"),
    btnSetOut: $("btnSetOut"),
    playbackSpeed: $("playbackSpeed"),
    btnMute: $("btnMute"),
    iconVolOn: $("iconVolOn"),
    iconVolOff: $("iconVolOff"),
    btnPrevClip: $("btnPrevClip"),
    btnNextClip: $("btnNextClip"),

    inputStart: $("inputStart"),
    inputDuration: $("inputDuration"),
    inputEnd: $("inputEnd"),
    btnToggleWaveform: $("btnToggleWaveform"),
    btnZoomOut: $("btnZoomOut"),
    btnZoomReset: $("btnZoomReset"),
    btnZoomIn: $("btnZoomIn"),
    kfCountLabel: $("kfCountLabel"),

    timelineTrack: $("timelineTrack"),
    timelineFilmstrip: $("timelineFilmstrip"),
    timelineWaveform: $("timelineWaveform"),
    tlDimLeft: $("tlDimLeft"),
    tlDimRight: $("tlDimRight"),
    tlSelection: $("tlSelection"),
    tlSelectionLabel: $("tlSelectionLabel"),
    tlHandleLeft: $("tlHandleLeft"),
    tlHandleRight: $("tlHandleRight"),
    tlKeyframes: $("tlKeyframes"),
    tlPlayhead: $("tlPlayhead"),
    timelineZoomBar: $("timelineZoomBar"),
    timelineZoomThumb: $("timelineZoomThumb"),
    btnClipBestMoment: $("btnClipBestMoment"),

    batchDuration: $("batchDuration"),
    batchAnchor: $("batchAnchor"),
    batchCustomRange: $("batchCustomRange"),
    batchCustomStart: $("batchCustomStart"),
    batchCustomEnd: $("batchCustomEnd"),
    btnApplyBatch: $("btnApplyBatch"),
    applyBatchCount: $("applyBatchCount"),

    modeCardLossless: $("modeCardLossless"),
    modeCardSmart: $("modeCardSmart"),
    modeCardPrecise: $("modeCardPrecise"),
    snapKeyframeBox: $("snapKeyframeBox"),
    chkSnapKeyframe: $("chkSnapKeyframe"),

    chkSourceSubfolder: $("chkSourceSubfolder"),
    customOutputDirWrap: $("customOutputDirWrap"),
    outputDirDisplay: $("outputDirDisplay"),
    btnPickOutputDir: $("btnPickOutputDir"),
    inputSuffix: $("inputSuffix"),
    outputNamePreview: $("outputNamePreview"),
    chkOverwrite: $("chkOverwrite"),

    exportReadyLabel: $("exportReadyLabel"),
    exportModeIndicator: $("exportModeIndicator"),
    btnMainExport: $("btnMainExport"),
    mainExportCount: $("mainExportCount"),
    btnTopExport: $("btnTopExport"),

    btnPickFiles: $("btnPickFiles"),
    btnPickFolder: $("btnPickFolder"),
    btnHeroPickFiles: $("btnHeroPickFiles"),
    btnHeroPickFolder: $("btnHeroPickFolder"),
    btnToggleSelectAll: $("btnToggleSelectAll"),
    btnClearQueue: $("btnClearQueue"),
    btnShortcuts: $("btnShortcuts"),

    dragOverlay: $("dragOverlay"),
    exportModal: $("exportModal"),
    exportModalTitle: $("exportModalTitle"),
    exportModalSubtitle: $("exportModalSubtitle"),
    exportProgressBar: $("exportProgressBar"),
    exportProgressText: $("exportProgressText"),
    exportProgressPct: $("exportProgressPct"),
    exportSummaryBanner: $("exportSummaryBanner"),
    exportResultsList: $("exportResultsList"),
    recycleConfirmBar: $("recycleConfirmBar"),
    recycleConfirmText: $("recycleConfirmText"),
    btnCancelRecycle: $("btnCancelRecycle"),
    btnConfirmRecycle: $("btnConfirmRecycle"),
    recycleDoneBanner: $("recycleDoneBanner"),
    btnTrashOriginals: $("btnTrashOriginals"),
    btnTrashOriginalsText: $("btnTrashOriginalsText"),
    btnCloseExportModal: $("btnCloseExportModal"),
    btnExportModalDone: $("btnExportModalDone"),
    btnOpenOutputFolder: $("btnOpenOutputFolder"),

    shortcutsModal: $("shortcutsModal"),
    btnCloseShortcuts: $("btnCloseShortcuts"),
    toastStack: $("toastStack"),
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const mins = Math.floor(sec / 60);
    const rem = sec - mins * 60;
    const mm = String(mins).padStart(2, "0");
    const ss = rem.toFixed(2).padStart(5, "0");
    return `${mm}:${ss}`;
  }

  function formatShortSec(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    return `${sec.toFixed(1)}s`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let idx = 0;
    let val = bytes;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return `${val.toFixed(idx >= 2 ? 2 : 0)} ${units[idx]}`;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function showToast(message, type = "info", duration = 3200) {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    els.toastStack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-8px)";
      el.style.transition = "all 0.2s ease";
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  function getActiveClip() {
    return state.clips.find((c) => c.id === state.activeId) || null;
  }

  function getSelectedClips() {
    return state.clips.filter((c) => c.selected);
  }

  function getExportMode() {
    const checked = document.querySelector('input[name="exportMode"]:checked');
    return checked ? checked.value : "lossless";
  }

  function renderEngineBadge() {
    const isErr = state.engineState !== "ok";
    els.engineStatusBadge.classList.toggle("error", isErr);
    if (state.engineState === "no_ffmpeg") {
      els.engineStatusText.textContent = t("engine_no_ffmpeg");
    } else if (state.engineState === "offline") {
      els.engineStatusText.textContent = t("engine_offline");
    } else {
      els.engineStatusText.textContent = t("engine_ok");
    }
  }

  function renderOutputDirDisplay() {
    if (state.outputDir) {
      els.outputDirDisplay.textContent = state.outputDir;
      els.outputDirDisplay.title = state.outputDir;
    } else {
      els.outputDirDisplay.textContent = t("output_dir_empty");
      els.outputDirDisplay.title = t("output_dir_title");
    }
  }

  function computeRangeForRule(duration, anchor, targetDur, customStart, customEnd) {
    if (!duration || duration <= 0.1) return { start: 0, end: Math.max(0.1, duration || 5) };
    const safeDur = clamp(targetDur || 5, 0.2, duration);

    if (anchor === "start") {
      return { start: 0, end: round2(safeDur) };
    }
    if (anchor === "middle") {
      const mid = duration / 2;
      const s = clamp(mid - safeDur / 2, 0, Math.max(0, duration - safeDur));
      return { start: round2(s), end: round2(Math.min(duration, s + safeDur)) };
    }
    if (anchor === "custom") {
      const s = clamp(Number(customStart) || 0, 0, Math.max(0, duration - 0.2));
      const e = clamp(Number(customEnd) || duration, s + 0.2, duration);
      return { start: round2(s), end: round2(e) };
    }
    // Default: "end" (last N seconds)
    const s = Math.max(0, duration - safeDur);
    return { start: round2(s), end: round2(duration) };
  }

  // ── API Calls ─────────────────────────────────────────────────────────────
  async function apiJson(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || t("server_err", { status: res.status }));
    }
    return data;
  }

  // ── Session Auto-Save & Restore ───────────────────────────────────────────
  function buildSessionPayload() {
    const active = getActiveClip();
    return {
      clips: state.clips.map((c) => ({
        path: c.path,
        start: round2(c.start),
        end: round2(c.end),
        selected: !!c.selected,
        reviewed: !!c.reviewed,
      })),
      active_path: active ? active.path : null,
      settings: {
        mode: getExportMode(),
        snap_keyframe: els.chkSnapKeyframe.checked,
        batch_duration: parseFloat(els.batchDuration.value) || 5,
        batch_anchor: els.batchAnchor.value,
        batch_custom_start: parseFloat(els.batchCustomStart.value) || 0,
        batch_custom_end: parseFloat(els.batchCustomEnd.value) || 5,
        use_source_subfolder: els.chkSourceSubfolder.checked,
        output_dir: state.outputDir,
        suffix: els.inputSuffix.value ?? "_cut",
        overwrite: els.chkOverwrite.checked,
        show_waveform: state.showWaveform,
      },
    };
  }

  function scheduleSessionSave() {
    if (state.isRestoringSession) return;
    if (state.sessionSaveTimer) clearTimeout(state.sessionSaveTimer);
    state.sessionSaveTimer = setTimeout(() => {
      state.sessionSaveTimer = null;
      fetch("/api/session/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSessionPayload()),
      }).catch(() => {});
    }, 450);
  }

  function applySavedSettings(s) {
    if (!s || typeof s !== "object") return;
    if (s.mode && ["lossless", "smart", "precise"].includes(s.mode)) {
      const radio = document.querySelector(`input[name="exportMode"][value="${s.mode}"]`);
      if (radio) radio.checked = true;
    }
    if (typeof s.snap_keyframe === "boolean") {
      els.chkSnapKeyframe.checked = s.snap_keyframe;
    }
    if (Number.isFinite(Number(s.batch_duration)) && Number(s.batch_duration) > 0) {
      els.batchDuration.value = String(s.batch_duration);
      document.querySelectorAll("[data-batch-dur]").forEach((b) => {
        b.classList.toggle("active", b.dataset.batchDur === els.batchDuration.value);
      });
    }
    if (s.batch_anchor && ["end", "best", "start", "middle", "custom"].includes(s.batch_anchor)) {
      els.batchAnchor.value = s.batch_anchor;
      els.batchCustomRange.classList.toggle("hidden", s.batch_anchor !== "custom");
    }
    if (Number.isFinite(Number(s.batch_custom_start))) {
      els.batchCustomStart.value = String(s.batch_custom_start);
    }
    if (Number.isFinite(Number(s.batch_custom_end))) {
      els.batchCustomEnd.value = String(s.batch_custom_end);
    }
    if (typeof s.use_source_subfolder === "boolean") {
      els.chkSourceSubfolder.checked = s.use_source_subfolder;
      els.customOutputDirWrap.classList.toggle("hidden", s.use_source_subfolder);
    }
    if (typeof s.output_dir === "string") {
      state.outputDir = s.output_dir;
      renderOutputDirDisplay();
    }
    if (typeof s.suffix === "string") {
      els.inputSuffix.value = s.suffix;
    }
    if (typeof s.overwrite === "boolean") {
      els.chkOverwrite.checked = s.overwrite;
    }
    if (typeof s.show_waveform === "boolean") {
      state.showWaveform = s.show_waveform;
      els.btnToggleWaveform.classList.toggle("active", state.showWaveform);
    }
    syncModeCards();
    updateFilenamePreview();
  }

  async function initHealthCheck() {
    try {
      const data = await apiJson("/api/health");
      state.defaultOutputDir = data.default_output_dir || "";
      if (!data.ffmpeg_ok) {
        state.engineState = "no_ffmpeg";
        renderEngineBadge();
        showToast(t("toast_no_ffmpeg"), "error", 6000);
      } else {
        state.engineState = "ok";
        renderEngineBadge();
      }

      state.isRestoringSession = true;
      try {
        const [existing, saved] = await Promise.all([
          apiJson("/api/clips"),
          apiJson("/api/session/restore").catch(() => ({
            clips: [],
            states_by_path: {},
            active_path: null,
            settings: {},
          })),
        ]);

        applySavedSettings(saved.settings);

        const statesByPath = saved.states_by_path || {};
        const restoredClips =
          existing.clips && existing.clips.length > 0 ? existing.clips : saved.clips || [];

        if (restoredClips.length > 0) {
          ingestBackendClips(restoredClips, false, statesByPath);
          if (saved.active_path) {
            const match = state.clips.find(
              (c) => c.path.toLowerCase() === saved.active_path.toLowerCase()
            );
            if (match && match.id !== state.activeId) {
              selectClip(match.id);
            }
          }
          if ((!existing.clips || existing.clips.length === 0) && state.clips.length > 0) {
            showToast(t("toast_session_restored", { n: state.clips.length }), "info", 3000);
          }
        }
      } finally {
        state.isRestoringSession = false;
      }
    } catch (err) {
      state.engineState = "offline";
      renderEngineBadge();
    }
  }

  function ingestBackendClips(rawClips, announce = true, statesByPath = null) {
    if (!rawClips || rawClips.length === 0) return;

    const anchor = els.batchAnchor.value;
    const targetDur = parseFloat(els.batchDuration.value) || 5;
    const customStart = parseFloat(els.batchCustomStart.value) || 0;
    const customEnd = parseFloat(els.batchCustomEnd.value) || 5;

    const newlyAdded = [];
    for (const raw of rawClips) {
      if (state.clips.some((c) => c.id === raw.id)) continue;
      const dur = Number(raw.meta?.duration || 0);
      let { start, end } = computeRangeForRule(
        dur,
        anchor === "best" ? "end" : anchor,
        targetDur,
        customStart,
        customEnd
      );
      let selected = true;
      let reviewed = false;

      const savedState = statesByPath && raw.path ? statesByPath[raw.path.toLowerCase()] : null;
      if (savedState) {
        const safeDur = Math.max(0.2, dur || 1);
        const s = clamp(Number(savedState.start) || 0, 0, Math.max(0, safeDur - 0.1));
        const e = clamp(Number(savedState.end) || safeDur, s + 0.1, safeDur);
        start = round2(s);
        end = round2(e);
        selected = savedState.selected !== false;
        reviewed = !!savedState.reviewed;
      }

      const clipObj = {
        id: raw.id,
        name: raw.name,
        path: raw.path,
        dir: raw.dir,
        ext: raw.ext,
        is_uploaded: !!raw.is_uploaded,
        meta: raw.meta || {},
        start,
        end,
        selected,
        reviewed,
        keyframes: null,
        waveform: null,
        bestMoments: null,
        bestMomentIdx: -1,
      };
      state.clips.push(clipObj);
      newlyAdded.push(clipObj);
    }

    const addedCount = newlyAdded.length;
    if (addedCount > 0) {
      if (!state.activeId && state.clips.length > 0) {
        selectClip(state.clips[0].id);
      }
      renderQueue();
      updateGlobalCounters();
      updateFilenamePreview();
      scheduleSessionSave();
      if (announce) {
        showToast(
          addedCount === 1
            ? t("toast_added_one")
            : t("toast_added_many", { n: addedCount }),
          "success"
        );
      }
      // If "Best moment" is the active batch rule and clips weren't restored from saved ranges, auto-detect!
      if (!statesByPath && anchor === "best") {
        applyBestMomentToClips(newlyAdded, targetDur, false);
      }
    }
  }

  async function triggerPickFiles() {
    if (state.isLoadingDialog) return;
    state.isLoadingDialog = true;
    try {
      const data = await apiJson(`/api/dialogs/pick-files?lang=${getLang()}`, { method: "POST" });
      if (!data.cancelled) {
        ingestBackendClips(data.clips, true);
        if (data.errors && data.errors.length) {
          showToast(
            t("toast_skipped", { n: data.errors.length, err: data.errors[0] }),
            "error",
            5000
          );
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.isLoadingDialog = false;
    }
  }

  async function triggerPickFolder() {
    if (state.isLoadingDialog) return;
    state.isLoadingDialog = true;
    try {
      const data = await apiJson(`/api/dialogs/pick-folder?lang=${getLang()}`, { method: "POST" });
      if (!data.cancelled) {
        if (!data.clips || data.clips.length === 0) {
          showToast(t("toast_folder_empty"), "error");
        } else {
          ingestBackendClips(data.clips, true);
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.isLoadingDialog = false;
    }
  }

  async function handleDroppedFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    showToast(t("toast_uploading", { n: files.length }), "info", 2200);
    const form = new FormData();
    for (const f of files) {
      form.append("files", f);
    }
    try {
      const res = await fetch("/api/files/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("toast_upload_err"));
      ingestBackendClips(data.clips, true);
      if (data.errors && data.errors.length) {
        showToast(data.errors[0], "error", 4500);
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function removeClip(clipId) {
    try {
      await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
    } catch (_) {}

    const idx = state.clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return;
    state.clips.splice(idx, 1);

    if (state.activeId === clipId) {
      if (state.clips.length > 0) {
        const nextIdx = Math.min(idx, state.clips.length - 1);
        selectClip(state.clips[nextIdx].id);
      } else {
        state.activeId = null;
        els.videoPlayer.pause();
        els.videoPlayer.removeAttribute("src");
        els.videoPlayer.load();
        els.editorStage.classList.add("hidden");
        els.emptyStage.classList.remove("hidden");
      }
    }
    renderQueue();
    updateGlobalCounters();
    updateFilenamePreview();
    scheduleSessionSave();
  }

  async function clearAllClips() {
    if (!state.clips.length) return;
    try {
      await fetch("/api/clips/clear", { method: "POST" });
    } catch (_) {}
    state.clips = [];
    state.activeId = null;
    els.videoPlayer.pause();
    els.videoPlayer.removeAttribute("src");
    els.videoPlayer.load();
    els.editorStage.classList.add("hidden");
    els.emptyStage.classList.remove("hidden");
    renderQueue();
    updateGlobalCounters();
    updateFilenamePreview();
    scheduleSessionSave();
    showToast(t("toast_cleared"));
  }

  // ── Rendering Queue & Active Clip ─────────────────────────────────────────
  function renderQueue() {
    els.queueCountBadge.textContent = String(state.clips.length);
    if (state.clips.length === 0) {
      els.queueList.innerHTML = "";
      els.queueList.appendChild(els.queueEmptyHint);
      els.queueEmptyHint.classList.remove("hidden");
      return;
    }

    const frag = document.createDocumentFragment();
    state.clips.forEach((clip) => {
      const card = document.createElement("div");
      card.className = "clip-card";
      if (clip.id === state.activeId) card.classList.add("active");
      if (!clip.selected) card.classList.add("unchecked");
      if (clip.reviewed) card.classList.add("reviewed");
      card.dataset.id = clip.id;

      const origDur = Number(clip.meta?.duration || 0);
      const cutDur = Math.max(0, clip.end - clip.start);
      const isTrimmed = origDur > 0 && Math.abs(origDur - cutDur) > 0.15;
      const resLabel = clip.meta?.height ? `${clip.meta.height}p` : "";
      const fpsLabel = clip.meta?.fps ? `${Math.round(clip.meta.fps)}fps` : "";
      const codecLabel = clip.meta?.video_codec || "";
      const subParts = [resLabel, fpsLabel, codecLabel].filter(Boolean).join(" • ");

      card.innerHTML = `
        <input type="checkbox" class="clip-check" ${clip.selected ? "checked" : ""} title="${escapeHtml(t("clip_include_title"))}" />
        <div class="clip-thumb-box">
          <img src="/api/media/${clip.id}/thumb" alt="" loading="lazy" />
          <span class="clip-thumb-badge">${formatShortSec(origDur)}</span>
        </div>
        <div class="clip-info">
          <div class="clip-name" title="${escapeHtml(clip.name)}">${escapeHtml(clip.name)}</div>
          <div class="clip-submeta">${escapeHtml(subParts || formatBytes(clip.meta?.size_bytes))}</div>
          <div class="clip-trim-row">
            <span class="trim-pill ${isTrimmed ? "" : "full"}">${formatShortSec(origDur)} → ${formatShortSec(cutDur)}</span>
            ${clip.reviewed ? `<span class="clip-reviewed-pill" title="${escapeHtml(t("clip_reviewed_badge"))}">✓</span>` : ""}
          </div>
        </div>
        <button class="clip-remove-btn" title="${escapeHtml(t("clip_remove_title"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      `;

      const checkbox = card.querySelector(".clip-check");
      checkbox.addEventListener("click", (e) => e.stopPropagation());
      checkbox.addEventListener("change", () => {
        clip.selected = checkbox.checked;
        card.classList.toggle("unchecked", !clip.selected);
        updateGlobalCounters();
        scheduleSessionSave();
      });

      const removeBtn = card.querySelector(".clip-remove-btn");
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeClip(clip.id);
      });

      card.addEventListener("click", () => selectClip(clip.id));
      frag.appendChild(card);
    });

    els.queueList.innerHTML = "";
    els.queueList.appendChild(frag);
    updateReviewedUI();
  }

  function updateQueueCardTrim(clip) {
    const card = els.queueList.querySelector(`.clip-card[data-id="${clip.id}"]`);
    if (!card) return;
    const pill = card.querySelector(".trim-pill");
    if (pill) {
      const origDur = Number(clip.meta?.duration || 0);
      const cutDur = Math.max(0, clip.end - clip.start);
      const isTrimmed = origDur > 0 && Math.abs(origDur - cutDur) > 0.15;
      pill.textContent = `${formatShortSec(origDur)} → ${formatShortSec(cutDur)}`;
      pill.classList.toggle("full", !isTrimmed);
    }
    card.classList.toggle("reviewed", !!clip.reviewed);
    const trimRow = card.querySelector(".clip-trim-row");
    if (trimRow) {
      let badge = trimRow.querySelector(".clip-reviewed-pill");
      if (clip.reviewed && !badge) {
        badge = document.createElement("span");
        badge.className = "clip-reviewed-pill";
        badge.title = t("clip_reviewed_badge");
        badge.textContent = "✓";
        trimRow.appendChild(badge);
      } else if (!clip.reviewed && badge) {
        badge.remove();
      }
    }
  }

  function updateReviewedUI() {
    const total = state.clips.length;
    const reviewedCount = state.clips.filter((c) => c.reviewed).length;
    if (total === 0) {
      els.queueReviewedBadge.classList.add("hidden");
    } else {
      els.queueReviewedBadge.classList.remove("hidden");
      els.queueReviewedBadge.textContent = `${reviewedCount}/${total} ✓`;
    }

    const active = getActiveClip();
    const isRev = !!(active && active.reviewed);
    els.btnMarkReviewed.classList.toggle("is-reviewed", isRev);
    els.btnMarkReviewedText.textContent = isRev ? t("btn_reviewed_done") : t("btn_review");
  }

  function markActiveReviewedAndAdvance(toggleOnly = false) {
    const clip = getActiveClip();
    if (!clip) return;

    if (toggleOnly) {
      clip.reviewed = !clip.reviewed;
      updateQueueCardTrim(clip);
      updateReviewedUI();
      scheduleSessionSave();
      return;
    }

    clip.reviewed = true;
    updateQueueCardTrim(clip);
    updateReviewedUI();
    scheduleSessionSave();

    const curIdx = state.clips.findIndex((c) => c.id === clip.id);
    // Jump to next unreviewed clip after current, or wrap to first unreviewed, or next clip
    let nextIdx = -1;
    for (let i = curIdx + 1; i < state.clips.length; i++) {
      if (!state.clips[i].reviewed) {
        nextIdx = i;
        break;
      }
    }
    if (nextIdx === -1) {
      for (let i = 0; i < curIdx; i++) {
        if (!state.clips[i].reviewed) {
          nextIdx = i;
          break;
        }
      }
    }

    if (nextIdx !== -1) {
      const targetClip = state.clips[nextIdx];
      selectClip(targetClip.id);
      const card = els.queueList.querySelector(`.clip-card[data-id="${targetClip.id}"]`);
      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      showToast(t("toast_all_reviewed"), "success", 2800);
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateGlobalCounters() {
    const total = state.clips.length;
    const selected = getSelectedClips().length;

    els.headerClipCount.textContent = formatVideoCount(total);
    els.applyBatchCount.textContent = String(selected);
    els.mainExportCount.textContent = String(selected);
    els.exportReadyLabel.textContent = t("footer_ready", { selected, total });

    els.btnApplyBatch.disabled = selected === 0 || state.isDetectingBest;
    els.btnMainExport.disabled = selected === 0;
    els.btnTopExport.disabled = selected === 0;

    const mode = getExportMode();
    if (mode === "lossless") {
      els.exportModeIndicator.textContent = t("footer_mode_lossless");
      els.exportModeIndicator.style.color = "#6ee7b7";
    } else if (mode === "smart") {
      els.exportModeIndicator.textContent = t("footer_mode_smart");
      els.exportModeIndicator.style.color = "#67e8f9";
    } else {
      els.exportModeIndicator.textContent = t("footer_mode_precise");
      els.exportModeIndicator.style.color = "#c7d2fe";
    }
    updateReviewedUI();
  }

  function updateFilenamePreview() {
    const active = getActiveClip() || state.clips[0];
    const suffix = els.inputSuffix.value || "";
    if (!active) {
      els.outputNamePreview.textContent = `event_01${suffix}.mp4`;
      return;
    }
    const dotIdx = active.name.lastIndexOf(".");
    const stem = dotIdx > 0 ? active.name.slice(0, dotIdx) : active.name;
    const ext = dotIdx > 0 ? active.name.slice(dotIdx) : ".mp4";
    els.outputNamePreview.textContent = `${stem}${suffix}${ext}`;
  }

  function renderActiveClipMetaTags(clip) {
    const tags = [];
    if (clip.meta?.width && clip.meta?.height) tags.push(`${clip.meta.width}×${clip.meta.height}`);
    if (clip.meta?.fps) tags.push(`${clip.meta.fps} fps`);
    if (clip.meta?.video_codec) tags.push(clip.meta.video_codec);
    if (clip.meta?.audio_tracks > 0) {
      tags.push(
        clip.meta.audio_tracks > 1
          ? t("audio_tracks", { n: clip.meta.audio_tracks })
          : clip.meta.audio_codec || "Audio"
      );
    }
    if (clip.meta?.size_bytes) tags.push(formatBytes(clip.meta.size_bytes));

    els.activeClipMetaTags.innerHTML = tags
      .map((tag) => `<span class="meta-tag">${escapeHtml(tag)}</span>`)
      .join("");
  }

  // ── Zoom & Viewport Math ──────────────────────────────────────────────────
  function getClipDuration(clip = getActiveClip()) {
    return Math.max(0.1, Number(clip?.meta?.duration || els.videoPlayer.duration || 1));
  }

  function getViewDuration(dur) {
    return dur / Math.max(1, state.zoom);
  }

  function clampViewStart(vs, dur) {
    const maxStart = Math.max(0, dur - getViewDuration(dur));
    return clamp(vs, 0, maxStart);
  }

  function timeToViewPct(sec, dur) {
    const viewDur = Math.max(0.01, getViewDuration(dur));
    return ((sec - state.viewStart) / viewDur) * 100;
  }

  function setTimelineZoom(newZoom, anchorSec = null, anchorRatio = 0.5) {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = getClipDuration(clip);
    const z = clamp(Math.round(newZoom * 10) / 10, 1, 20);
    const refSec =
      anchorSec !== null ? anchorSec : state.viewStart + getViewDuration(dur) * anchorRatio;

    state.zoom = z;
    if (z <= 1.01) {
      state.zoom = 1;
      state.viewStart = 0;
    } else {
      const newViewDur = dur / z;
      state.viewStart = clampViewStart(refSec - anchorRatio * newViewDur, dur);
    }
    updateTimelineUI();
  }

  function resetTimelineZoom() {
    state.zoom = 1;
    state.viewStart = 0;
  }

  function drawWaveform() {
    const canvas = els.timelineWaveform;
    if (!canvas) return;
    const rect = els.timelineTrack.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const clip = getActiveClip();
    if (!state.showWaveform || !clip || !clip.waveform || !clip.waveform.length) {
      return;
    }

    const peaks = clip.waveform;
    const dur = getClipDuration(clip);
    const viewDur = getViewDuration(dur);
    const startRatio = clamp(state.viewStart / dur, 0, 1);
    const endRatio = clamp((state.viewStart + viewDur) / dur, startRatio, 1);

    const idxStart = Math.floor(startRatio * peaks.length);
    const idxEnd = Math.min(peaks.length, Math.ceil(endRatio * peaks.length));
    const visibleCount = Math.max(1, idxEnd - idxStart);

    // Target clean bar spacing (~3px per bar)
    const maxBarsToDraw = Math.max(30, Math.floor(cssW / 3));
    const barsCount = Math.min(visibleCount, maxBarsToDraw);
    const barW = cssW / barsCount;
    const centerY = cssH * 0.56;
    const maxHalfH = cssH * 0.34;

    ctx.fillStyle = "rgba(56, 189, 248, 0.36)";
    for (let i = 0; i < barsCount; i++) {
      const sLo = idxStart + Math.floor((i / barsCount) * visibleCount);
      const sHi = Math.max(sLo + 1, idxStart + Math.floor(((i + 1) / barsCount) * visibleCount));
      let peak = 0;
      for (let j = sLo; j < Math.min(sHi, peaks.length); j++) {
        if (peaks[j] > peak) peak = peaks[j];
      }
      const h = Math.max(1.5, peak * maxHalfH);
      const x = i * barW;
      const drawW = Math.max(1.2, barW - 1);
      ctx.fillRect(x, centerY - h, drawW, h * 2);
    }

    // Subtle crisp midline
    ctx.fillStyle = "rgba(103, 232, 249, 0.18)";
    ctx.fillRect(0, centerY - 0.5, cssW, 1);
  }

  async function selectClip(clipId) {
    const idx = state.clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return;

    state.activeId = clipId;
    const clip = state.clips[idx];
    resetTimelineZoom();

    els.emptyStage.classList.add("hidden");
    els.editorStage.classList.remove("hidden");
    els.playerCodecNotice.classList.add("hidden");

    // Highlight active card
    els.queueList.querySelectorAll(".clip-card").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === clipId);
    });

    // Header info
    els.activeClipIndex.textContent = `${idx + 1} / ${state.clips.length}`;
    els.activeClipTitle.textContent = clip.name;
    els.activeClipTitle.title = clip.path;
    renderActiveClipMetaTags(clip);
    updateReviewedUI();

    els.btnPrevClip.disabled = idx === 0;
    els.btnNextClip.disabled = idx === state.clips.length - 1;

    // Load video stream
    els.videoPlayer.pause();
    updatePlayIcon(false);
    els.videoPlayer.src = `/api/media/${clip.id}/stream`;
    els.videoPlayer.playbackRate = parseFloat(els.playbackSpeed.value) || 1;
    els.hudTotalTime.textContent = formatTime(clip.meta?.duration || 0);
    els.hudCurrentTime.textContent = formatTime(clip.start);

    // Seek to clip.start once metadata is ready
    const onLoaded = () => {
      if (state.activeId !== clip.id) return;
      if (Number.isFinite(els.videoPlayer.duration) && els.videoPlayer.duration > 0) {
        if (!clip.meta.duration) clip.meta.duration = els.videoPlayer.duration;
      }
      seekVideo(clip.start);
      updateTimelineUI();
    };
    els.videoPlayer.addEventListener("loadedmetadata", onLoaded, { once: true });

    // Load filmstrip background
    els.timelineFilmstrip.style.backgroundImage = `url("/api/media/${clip.id}/filmstrip")`;

    // Update timeline & numeric inputs immediately
    updateTimelineUI();
    updateFilenamePreview();
    scheduleSessionSave();

    // Fetch waveform lazily
    if (clip.waveform === null && clip.meta?.audio_tracks > 0) {
      apiJson(`/api/media/${clip.id}/waveform`)
        .then((res) => {
          clip.waveform = Array.isArray(res.peaks) ? res.peaks : [];
          if (state.activeId === clip.id) {
            drawWaveform();
          }
        })
        .catch(() => {
          clip.waveform = [];
        });
    } else if (clip.waveform === null) {
      clip.waveform = [];
    }

    // Fetch keyframes lazily for visual I-frame ticks
    renderKeyframeTicks(clip.keyframes || []);
    if (clip.keyframes === null) {
      els.kfCountLabel.textContent = t("tl_keyframes_loading");
      try {
        const res = await apiJson(`/api/media/${clip.id}/keyframes`);
        clip.keyframes = res.keyframes || [];
        if (state.activeId === clip.id) {
          renderKeyframeTicks(clip.keyframes);
        }
      } catch (_) {
        clip.keyframes = [];
        if (state.activeId === clip.id) {
          els.kfCountLabel.textContent = t("tl_keyframes");
        }
      }
    }
  }

  function renderKeyframeTicks(keyframes) {
    const clip = getActiveClip();
    els.tlKeyframes.innerHTML = "";
    if (!clip || !clip.meta?.duration || !keyframes || !keyframes.length) {
      els.kfCountLabel.textContent = t("tl_keyframes");
      return;
    }
    const dur = getClipDuration(clip);
    const viewEnd = state.viewStart + getViewDuration(dur);
    const visibleKfs = keyframes.filter((kf) => kf >= state.viewStart - 0.05 && kf <= viewEnd + 0.05);

    // Cap rendered ticks if zoomed out on a huge clip
    const step = visibleKfs.length > 100 ? Math.ceil(visibleKfs.length / 100) : 1;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < visibleKfs.length; i += step) {
      const pct = timeToViewPct(visibleKfs[i], dur);
      if (pct < 0 || pct > 100) continue;
      const tick = document.createElement("div");
      tick.className = "kf-tick";
      tick.style.left = `${pct}%`;
      frag.appendChild(tick);
    }
    els.tlKeyframes.appendChild(frag);
    els.kfCountLabel.textContent = t("tl_keyframes_count", { n: keyframes.length });
  }

  // ── Timeline & Player Synchronization ─────────────────────────────────────
  function updateZoomBarUI(dur) {
    const zoomed = state.zoom > 1.01;
    els.btnZoomReset.textContent = `${state.zoom.toFixed(1)}x`;
    els.btnZoomReset.classList.toggle("zoomed", zoomed);
    els.timelineZoomBar.classList.toggle("hidden", !zoomed);
    if (zoomed) {
      const viewDur = getViewDuration(dur);
      const leftPct = clamp((state.viewStart / dur) * 100, 0, 100);
      const widthPct = clamp((viewDur / dur) * 100, 4, 100);
      els.timelineZoomThumb.style.left = `${leftPct}%`;
      els.timelineZoomThumb.style.width = `${widthPct}%`;
    }
  }

  function updateTimelineUI() {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = getClipDuration(clip);
    state.viewStart = clampViewStart(state.viewStart, dur);
    const viewDur = getViewDuration(dur);

    // Scale & offset filmstrip to match zoom viewport
    els.timelineFilmstrip.style.width = `${state.zoom * 100}%`;
    els.timelineFilmstrip.style.left = `${-(state.viewStart / viewDur) * 100}%`;

    const startPct = timeToViewPct(clip.start, dur);
    const endPct = timeToViewPct(clip.end, dur);
    const widthPct = Math.max(0.5, endPct - startPct);

    els.tlDimLeft.style.width = `${clamp(startPct, 0, 100)}%`;
    els.tlDimRight.style.width = `${clamp(100 - endPct, 0, 100)}%`;
    els.tlSelection.style.left = `${startPct}%`;
    els.tlSelection.style.width = `${widthPct}%`;

    const selDur = Math.max(0, clip.end - clip.start);
    els.tlSelectionLabel.textContent = `${selDur.toFixed(1)}s`;

    // Sync inputs only if not actively focused
    if (document.activeElement !== els.inputStart) {
      els.inputStart.value = clip.start.toFixed(2);
    }
    if (document.activeElement !== els.inputEnd) {
      els.inputEnd.value = clip.end.toFixed(2);
    }
    if (document.activeElement !== els.inputDuration) {
      els.inputDuration.value = selDur.toFixed(2);
    }

    updateZoomBarUI(dur);
    drawWaveform();
    if (clip.keyframes && clip.keyframes.length) {
      renderKeyframeTicks(clip.keyframes);
    }
    updatePlayheadUI(els.videoPlayer.currentTime || clip.start);
    updateQueueCardTrim(clip);
  }

  function updatePlayheadUI(currentTime) {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = getClipDuration(clip);
    const pct = timeToViewPct(currentTime, dur);
    els.tlPlayhead.style.left = `${pct}%`;
    els.tlPlayhead.style.opacity = pct >= -1 && pct <= 101 ? "1" : "0";
    els.hudCurrentTime.textContent = formatTime(currentTime);
  }

  let pendingSeekTime = null;
  let seekRafId = null;

  function seekVideo(targetSec, immediate = false) {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = Number(clip.meta?.duration || els.videoPlayer.duration || 0);
    const clamped = clamp(targetSec, 0, Math.max(0, dur));

    // Keep playhead visible if zoomed in and seeking outside viewport
    if (state.zoom > 1.01 && dur > 0) {
      const viewDur = getViewDuration(dur);
      if (clamped < state.viewStart || clamped > state.viewStart + viewDur) {
        state.viewStart = clampViewStart(clamped - viewDur * 0.5, dur);
        updateTimelineUI();
      }
    }

    updatePlayheadUI(clamped);

    if (immediate) {
      try {
        els.videoPlayer.currentTime = clamped;
      } catch (_) {}
      return;
    }

    pendingSeekTime = clamped;
    if (!seekRafId) {
      seekRafId = requestAnimationFrame(() => {
        seekRafId = null;
        if (pendingSeekTime !== null) {
          try {
            els.videoPlayer.currentTime = pendingSeekTime;
          } catch (_) {}
          pendingSeekTime = null;
        }
      });
    }
  }

  function stepFrame(dir) {
    const clip = getActiveClip();
    if (!clip) return;
    els.videoPlayer.pause();
    const fps = clip.meta?.fps && clip.meta.fps > 1 ? clip.meta.fps : 30;
    const step = (1 / fps) * dir;
    const cur = els.videoPlayer.currentTime || 0;
    seekVideo(cur + step, true);
  }

  async function jumpKeyframe(dir) {
    const clip = getActiveClip();
    if (!clip) return;
    if (clip.keyframes === null) {
      try {
        const res = await apiJson(`/api/media/${clip.id}/keyframes`);
        clip.keyframes = res.keyframes || [];
        if (state.activeId === clip.id) renderKeyframeTicks(clip.keyframes);
      } catch (_) {
        clip.keyframes = [];
      }
    }
    const kfs = clip.keyframes || [];
    if (!kfs.length) {
      showToast(t("toast_no_keyframes"), "info", 1600);
      return;
    }

    els.videoPlayer.pause();
    const cur = els.videoPlayer.currentTime || 0;
    let target = null;
    if (dir < 0) {
      for (let i = kfs.length - 1; i >= 0; i--) {
        if (kfs[i] < cur - 0.03) {
          target = kfs[i];
          break;
        }
      }
    } else {
      for (let i = 0; i < kfs.length; i++) {
        if (kfs[i] > cur + 0.03) {
          target = kfs[i];
          break;
        }
      }
    }

    if (target !== null) {
      seekVideo(target, true);
      showToast(t("toast_kf_jump", { t: target.toFixed(2) }), "info", 1200);
    }
  }

  function setClipRange(start, end, seekTo = null) {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = Math.max(0.2, Number(clip.meta?.duration || els.videoPlayer.duration || 1));
    const minLen = Math.min(0.2, dur);

    let s = clamp(start, 0, Math.max(0, dur - minLen));
    let e = clamp(end, s + minLen, dur);

    clip.start = round2(s);
    clip.end = round2(e);
    updateTimelineUI();
    scheduleSessionSave();

    if (seekTo !== null) {
      seekVideo(seekTo);
    }
  }

  function updatePlayIcon(isPlaying) {
    els.iconPlay.classList.toggle("hidden", isPlaying);
    els.iconPause.classList.toggle("hidden", !isPlaying);
  }

  function togglePlayPause() {
    const clip = getActiveClip();
    if (!clip) return;
    if (els.videoPlayer.paused) {
      if (
        state.loopSelection &&
        (els.videoPlayer.currentTime < clip.start - 0.05 ||
          els.videoPlayer.currentTime >= clip.end - 0.08)
      ) {
        seekVideo(clip.start, true);
      }
      els.videoPlayer.play().catch(() => {});
    } else {
      els.videoPlayer.pause();
    }
  }

  // Smooth RAF loop for playhead & tight loop-selection playback
  function playbackTick() {
    const clip = getActiveClip();
    if (clip && !els.videoPlayer.paused) {
      const cur = els.videoPlayer.currentTime;
      updatePlayheadUI(cur);
      if (state.loopSelection && cur >= clip.end - 0.03) {
        els.videoPlayer.currentTime = clip.start;
      }
    }
    requestAnimationFrame(playbackTick);
  }
  requestAnimationFrame(playbackTick);

  // ── Pointer-Capture Timeline Dragging & Zoom/Pan ──────────────────────────
  let dragState = null;

  function timeFromClientX(clientX) {
    const clip = getActiveClip();
    if (!clip) return 0;
    const rect = els.timelineTrack.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const dur = getClipDuration(clip);
    return clamp(state.viewStart + ratio * getViewDuration(dur), 0, dur);
  }

  function startTimelineDrag(mode, e) {
    const clip = getActiveClip();
    if (!clip) return;
    e.preventDefault();
    e.stopPropagation();

    els.timelineTrack.setPointerCapture(e.pointerId);
    const pointerTime = timeFromClientX(e.clientX);
    dragState = {
      mode, // "left" | "right" | "move" | "scrub"
      pointerId: e.pointerId,
      originX: e.clientX,
      originTime: pointerTime,
      origStart: clip.start,
      origEnd: clip.end,
      windowLen: clip.end - clip.start,
    };

    if (mode === "scrub") {
      seekVideo(pointerTime);
    }
  }

  els.tlHandleLeft.addEventListener("pointerdown", (e) => startTimelineDrag("left", e));
  els.tlHandleRight.addEventListener("pointerdown", (e) => startTimelineDrag("right", e));
  els.tlSelection.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".tl-handle")) return;
    startTimelineDrag("move", e);
  });
  els.timelineTrack.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".timeline-selection")) return;
    startTimelineDrag("scrub", e);
  });

  els.timelineTrack.addEventListener("pointermove", (e) => {
    if (!dragState) return;
    const clip = getActiveClip();
    if (!clip) return;
    const dur = Math.max(0.2, Number(clip.meta?.duration || els.videoPlayer.duration || 1));
    const t = timeFromClientX(e.clientX);

    if (dragState.mode === "scrub") {
      seekVideo(t);
    } else if (dragState.mode === "left") {
      const newStart = clamp(t, 0, Math.max(0, clip.end - 0.25));
      setClipRange(newStart, clip.end, newStart);
    } else if (dragState.mode === "right") {
      const newEnd = clamp(t, Math.min(dur, clip.start + 0.25), dur);
      setClipRange(clip.start, newEnd, newEnd);
    } else if (dragState.mode === "move") {
      const delta = t - dragState.originTime;
      const len = dragState.windowLen;
      const newStart = clamp(dragState.origStart + delta, 0, Math.max(0, dur - len));
      const newEnd = Math.min(dur, newStart + len);
      setClipRange(newStart, newEnd, newStart);
    }
  });

  function endTimelineDrag() {
    if (!dragState) return;
    try {
      els.timelineTrack.releasePointerCapture(dragState.pointerId);
    } catch (_) {}
    dragState = null;
  }

  els.timelineTrack.addEventListener("pointerup", endTimelineDrag);
  els.timelineTrack.addEventListener("pointercancel", endTimelineDrag);

  // Mouse-wheel zoom (anchored at cursor) & Shift+wheel horizontal pan
  els.timelineTrack.addEventListener(
    "wheel",
    (e) => {
      const clip = getActiveClip();
      if (!clip) return;
      e.preventDefault();
      const dur = getClipDuration(clip);

      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (state.zoom <= 1.01) return;
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const panStep = getViewDuration(dur) * 0.14 * Math.sign(delta);
        state.viewStart = clampViewStart(state.viewStart + panStep, dur);
        updateTimelineUI();
        return;
      }

      const rect = els.timelineTrack.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const anchorSec = state.viewStart + ratio * getViewDuration(dur);
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      setTimelineZoom(state.zoom * factor, anchorSec, ratio);
    },
    { passive: false }
  );

  // Zoom pan scrollbar dragging
  let panDrag = null;
  els.timelineZoomBar.addEventListener("pointerdown", (e) => {
    const clip = getActiveClip();
    if (!clip || state.zoom <= 1.01) return;
    e.preventDefault();
    els.timelineZoomBar.setPointerCapture(e.pointerId);
    const rect = els.timelineZoomBar.getBoundingClientRect();
    const dur = getClipDuration(clip);
    const viewDur = getViewDuration(dur);

    if (e.target === els.timelineZoomThumb) {
      panDrag = {
        pointerId: e.pointerId,
        originX: e.clientX,
        origViewStart: state.viewStart,
        trackW: Math.max(1, rect.width),
        dur,
      };
    } else {
      const clickRatio = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      state.viewStart = clampViewStart(clickRatio * dur - viewDur * 0.5, dur);
      updateTimelineUI();
      panDrag = {
        pointerId: e.pointerId,
        originX: e.clientX,
        origViewStart: state.viewStart,
        trackW: Math.max(1, rect.width),
        dur,
      };
    }
  });

  els.timelineZoomBar.addEventListener("pointermove", (e) => {
    if (!panDrag) return;
    const dxRatio = (e.clientX - panDrag.originX) / panDrag.trackW;
    state.viewStart = clampViewStart(panDrag.origViewStart + dxRatio * panDrag.dur, panDrag.dur);
    updateTimelineUI();
  });

  const endPanDrag = () => {
    if (!panDrag) return;
    try {
      els.timelineZoomBar.releasePointerCapture(panDrag.pointerId);
    } catch (_) {}
    panDrag = null;
  };
  els.timelineZoomBar.addEventListener("pointerup", endPanDrag);
  els.timelineZoomBar.addEventListener("pointercancel", endPanDrag);

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => drawWaveform());
    ro.observe(els.timelineTrack);
  }

  // ── Numeric Timeline Inputs & Quick Per-Clip Chips ────────────────────────
  els.inputStart.addEventListener("change", () => {
    const clip = getActiveClip();
    if (!clip) return;
    const val = parseFloat(els.inputStart.value);
    if (Number.isFinite(val)) {
      setClipRange(val, Math.max(clip.end, val + 0.25), val);
    }
  });

  els.inputEnd.addEventListener("change", () => {
    const clip = getActiveClip();
    if (!clip) return;
    const val = parseFloat(els.inputEnd.value);
    if (Number.isFinite(val)) {
      setClipRange(Math.min(clip.start, val - 0.25), val, val);
    }
  });

  els.inputDuration.addEventListener("change", () => {
    const clip = getActiveClip();
    if (!clip) return;
    const newLen = parseFloat(els.inputDuration.value);
    if (!Number.isFinite(newLen) || newLen <= 0.1) return;
    const dur = Number(clip.meta?.duration || 1);
    const len = Math.min(newLen, dur);
    if (clip.end >= dur - 0.2) {
      setClipRange(Math.max(0, dur - len), dur, Math.max(0, dur - len));
    } else {
      const end = Math.min(dur, clip.start + len);
      const start = Math.max(0, end - len);
      setClipRange(start, end, start);
    }
  });

  document.querySelectorAll("[data-clip-dur]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const clip = getActiveClip();
      if (!clip) return;
      const targetLen = parseFloat(btn.dataset.clipDur);
      const dur = Number(clip.meta?.duration || 1);
      const len = Math.min(targetLen, dur);

      if (clip.end >= dur - 0.25) {
        setClipRange(Math.max(0, dur - len), dur, Math.max(0, dur - len));
      } else {
        const center = (clip.start + clip.end) / 2;
        const start = clamp(center - len / 2, 0, Math.max(0, dur - len));
        setClipRange(start, start + len, start);
      }
    });
  });

  document.querySelectorAll("[data-clip-anchor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const clip = getActiveClip();
      if (!clip) return;
      const dur = Number(clip.meta?.duration || 1);
      const len = Math.min(Math.max(0.25, clip.end - clip.start), dur);
      const anchor = btn.dataset.clipAnchor;

      if (anchor === "start") {
        setClipRange(0, len, 0);
      } else if (anchor === "middle") {
        const s = Math.max(0, (dur - len) / 2);
        setClipRange(s, s + len, s);
      } else if (anchor === "end") {
        const s = Math.max(0, dur - len);
        setClipRange(s, dur, s);
      } else if (anchor === "playhead") {
        const cur = els.videoPlayer.currentTime || 0;
        const s = clamp(cur - len / 2, 0, Math.max(0, dur - len));
        setClipRange(s, s + len, s);
      }
    });
  });

  // ── Best Moment Auto-Detection (Audio + Motion) ───────────────────────────
  function formatMomentReason(reason) {
    if (reason === "audio_motion") return t("moment_reason_both");
    if (reason === "audio") return t("moment_reason_audio");
    return t("moment_reason_motion");
  }

  function frameAroundPeak(dur, peakTime, len) {
    const safeLen = Math.min(Math.max(0.25, len), Math.max(0.25, dur));
    const s = clamp(peakTime - safeLen * 0.4, 0, Math.max(0, dur - safeLen));
    const e = Math.min(dur, s + safeLen);
    return { start: round2(s), end: round2(e) };
  }

  async function applyBestMomentToClips(clips, targetDur, showSummaryToast = true) {
    if (!clips || !clips.length || state.isDetectingBest) return;
    state.isDetectingBest = true;
    els.btnApplyBatch.disabled = true;
    const labelSpan = els.btnApplyBatch.querySelector("[data-i18n='batch_apply_prefix']");
    const total = clips.length;
    let done = 0;
    let updated = 0;

    const refreshLabel = () => {
      if (labelSpan) {
        labelSpan.textContent = `${t("batch_detecting_best")} ${done}/${total}`;
      }
    };
    refreshLabel();

    try {
      const queue = [...clips];
      const concurrency = Math.min(3, queue.length);

      const worker = async () => {
        while (queue.length > 0) {
          const clip = queue.shift();
          if (!clip) break;
          // Verify clip still exists in session
          if (!state.clips.some((c) => c.id === clip.id)) {
            done++;
            refreshLabel();
            continue;
          }

          try {
            let moments = clip.bestMoments;
            if (!moments || !moments.length) {
              const res = await apiJson(`/api/media/${clip.id}/best-moments`);
              moments = Array.isArray(res.moments) ? res.moments : [];
              clip.bestMoments = moments;
            }

            if (moments.length > 0) {
              clip.bestMomentIdx = 0;
              const dur = Number(clip.meta?.duration || 0);
              const { start, end } = frameAroundPeak(dur, moments[0].time, targetDur);
              clip.start = start;
              clip.end = end;
              clip.reviewed = false;
              updateQueueCardTrim(clip);
              updated++;

              if (state.activeId === clip.id) {
                updateTimelineUI();
                seekVideo(clip.start);
              }
            }
          } catch (_) {
            // Skip individual clip errors cleanly so remaining clips still succeed
          } finally {
            done++;
            refreshLabel();
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      updateReviewedUI();
      scheduleSessionSave();

      if (showSummaryToast && updated > 0) {
        showToast(
          t("toast_best_batch_done", { n: updated, d: targetDur }),
          "success",
          3400
        );
      }
    } catch (err) {
      showToast(err.message, "error", 4500);
    } finally {
      state.isDetectingBest = false;
      if (labelSpan) labelSpan.textContent = t("batch_apply_prefix");
      updateGlobalCounters();
    }
  }

  async function jumpActiveToBestMoment() {
    const clip = getActiveClip();
    if (!clip) return;
    els.btnClipBestMoment.disabled = true;
    try {
      if (!clip.bestMoments || !clip.bestMoments.length) {
        const res = await apiJson(`/api/media/${clip.id}/best-moments`);
        clip.bestMoments = Array.isArray(res.moments) ? res.moments : [];
        clip.bestMomentIdx = -1;
      }
      if (!clip.bestMoments.length) return;

      clip.bestMomentIdx = (clip.bestMomentIdx + 1) % clip.bestMoments.length;
      const moment = clip.bestMoments[clip.bestMomentIdx];
      const dur = getClipDuration(clip);
      const len = Math.max(0.25, clip.end - clip.start);
      const { start, end } = frameAroundPeak(dur, moment.time, len);
      setClipRange(start, end, start);

      showToast(
        t("toast_best_single", {
          idx: clip.bestMomentIdx + 1,
          total: clip.bestMoments.length,
          t: Number(moment.time).toFixed(1),
          reason: formatMomentReason(moment.reason),
        }),
        "success",
        2400
      );
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      els.btnClipBestMoment.disabled = false;
    }
  }

  els.btnClipBestMoment.addEventListener("click", jumpActiveToBestMoment);

  // ── Batch Preset Controls ─────────────────────────────────────────────────
  document.querySelectorAll("[data-batch-dur]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.batchDuration.value = btn.dataset.batchDur;
      document.querySelectorAll("[data-batch-dur]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      scheduleSessionSave();
    });
  });

  els.batchDuration.addEventListener("input", () => {
    const val = els.batchDuration.value;
    document.querySelectorAll("[data-batch-dur]").forEach((b) => {
      b.classList.toggle("active", b.dataset.batchDur === val);
    });
    scheduleSessionSave();
  });

  els.batchAnchor.addEventListener("change", () => {
    const isCustom = els.batchAnchor.value === "custom";
    els.batchCustomRange.classList.toggle("hidden", !isCustom);
    scheduleSessionSave();
  });

  els.batchCustomStart.addEventListener("change", scheduleSessionSave);
  els.batchCustomEnd.addEventListener("change", scheduleSessionSave);

  els.btnApplyBatch.addEventListener("click", async () => {
    const selected = getSelectedClips();
    if (!selected.length) return;

    const anchor = els.batchAnchor.value;
    const targetDur = parseFloat(els.batchDuration.value) || 5;
    const customStart = parseFloat(els.batchCustomStart.value) || 0;
    const customEnd = parseFloat(els.batchCustomEnd.value) || 5;

    if (anchor === "best") {
      await applyBestMomentToClips(selected, targetDur, true);
      return;
    }

    for (const clip of selected) {
      const dur = Number(clip.meta?.duration || 0);
      const { start, end } = computeRangeForRule(dur, anchor, targetDur, customStart, customEnd);
      clip.start = start;
      clip.end = end;
      clip.reviewed = false;
      updateQueueCardTrim(clip);
    }

    const active = getActiveClip();
    if (active) {
      updateTimelineUI();
      seekVideo(active.start);
    }
    updateReviewedUI();
    scheduleSessionSave();

    const rangeMap = {
      end: t("toast_range_end", { d: targetDur }),
      start: t("toast_range_start", { d: targetDur }),
      middle: t("toast_range_middle", { d: targetDur }),
      custom: t("toast_range_custom", { s: customStart, e: customEnd }),
    };
    showToast(
      t("toast_batch_applied", { range: rangeMap[anchor], n: selected.length }),
      "success"
    );
  });

  // ── Quality Mode & Output Settings ────────────────────────────────────────
  function syncModeCards() {
    const mode = getExportMode();
    const isLossless = mode === "lossless";
    const isSmart = mode === "smart";
    const isPrecise = mode === "precise";

    els.modeCardLossless.classList.toggle("active", isLossless);
    els.modeCardSmart.classList.toggle("active", isSmart);
    els.modeCardSmart.classList.toggle("smart-active", isSmart);
    els.modeCardPrecise.classList.toggle("active", isPrecise);
    els.modeCardPrecise.classList.toggle("precise-active", isPrecise);
    els.snapKeyframeBox.classList.toggle("hidden", !isLossless);
    updateGlobalCounters();
  }

  document.querySelectorAll('input[name="exportMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      syncModeCards();
      scheduleSessionSave();
    });
  });

  els.chkSnapKeyframe.addEventListener("change", scheduleSessionSave);

  els.chkSourceSubfolder.addEventListener("change", () => {
    els.customOutputDirWrap.classList.toggle("hidden", els.chkSourceSubfolder.checked);
    scheduleSessionSave();
  });

  els.btnPickOutputDir.addEventListener("click", async () => {
    try {
      const data = await apiJson(`/api/dialogs/pick-output-dir?lang=${getLang()}`, {
        method: "POST",
      });
      if (!data.cancelled && data.path) {
        state.outputDir = data.path;
        renderOutputDirDisplay();
        scheduleSessionSave();
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  els.inputSuffix.addEventListener("input", () => {
    updateFilenamePreview();
    scheduleSessionSave();
  });
  els.chkOverwrite.addEventListener("change", scheduleSessionSave);

  // ── Export Execution & Live Progress Polling ──────────────────────────────
  function getExportSubtitleForMode(mode) {
    if (mode === "lossless") return t("modal_export_sub_lossless");
    if (mode === "smart") return t("modal_export_sub_smart");
    return t("modal_export_sub_precise");
  }

  function getExportModeAdverb(mode) {
    if (mode === "lossless") return t("export_mode_lossless_adv");
    if (mode === "smart") return t("export_mode_smart_adv");
    return t("export_mode_precise_adv");
  }

  async function startBatchExport() {
    const selected = getSelectedClips();
    if (!selected.length) {
      showToast(t("toast_select_one"), "error");
      return;
    }

    const useSubfolder = els.chkSourceSubfolder.checked;
    if (!useSubfolder && !state.outputDir) {
      showToast(t("toast_pick_dir"), "error");
      return;
    }

    const mode = getExportMode();
    const payload = {
      items: selected.map((c) => ({
        clip_id: c.id,
        start: c.start,
        end: c.end,
      })),
      mode,
      snap_keyframe: els.chkSnapKeyframe.checked,
      output_dir: useSubfolder ? null : state.outputDir,
      use_source_subfolder: useSubfolder,
      subfolder_name: t("output_subfolder_name"),
      suffix: els.inputSuffix.value ?? "_cut",
      overwrite: els.chkOverwrite.checked,
    };

    try {
      els.videoPlayer.pause();
      const { job_id } = await apiJson("/api/export/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      state.lastExportJobId = job_id;
      openExportModal(mode, selected.length);
      pollExportStatus(job_id);
    } catch (err) {
      showToast(err.message, "error", 5000);
    }
  }

  function openExportModal(mode, total) {
    state.lastExportJob = null;
    els.exportModal.classList.remove("hidden");
    els.exportModalTitle.textContent = t("modal_export_running");
    els.exportModalSubtitle.textContent = getExportSubtitleForMode(mode);
    els.exportProgressBar.style.width = "0%";
    els.exportProgressText.textContent = t("export_progress_videos", { done: 0, total });
    els.exportProgressPct.textContent = "0%";
    els.exportSummaryBanner.classList.add("hidden");
    els.exportSummaryBanner.classList.remove("has-errors");
    els.recycleConfirmBar.classList.add("hidden");
    els.recycleDoneBanner.classList.add("hidden");
    els.btnTrashOriginals.classList.add("hidden");
    els.btnOpenOutputFolder.classList.add("hidden");
    els.exportResultsList.innerHTML = "";
    state.lastOutputDir = "";
  }

  function pollExportStatus(jobId) {
    if (state.exportPollTimer) clearInterval(state.exportPollTimer);

    const tick = async () => {
      try {
        const job = await apiJson(`/api/export/status/${jobId}`);
        renderExportJob(job);
        if (job.status === "completed") {
          clearInterval(state.exportPollTimer);
          state.exportPollTimer = null;
        }
      } catch (err) {
        clearInterval(state.exportPollTimer);
        state.exportPollTimer = null;
        showToast(t("toast_lost_status", { err: err.message }), "error");
      }
    };

    tick();
    state.exportPollTimer = setInterval(tick, 220);
  }

  function renderExportJob(job) {
    state.lastExportJob = job;
    const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
    els.exportProgressBar.style.width = `${pct}%`;
    els.exportProgressText.textContent = t("export_progress_videos", {
      done: job.done,
      total: job.total,
    });
    els.exportProgressPct.textContent = `${pct}%`;
    els.exportModalSubtitle.textContent = getExportSubtitleForMode(job.mode);

    const items = Object.values(job.items || {});
    els.exportResultsList.innerHTML = items
      .map((it) => {
        let statusHtml = "";
        if (it.status === "done" && it.result) {
          const r = it.result;
          const smartTag =
            r.mode === "smart" && Number.isFinite(r.smart_copied_pct)
              ? ` • ${r.smart_copied_pct}% copy`
              : "";
          statusHtml = `<span class="export-item-status done">✓ ${r.actual_duration.toFixed(1)}s${smartTag} • ${formatBytes(r.output_size)} (${r.elapsed_ms} ms)</span>`;
        } else if (it.status === "processing") {
          statusHtml = `<span class="export-item-status processing">${escapeHtml(t("export_status_processing"))}</span>`;
        } else if (it.status === "error") {
          statusHtml = `<span class="export-item-status error" title="${escapeHtml(it.error)}">${escapeHtml(t("export_status_error"))}</span>`;
        } else {
          statusHtml = `<span class="export-item-status queued">${escapeHtml(t("export_status_queued"))}</span>`;
        }

        return `
          <div class="export-item-row">
            <span class="export-item-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
            ${statusHtml}
          </div>
        `;
      })
      .join("");

    if (job.status === "completed") {
      const sec = (job.elapsed_ms / 1000).toFixed(2);
      const saved = formatBytes(job.saved_bytes);
      els.exportModalTitle.textContent =
        job.failed === 0 ? t("modal_export_done") : t("modal_export_warn");

      els.exportSummaryBanner.classList.remove("hidden");
      if (job.failed > 0) {
        els.exportSummaryBanner.classList.add("has-errors");
        els.exportSummaryBanner.textContent = t("export_summary_err", {
          ok: job.succeeded,
          total: job.total,
          sec,
          failed: job.failed,
          saved,
        });
      } else {
        els.exportSummaryBanner.classList.remove("has-errors");
        els.exportSummaryBanner.textContent = t("export_summary_ok", {
          ok: job.succeeded,
          total: job.total,
          mode: getExportModeAdverb(job.mode),
          sec,
          saved,
          before: formatBytes(job.total_input_bytes),
          after: formatBytes(job.total_output_bytes),
        });
      }

      if (job.output_dirs && job.output_dirs.length > 0) {
        state.lastOutputDir = job.output_dirs[0];
        els.btnOpenOutputFolder.classList.remove("hidden");
      }

      // Show safe Recycle Bin button when original disk files were successfully exported
      if (job.recycled) {
        els.btnTrashOriginals.classList.add("hidden");
        els.recycleConfirmBar.classList.add("hidden");
        els.recycleDoneBanner.classList.remove("hidden");
        els.recycleDoneBanner.textContent = t("recycle_done_banner", {
          n: job.recycled_count,
          size: formatBytes(job.recycled_bytes),
        });
      } else if (job.recyclable_count > 0) {
        els.btnTrashOriginals.classList.remove("hidden");
        els.btnTrashOriginalsText.textContent = t("btn_trash_originals", {
          size: formatBytes(job.recyclable_bytes),
        });
      } else {
        els.btnTrashOriginals.classList.add("hidden");
      }
    } else {
      els.exportModalTitle.textContent = t("modal_export_running");
    }
  }

  // ── Language Switcher Hook ────────────────────────────────────────────────
  els.langSwitch.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  onLangChange(() => {
    renderEngineBadge();
    renderOutputDirDisplay();
    renderQueue();
    updateGlobalCounters();
    const active = getActiveClip();
    if (active) {
      renderActiveClipMetaTags(active);
      renderKeyframeTicks(active.keyframes || []);
    }
    if (state.lastExportJob && !els.exportModal.classList.contains("hidden")) {
      renderExportJob(state.lastExportJob);
    }
  });

  // ── Wire Up Events ────────────────────────────────────────────────────────
  els.btnPickFiles.addEventListener("click", triggerPickFiles);
  els.btnHeroPickFiles.addEventListener("click", triggerPickFiles);
  els.btnPickFolder.addEventListener("click", triggerPickFolder);
  els.btnHeroPickFolder.addEventListener("click", triggerPickFolder);

  els.btnClearQueue.addEventListener("click", clearAllClips);
  els.btnToggleSelectAll.addEventListener("click", () => {
    if (!state.clips.length) return;
    const allSelected = state.clips.every((c) => c.selected);
    state.clips.forEach((c) => (c.selected = !allSelected));
    renderQueue();
    updateGlobalCounters();
    scheduleSessionSave();
  });

  els.btnMainExport.addEventListener("click", startBatchExport);
  els.btnTopExport.addEventListener("click", startBatchExport);

  // Reviewed & timeline tool buttons
  els.btnMarkReviewed.addEventListener("click", () => {
    const active = getActiveClip();
    if (!active) return;
    // If already reviewed, clicking toggles off; if unreviewed, marks reviewed & advances
    markActiveReviewedAndAdvance(!!active.reviewed);
  });

  els.btnToggleWaveform.addEventListener("click", () => {
    state.showWaveform = !state.showWaveform;
    els.btnToggleWaveform.classList.toggle("active", state.showWaveform);
    drawWaveform();
    scheduleSessionSave();
  });

  els.btnZoomIn.addEventListener("click", () => {
    const clip = getActiveClip();
    if (!clip) return;
    setTimelineZoom(state.zoom * 1.5, els.videoPlayer.currentTime || clip.start, 0.5);
  });
  els.btnZoomOut.addEventListener("click", () => {
    const clip = getActiveClip();
    if (!clip) return;
    setTimelineZoom(state.zoom / 1.5, els.videoPlayer.currentTime || clip.start, 0.5);
  });
  els.btnZoomReset.addEventListener("click", () => {
    setTimelineZoom(1);
  });

  // Player events
  els.videoPlayer.addEventListener("click", togglePlayPause);
  els.videoPlayer.addEventListener("play", () => updatePlayIcon(true));
  els.videoPlayer.addEventListener("pause", () => updatePlayIcon(false));
  els.videoPlayer.addEventListener("error", () => {
    if (state.activeId) {
      els.playerCodecNotice.classList.remove("hidden");
    }
  });

  els.btnPlayPause.addEventListener("click", togglePlayPause);
  els.btnKfPrev.addEventListener("click", () => jumpKeyframe(-1));
  els.btnKfNext.addEventListener("click", () => jumpKeyframe(1));
  els.btnFrameBack.addEventListener("click", () => stepFrame(-1));
  els.btnFrameFwd.addEventListener("click", () => stepFrame(1));
  els.btnStepBack.addEventListener("click", () => {
    seekVideo((els.videoPlayer.currentTime || 0) - 0.5, true);
  });
  els.btnStepFwd.addEventListener("click", () => {
    seekVideo((els.videoPlayer.currentTime || 0) + 0.5, true);
  });

  els.btnLoopToggle.addEventListener("click", () => {
    state.loopSelection = !state.loopSelection;
    els.btnLoopToggle.classList.toggle("active", state.loopSelection);
    els.playerLoopBadge.classList.toggle("hidden", !state.loopSelection);
  });

  els.btnSetIn.addEventListener("click", () => {
    const clip = getActiveClip();
    if (!clip) return;
    const time = els.videoPlayer.currentTime || 0;
    const newEnd =
      time >= clip.end - 0.2 ? Math.min(clip.meta.duration || time + 5, time + 5) : clip.end;
    setClipRange(time, newEnd);
    showToast(t("toast_set_in", { t: time.toFixed(2) }), "info", 1600);
  });

  els.btnSetOut.addEventListener("click", () => {
    const clip = getActiveClip();
    if (!clip) return;
    const time = els.videoPlayer.currentTime || 0;
    const newStart = time <= clip.start + 0.2 ? Math.max(0, time - 5) : clip.start;
    setClipRange(newStart, time);
    showToast(t("toast_set_out", { t: time.toFixed(2) }), "info", 1600);
  });

  els.playbackSpeed.addEventListener("change", () => {
    els.videoPlayer.playbackRate = parseFloat(els.playbackSpeed.value) || 1;
  });

  els.btnMute.addEventListener("click", () => {
    els.videoPlayer.muted = !els.videoPlayer.muted;
    els.iconVolOn.classList.toggle("hidden", els.videoPlayer.muted);
    els.iconVolOff.classList.toggle("hidden", !els.videoPlayer.muted);
  });

  function navigateClip(delta) {
    if (!state.clips.length || !state.activeId) return;
    const idx = state.clips.findIndex((c) => c.id === state.activeId);
    const target = clamp(idx + delta, 0, state.clips.length - 1);
    if (target !== idx) {
      selectClip(state.clips[target].id);
      const card = els.queueList.querySelector(`.clip-card[data-id="${state.clips[target].id}"]`);
      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  els.btnPrevClip.addEventListener("click", () => navigateClip(-1));
  els.btnNextClip.addEventListener("click", () => navigateClip(1));

  // Modals & Recycle Bin confirmation flow
  const closeExportModal = () => {
    els.exportModal.classList.add("hidden");
    els.recycleConfirmBar.classList.add("hidden");
  };
  els.btnCloseExportModal.addEventListener("click", closeExportModal);
  els.btnExportModalDone.addEventListener("click", closeExportModal);

  els.btnTrashOriginals.addEventListener("click", () => {
    const job = state.lastExportJob;
    if (!job || !job.recyclable_count) return;
    els.recycleConfirmText.textContent = t("recycle_confirm_prompt", {
      n: job.recyclable_count,
      size: formatBytes(job.recyclable_bytes),
    });
    els.recycleConfirmBar.classList.remove("hidden");
  });

  els.btnCancelRecycle.addEventListener("click", () => {
    els.recycleConfirmBar.classList.add("hidden");
  });

  els.btnConfirmRecycle.addEventListener("click", async () => {
    const jobId = state.lastExportJobId;
    if (!jobId) return;
    els.btnConfirmRecycle.disabled = true;

    // Release active video stream handle so Windows does not lock the currently loaded original file
    els.videoPlayer.pause();
    els.videoPlayer.removeAttribute("src");
    els.videoPlayer.load();

    try {
      const res = await apiJson(`/api/export/recycle-originals/${jobId}`, {
        method: "POST",
      });

      const removedSet = new Set(res.removed_clip_ids || []);
      if (removedSet.size > 0) {
        state.clips = state.clips.filter((c) => !removedSet.has(c.id));
        if (state.clips.length > 0) {
          const stillActive = state.clips.some((c) => c.id === state.activeId);
          selectClip(stillActive ? state.activeId : state.clips[0].id);
        } else {
          state.activeId = null;
          els.editorStage.classList.add("hidden");
          els.emptyStage.classList.remove("hidden");
        }
        renderQueue();
        updateGlobalCounters();
        updateFilenamePreview();
        scheduleSessionSave();
      } else if (state.activeId) {
        // Reload player if active clip wasn't removed
        selectClip(state.activeId);
      }

      if (state.lastExportJob) {
        state.lastExportJob.recycled = res.moved_count > 0;
        state.lastExportJob.recycled_count = res.moved_count;
        state.lastExportJob.recycled_bytes = res.freed_bytes;
      }

      els.recycleConfirmBar.classList.add("hidden");
      els.btnTrashOriginals.classList.add("hidden");
      els.recycleDoneBanner.classList.remove("hidden");
      els.recycleDoneBanner.textContent = t("recycle_done_banner", {
        n: res.moved_count,
        size: formatBytes(res.freed_bytes),
      });

      showToast(
        t("toast_recycled_ok", { n: res.moved_count, size: formatBytes(res.freed_bytes) }),
        "success",
        4000
      );
      if (res.failed_count > 0) {
        showToast(t("toast_recycled_partial", { n: res.failed_count }), "error", 4500);
      }
    } catch (err) {
      if (state.activeId) selectClip(state.activeId);
      showToast(err.message, "error", 4500);
    } finally {
      els.btnConfirmRecycle.disabled = false;
    }
  });

  els.btnOpenOutputFolder.addEventListener("click", async () => {
    if (!state.lastOutputDir) return;
    try {
      await apiJson("/api/system/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: state.lastOutputDir }),
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  els.btnShortcuts.addEventListener("click", () => els.shortcutsModal.classList.remove("hidden"));
  els.btnCloseShortcuts.addEventListener("click", () => els.shortcutsModal.classList.add("hidden"));
  els.shortcutsModal.addEventListener("click", (e) => {
    if (e.target === els.shortcutsModal) els.shortcutsModal.classList.add("hidden");
  });

  // Global Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!els.exportModal.classList.contains("hidden")) return;

    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      els.btnSetIn.click();
    } else if (e.key === "o" || e.key === "O") {
      e.preventDefault();
      els.btnSetOut.click();
    } else if (e.key === "l" || e.key === "L") {
      e.preventDefault();
      els.btnLoopToggle.click();
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      els.btnMute.click();
    } else if (e.key === "," || e.code === "Comma") {
      e.preventDefault();
      stepFrame(-1);
    } else if (e.key === "." || e.code === "Period") {
      e.preventDefault();
      stepFrame(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        jumpKeyframe(-1);
      } else {
        const step = e.shiftKey ? 0.1 : 0.5;
        seekVideo((els.videoPlayer.currentTime || 0) - step, true);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        jumpKeyframe(1);
      } else {
        const step = e.shiftKey ? 0.1 : 0.5;
        seekVideo((els.videoPlayer.currentTime || 0) + step, true);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateClip(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateClip(1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      markActiveReviewedAndAdvance(e.shiftKey);
    } else if (e.key === "Escape") {
      els.shortcutsModal.classList.add("hidden");
    }
  });

  // Global Drag & Drop
  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    els.dragOverlay.classList.remove("hidden");
  });
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  window.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) els.dragOverlay.classList.add("hidden");
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    els.dragOverlay.classList.add("hidden");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDroppedFiles(e.dataTransfer.files);
    }
  });

  // Boot
  applyStaticTranslations();
  renderEngineBadge();
  renderOutputDirDisplay();
  syncModeCards();
  updateGlobalCounters();
  updateFilenamePreview();
  initHealthCheck();
})();
