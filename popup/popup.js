// popup/popup.js — Focusora popup controller
import { levelForXp, xpForNextLevel } from "../lib/storage.js";
import { SOUNDSCAPES } from "../lib/constants.js";
import { playSoundscape, stopSoundscape, setVolume, getCurrentSoundscape } from "./sounds.js";

const RING_CIRCUMFERENCE = 2 * Math.PI * 86; // r=86 in the SVG

let state = null;
let selectedMinutes = 25;
let tickInterval = null;

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Communication with background
// ---------------------------------------------------------------------------

function send(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(res);
    });
  });
}

async function refresh() {
  const res = await send("GET_STATE");
  if (res?.ok) {
    state = res.state;
    render();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Top-level render dispatcher
// ---------------------------------------------------------------------------

function render() {
  if (!state) return;
  renderHeader();
  renderCompleteOverlay();
  renderTimer();
  renderTasks();
  renderFooter();
}

// ---------------------------------------------------------------------------
// Header — level chip + XP bar
// ---------------------------------------------------------------------------

function renderHeader() {
  const { xp, level } = state.gamification;
  el("level-num").textContent = `Lv ${level}`;
  const progress = xpForNextLevel(xp);
  el("xp-bar-fill").style.width = progress
    ? `${Math.round((progress.xpIntoLevel / progress.xpNeededForLevel) * 100)}%`
    : "100%";
}

// ---------------------------------------------------------------------------
// Session complete overlay
// ---------------------------------------------------------------------------

function renderCompleteOverlay() {
  const overlay = el("complete-overlay");
  if (state.timer.status === "complete") {
    overlay.hidden = false;
    el("complete-xp").textContent = `+${state.timer.lastSessionXp ?? 25} XP`;
    el("complete-coins").textContent = `+${state.timer.lastSessionCoins ?? 5} 🪙`;
    el("complete-sub").textContent = `You focused for ${state.timer.lastSessionMinutes ?? 25} minutes.`;

    // Check if levelled up
    const levelEl = el("complete-level");
    // We can't easily know here, but we show level if it's > 1 as encouragement
    levelEl.hidden = true;

    // Spawn confetti
    spawnConfetti();
  } else {
    overlay.hidden = true;
  }
}

function spawnConfetti() {
  const container = el("complete-confetti");
  container.innerHTML = "";
  const colors = ["#2B6E64", "#E3A23C", "#D9714E", "#5ABFB0", "#9B6DD5", "#4A90D9"];

  for (let i = 0; i < 28; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = "0";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    container.appendChild(piece);
  }
}

// ---------------------------------------------------------------------------
// Timer section
// ---------------------------------------------------------------------------

function renderTimer() {
  const { timer, settings } = state;
  const ringWrap = el("ring-wrap");
  ringWrap.classList.remove("mode-break", "mode-paused");

  const statusLabels = {
    idle:       "Ready to focus",
    focus:      "Focusing",
    shortBreak: "Short break",
    longBreak:  "Long break",
    paused:     "Paused",
    complete:   "Complete!"
  };
  el("status-label").textContent = statusLabels[timer.status] || "Ready to focus";

  // Session counter
  const counter = el("session-counter");
  if (timer.status !== "idle" && timer.status !== "complete") {
    const done = timer.sessionsCompletedToday || 0;
    const until = settings.sessionsUntilLongBreak || 4;
    const posInCycle = (done % until) + (timer.status === "focus" ? 1 : 0);
    counter.hidden = false;
    el("session-counter-text").textContent = `Session ${posInCycle} of ${until} · ${done} today`;
  } else {
    counter.hidden = true;
  }

  let totalMs, remainingMs;

  if (timer.status === "idle" || timer.status === "complete") {
    totalMs = selectedMinutes * 60 * 1000;
    remainingMs = totalMs;
    el("ring-progress").style.strokeDashoffset = "0";
  } else if (timer.status === "paused") {
    ringWrap.classList.add("mode-paused");
    remainingMs = timer.remainingMsAtPause || 0;
    totalMs = durationForStatus(timer.previousStatus || "focus", settings);
    setRing(remainingMs, totalMs);
  } else {
    if (timer.status !== "focus") ringWrap.classList.add("mode-break");
    remainingMs = Math.max(0, (timer.endsAt || Date.now()) - Date.now());
    totalMs = durationForStatus(timer.status, settings);
    setRing(remainingMs, totalMs);
  }

  el("time-display").textContent = formatTime(remainingMs);

  renderDurationChips(timer.status);
  renderControls(timer.status);
  renderDistractionNote(timer);
}

function durationForStatus(status, settings) {
  if (status === "shortBreak") return settings.shortBreakMinutes * 60 * 1000;
  if (status === "longBreak") return settings.longBreakMinutes * 60 * 1000;
  return settings.focusMinutes * 60 * 1000;
}

function setRing(remainingMs, totalMs) {
  const fractionElapsed = totalMs > 0
    ? 1 - Math.max(0, Math.min(1, remainingMs / totalMs))
    : 0;
  el("ring-progress").style.strokeDashoffset = String(RING_CIRCUMFERENCE * fractionElapsed);
}

function renderDurationChips(status) {
  const container = el("duration-chips");
  container.style.display = (status === "idle" || status === "complete") ? "flex" : "none";
  [...container.querySelectorAll(".chip[data-min]")].forEach((chip) => {
    const isSelected = Number(chip.dataset.min) === selectedMinutes;
    chip.classList.toggle("selected", isSelected);
    chip.setAttribute("aria-pressed", String(isSelected));
  });
}

function renderControls(status) {
  const controls = el("controls");
  controls.innerHTML = "";

  const make = (label, cls, id, onClick) => {
    const b = document.createElement("button");
    b.className = `btn ${cls}`;
    b.textContent = label;
    if (id) b.id = id;
    b.addEventListener("click", onClick);
    return b;
  };

  if (status === "idle" || status === "complete") {
    controls.appendChild(
      make("Start focus session", "primary", "start-btn", async () => {
        if (state.timer.status === "complete") {
          await send("DISMISS_COMPLETE");
        }
        const res = await send("START_FOCUS", { minutes: selectedMinutes });
        if (res?.ok) { state = res.state; render(); }
      })
    );
  } else if (status === "focus" || status === "shortBreak" || status === "longBreak") {
    controls.appendChild(
      make("Pause", "secondary", "pause-btn", async () => {
        const res = await send("PAUSE_TIMER");
        if (res?.ok) { state = res.state; render(); }
      })
    );
    controls.appendChild(
      make(status === "focus" ? "Done" : "Skip break", "warn", "done-btn", async () => {
        const res = await send("COMPLETE_SESSION_NOW");
        if (res?.ok) { state = res.state; render(); }
      })
    );
  } else if (status === "paused") {
    controls.appendChild(
      make("Resume", "primary", "resume-btn", async () => {
        const res = await send("RESUME_TIMER");
        if (res?.ok) { state = res.state; render(); }
      })
    );
    controls.appendChild(
      make("Reset", "warn", "reset-btn", async () => {
        const res = await send("RESET_TIMER");
        if (res?.ok) { state = res.state; render(); }
      })
    );
  }
}

function renderDistractionNote(timer) {
  const note = el("distraction-note");
  if (timer.status === "focus" && timer.distractionAttemptsThisSession > 0) {
    note.hidden = false;
    const count = timer.distractionAttemptsThisSession;
    note.textContent = count === 1
      ? "1 gentle nudge back this session."
      : `${count} gentle nudges back this session.`;
  } else {
    note.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function renderTasks() {
  const { tasks, activeTaskId } = state;
  const openTasks = tasks.filter((t) => !t.done);
  const doneCount = tasks.length - openTasks.length;

  el("task-count").textContent = tasks.length
    ? `${openTasks.length} open · ${doneCount} done`
    : "";

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const activeBanner = el("active-task");
  if (activeTask && !activeTask.done) {
    activeBanner.hidden = false;
    el("active-task-title").textContent = activeTask.title;
  } else {
    activeBanner.hidden = true;
  }

  const list = el("task-list");
  list.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML = "No tasks yet.<br>Add one above or connect Notion in Settings.";
    list.appendChild(empty);
    return;
  }

  const sorted = [...tasks].sort((a, b) =>
    a.done === b.done ? b.createdAt - a.createdAt : a.done ? 1 : -1
  );

  for (const task of sorted) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.id === activeTaskId ? " active" : "");

    const checkbox = document.createElement("span");
    checkbox.className = "task-checkbox" + (task.done ? " done" : "");
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", String(task.done));
    checkbox.setAttribute("tabindex", "0");
    checkbox.textContent = task.done ? "✓" : "";
    checkbox.addEventListener("click", async (e) => {
      e.stopPropagation();
      const res = await send("TOGGLE_TASK", { taskId: task.id });
      if (res?.ok) { state = res.state; renderTasks(); renderHeader(); renderFooter(); }
    });

    const title = document.createElement("span");
    title.className = "task-title" + (task.done ? " done" : "");
    title.textContent = task.title;

    const del = document.createElement("button");
    del.className = "task-delete";
    del.textContent = "✕";
    del.title = "Delete task";
    del.setAttribute("aria-label", `Delete task: ${task.title}`);
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      const res = await send("DELETE_TASK", { taskId: task.id });
      if (res?.ok) { state = res.state; renderTasks(); }
    });

    li.addEventListener("click", async () => {
      if (task.done) return;
      const res = await send("SET_ACTIVE_TASK", { taskId: task.id });
      if (res?.ok) { state = res.state; renderTasks(); renderTimer(); }
    });

    li.append(checkbox, title, del);
    list.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function renderFooter() {
  el("coins-num").textContent = state.gamification.coins;
  el("streak-num").textContent = state.gamification.currentStreakDays;
}

// ---------------------------------------------------------------------------
// Soundscape bar
// ---------------------------------------------------------------------------

function initSoundscapeBar() {
  const btns = el("soundscape-btns");
  const volSlider = el("vol-slider");

  btns.addEventListener("click", async (e) => {
    const btn = e.target.closest(".sc-btn");
    if (!btn) return;
    const scId = btn.dataset.sc;

    // Update state
    const nextSettings = { ...state.settings, soundscapeId: scId };
    const res = await send("UPDATE_SETTINGS", { settings: nextSettings });
    if (res?.ok) state = res.state;

    // Play / stop
    const vol = Number(volSlider.value) / 100;
    if (scId === "off") {
      stopSoundscape();
    } else {
      playSoundscape(scId, vol);
    }

    // Update button states
    btns.querySelectorAll(".sc-btn").forEach((b) => {
      const active = b.dataset.sc === scId;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  });

  volSlider.addEventListener("input", () => {
    setVolume(Number(volSlider.value) / 100);
  });

  // Restore previous soundscape preference
  const savedSc = state?.settings?.soundscapeId || "off";
  const savedVol = state?.settings?.soundscapeVolume ?? 0.5;
  volSlider.value = String(Math.round(savedVol * 100));
  btns.querySelectorAll(".sc-btn").forEach((b) => {
    const active = b.dataset.sc === savedSc;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  if (savedSc !== "off") {
    playSoundscape(savedSc, savedVol);
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

// Duration chips
el("duration-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip[data-min]");
  if (chip) {
    selectedMinutes = Number(chip.dataset.min);
    renderTimer();
  } else if (e.target.id === "chip-custom") {
    const value = window.prompt("Custom focus length (minutes, 1–180):", String(selectedMinutes));
    const parsed = parseInt(value, 10);
    if (parsed > 0 && parsed <= 180) {
      selectedMinutes = parsed;
      renderTimer();
    }
  }
});

// Add task
el("add-task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = el("add-task-input");
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  const res = await send("ADD_TASK", { title });
  if (res?.ok) { state = res.state; renderTasks(); }
});

// Settings button
el("settings-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

// Dashboard button — opens options page (the built-in dashboard)
el("dashboard-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

// Session complete overlay — break / keep going
document.addEventListener("click", async (e) => {
  if (e.target.id === "btn-start-break") {
    await send("DISMISS_COMPLETE");
    // Determine break type based on sessions in cycle
    const sessionsToday = state.timer.sessionsCompletedToday || 0;
    const until = state.settings.sessionsUntilLongBreak || 4;
    const breakType = (sessionsToday % until === 0) ? "long" : "short";
    const res = await send("START_BREAK", { breakType });
    if (res?.ok) { state = res.state; render(); }
  }
  if (e.target.id === "btn-keep-going") {
    await send("DISMISS_COMPLETE");
    const res = await send("GET_STATE");
    if (res?.ok) { state = res.state; render(); }
  }
});

// Storage listener — real-time sync when background changes state
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.focusora_state_v1) {
    state = changes.focusora_state_v1.newValue;
    render();
  }
});

// Tick every second to keep the countdown live
function startTicking() {
  clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (state && ["focus", "shortBreak", "longBreak"].includes(state.timer.status)) {
      renderTimer();
    }
  }, 1000);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

refresh().then(() => {
  initSoundscapeBar();
  startTicking();
  // Set initial chip selection from saved settings
  if (state?.settings?.focusMinutes) {
    const saved = state.settings.focusMinutes;
    const chips = document.querySelectorAll(".chip[data-min]");
    const match = [...chips].find(c => Number(c.dataset.min) === saved);
    if (match) {
      selectedMinutes = saved;
    }
  }
});
