(() => {
  "use strict";

  const { t, getLang, setLang, onLangChange, applyStaticTranslations, formatVideoCount } =
    window.I18N;

  // ── App State ─────────────────────────────────────────────────────────────
  const state = {
    clips: [], // { id, name, path, dir, ext, meta, start, end, selected, keyframes }
    activeId: null,
    loopSelection: true,
    outputDir: "",
    defaultOutputDir: "",
    exportPollTimer: null,
    lastOutputDir: "",
    lastExportJob: null,
    engineState: "ok", // "ok" | "no_ffmpeg" | "offline"
    isLoadingDialog: false,
  };

  // ── DOM References ────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const els = {
    engineStatusBadge: $("engineStatusBadge"),
    engineStatusText: $("engineStatusText"),
    langSwitch: $("langSwitch"),
    headerClipCount: $("headerClipCount"),
    queueCountBadge: $("queueCountBadge"),
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

    btnPlayPause: $("btnPlayPause"),
    iconPlay: $("iconPlay"),
    iconPause: $("iconPause"),
    btnStepBack: $("btnStepBack"),
    btnStepFwd: $("btnStepFwd"),
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
    kfCountLabel: $("kfCountLabel"),

    timelineTrack: $("timelineTrack"),
    timelineFilmstrip: $("timelineFilmstrip"),
    tlDimLeft: $("tlDimLeft"),
    tlDimRight: $("tlDimRight"),
    tlSelection: $("tlSelection"),
    tlSelectionLabel: $("tlSelectionLabel"),
    tlHandleLeft: $("tlHandleLeft"),
    tlHandleRight: $("tlHandleRight"),
    tlKeyframes: $("tlKeyframes"),
    tlPlayhead: $("tlPlayhead"),

    batchDuration: $("batchDuration"),
    batchAnchor: $("batchAnchor"),
    batchCustomRange: $("batchCustomRange"),
    batchCustomStart: $("batchCustomStart"),
    batchCustomEnd: $("batchCustomEnd"),
    btnApplyBatch: $("btnApplyBatch"),
    applyBatchCount: $("applyBatchCount"),

    modeCardLossless: $("modeCardLossless"),
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
      // Restore clips if page was refreshed while server was still running
      const existing = await apiJson("/api/clips");
      if (existing.clips && existing.clips.length > 0) {
        ingestBackendClips(existing.clips, false);
      }
    } catch (err) {
      state.engineState = "offline";
      renderEngineBadge();
    }
  }

  function ingestBackendClips(rawClips, announce = true) {
    if (!rawClips || rawClips.length === 0) return;

    const anchor = els.batchAnchor.value;
    const targetDur = parseFloat(els.batchDuration.value) || 5;
    const customStart = parseFloat(els.batchCustomStart.value) || 0;
    const customEnd = parseFloat(els.batchCustomEnd.value) || 5;

    let addedCount = 0;
    for (const raw of rawClips) {
      if (state.clips.some((c) => c.id === raw.id)) continue;
      const dur = Number(raw.meta?.duration || 0);
      const { start, end } = computeRangeForRule(dur, anchor, targetDur, customStart, customEnd);

      state.clips.push({
        id: raw.id,
        name: raw.name,
        path: raw.path,
        dir: raw.dir,
        ext: raw.ext,
        is_uploaded: !!raw.is_uploaded,
        meta: raw.meta || {},
        start,
        end,
        selected: true,
        keyframes: null,
      });
      addedCount++;
    }

    if (addedCount > 0) {
      if (!state.activeId && state.clips.length > 0) {
        selectClip(state.clips[0].id);
      }
      renderQueue();
      updateGlobalCounters();
      updateFilenamePreview();
      if (announce) {
        showToast(
          addedCount === 1
            ? t("toast_added_one")
            : t("toast_added_many", { n: addedCount }),
          "success"
        );
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
  }

  function updateQueueCardTrim(clip) {
    const card = els.queueList.querySelector(`.clip-card[data-id="${clip.id}"]`);
    if (!card) return;
    const pill = card.querySelector(".trim-pill");
    if (!pill) return;
    const origDur = Number(clip.meta?.duration || 0);
    const cutDur = Math.max(0, clip.end - clip.start);
    const isTrimmed = origDur > 0 && Math.abs(origDur - cutDur) > 0.15;
    pill.textContent = `${formatShortSec(origDur)} → ${formatShortSec(cutDur)}`;
    pill.classList.toggle("full", !isTrimmed);
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

    els.btnApplyBatch.disabled = selected === 0;
    els.btnMainExport.disabled = selected === 0;
    els.btnTopExport.disabled = selected === 0;

    const mode = getExportMode();
    els.exportModeIndicator.textContent =
      mode === "lossless" ? t("footer_mode_lossless") : t("footer_mode_precise");
    els.exportModeIndicator.style.color = mode === "lossless" ? "#6ee7b7" : "#c7d2fe";
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

  async function selectClip(clipId) {
    const idx = state.clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return;

    state.activeId = clipId;
    const clip = state.clips[idx];

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
    const dur = clip.meta.duration;
    // Cap rendered ticks if a huge clip has hundreds of keyframes
    const step = keyframes.length > 90 ? Math.ceil(keyframes.length / 90) : 1;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < keyframes.length; i += step) {
      const pct = clamp((keyframes[i] / dur) * 100, 0, 100);
      const tick = document.createElement("div");
      tick.className = "kf-tick";
      tick.style.left = `${pct}%`;
      frag.appendChild(tick);
    }
    els.tlKeyframes.appendChild(frag);
    els.kfCountLabel.textContent = t("tl_keyframes_count", { n: keyframes.length });
  }

  // ── Timeline & Player Synchronization ─────────────────────────────────────
  function updateTimelineUI() {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = Math.max(0.1, Number(clip.meta?.duration || els.videoPlayer.duration || 1));

    const startPct = clamp((clip.start / dur) * 100, 0, 100);
    const endPct = clamp((clip.end / dur) * 100, startPct, 100);
    const widthPct = Math.max(0.5, endPct - startPct);

    els.tlDimLeft.style.width = `${startPct}%`;
    els.tlDimRight.style.width = `${Math.max(0, 100 - endPct)}%`;
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

    updatePlayheadUI(els.videoPlayer.currentTime || clip.start);
    updateQueueCardTrim(clip);
  }

  function updatePlayheadUI(currentTime) {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = Math.max(0.1, Number(clip.meta?.duration || els.videoPlayer.duration || 1));
    const pct = clamp((currentTime / dur) * 100, 0, 100);
    els.tlPlayhead.style.left = `${pct}%`;
    els.hudCurrentTime.textContent = formatTime(currentTime);
  }

  let pendingSeekTime = null;
  let seekRafId = null;

  function seekVideo(targetSec, immediate = false) {
    const clip = getActiveClip();
    if (!clip) return;
    const dur = Number(clip.meta?.duration || els.videoPlayer.duration || 0);
    const clamped = clamp(targetSec, 0, Math.max(0, dur));
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

  // ── Pointer-Capture Timeline Dragging ─────────────────────────────────────
  let dragState = null;

  function timeFromClientX(clientX) {
    const clip = getActiveClip();
    if (!clip) return 0;
    const rect = els.timelineTrack.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const dur = Math.max(0.1, Number(clip.meta?.duration || els.videoPlayer.duration || 1));
    return ratio * dur;
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

  // ── Batch Preset Controls ─────────────────────────────────────────────────
  document.querySelectorAll("[data-batch-dur]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.batchDuration.value = btn.dataset.batchDur;
      document.querySelectorAll("[data-batch-dur]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  els.batchDuration.addEventListener("input", () => {
    const val = els.batchDuration.value;
    document.querySelectorAll("[data-batch-dur]").forEach((b) => {
      b.classList.toggle("active", b.dataset.batchDur === val);
    });
  });

  els.batchAnchor.addEventListener("change", () => {
    const isCustom = els.batchAnchor.value === "custom";
    els.batchCustomRange.classList.toggle("hidden", !isCustom);
  });

  els.btnApplyBatch.addEventListener("click", () => {
    const selected = getSelectedClips();
    if (!selected.length) return;

    const anchor = els.batchAnchor.value;
    const targetDur = parseFloat(els.batchDuration.value) || 5;
    const customStart = parseFloat(els.batchCustomStart.value) || 0;
    const customEnd = parseFloat(els.batchCustomEnd.value) || 5;

    for (const clip of selected) {
      const dur = Number(clip.meta?.duration || 0);
      const { start, end } = computeRangeForRule(dur, anchor, targetDur, customStart, customEnd);
      clip.start = start;
      clip.end = end;
      updateQueueCardTrim(clip);
    }

    const active = getActiveClip();
    if (active) {
      updateTimelineUI();
      seekVideo(active.start);
    }

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
    els.modeCardLossless.classList.toggle("active", isLossless);
    els.modeCardPrecise.classList.toggle("active", !isLossless);
    els.modeCardPrecise.classList.toggle("precise-active", !isLossless);
    els.snapKeyframeBox.classList.toggle("hidden", !isLossless);
    updateGlobalCounters();
  }

  document.querySelectorAll('input[name="exportMode"]').forEach((radio) => {
    radio.addEventListener("change", syncModeCards);
  });

  els.chkSourceSubfolder.addEventListener("change", () => {
    els.customOutputDirWrap.classList.toggle("hidden", els.chkSourceSubfolder.checked);
  });

  els.btnPickOutputDir.addEventListener("click", async () => {
    try {
      const data = await apiJson(`/api/dialogs/pick-output-dir?lang=${getLang()}`, {
        method: "POST",
      });
      if (!data.cancelled && data.path) {
        state.outputDir = data.path;
        renderOutputDirDisplay();
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  els.inputSuffix.addEventListener("input", updateFilenamePreview);

  // ── Export Execution & Live Progress Polling ──────────────────────────────
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
    els.exportModalSubtitle.textContent =
      mode === "lossless" ? t("modal_export_sub_lossless") : t("modal_export_sub_precise");
    els.exportProgressBar.style.width = "0%";
    els.exportProgressText.textContent = t("export_progress_videos", { done: 0, total });
    els.exportProgressPct.textContent = "0%";
    els.exportSummaryBanner.classList.add("hidden");
    els.exportSummaryBanner.classList.remove("has-errors");
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
    els.exportModalSubtitle.textContent =
      job.mode === "lossless" ? t("modal_export_sub_lossless") : t("modal_export_sub_precise");

    const items = Object.values(job.items || {});
    els.exportResultsList.innerHTML = items
      .map((it) => {
        let statusHtml = "";
        if (it.status === "done" && it.result) {
          const r = it.result;
          statusHtml = `<span class="export-item-status done">✓ ${r.actual_duration.toFixed(1)}s • ${formatBytes(r.output_size)} (${r.elapsed_ms} ms)</span>`;
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
          mode:
            job.mode === "lossless"
              ? t("export_mode_lossless_adv")
              : t("export_mode_precise_adv"),
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
  });

  els.btnMainExport.addEventListener("click", startBatchExport);
  els.btnTopExport.addEventListener("click", startBatchExport);

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

  // Modals
  const closeExportModal = () => els.exportModal.classList.add("hidden");
  els.btnCloseExportModal.addEventListener("click", closeExportModal);
  els.btnExportModalDone.addEventListener("click", closeExportModal);

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
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : 0.5;
      seekVideo((els.videoPlayer.currentTime || 0) - step, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : 0.5;
      seekVideo((els.videoPlayer.currentTime || 0) + step, true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateClip(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateClip(1);
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
