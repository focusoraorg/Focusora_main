// options/options.js — Focusora Dashboard controller
import { xpForNextLevel, getWeeklyInsights } from "../lib/storage.js";
import { ACHIEVEMENTS } from "../lib/constants.js";
import {
  initFirebase,
  signInWithGoogle,
  signOut,
  syncFullStateToFirestore,
  fetchFullStateFromFirestore
} from "../utils/firebase.js";

let state = null;
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
// Top-level render
// ---------------------------------------------------------------------------

function render() {
  if (!state) return;
  renderToday();
  renderFocusSettings();
  renderTasksSettings();
  renderAccountSettings();
  renderAchievements();
  // History renders on demand when tab is clicked (it needs async data)
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

function renderToday() {
  const today = new Date().toISOString().slice(0, 10);
  const log = state.insights.dailyLog[today] || {
    focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0, distractionAttempts: 0
  };

  el("stat-minutes").textContent = log.focusMinutes || 0;
  el("stat-sessions").textContent = log.sessionsCompleted || 0;
  el("stat-tasks").textContent = log.tasksCompleted || 0;
  el("stat-distractions").textContent = log.distractionAttempts || 0;

  // Progress bar for daily goal
  const goal = state.settings.dailyGoalMinutes || 100;
  const pct = Math.min(100, Math.round(((log.focusMinutes || 0) / goal) * 100));
  const bar = el("stat-minutes-bar");
  if (bar) bar.style.width = `${pct}%`;

  const { xp, level, currentStreakDays, longestStreakDays, coins } = state.gamification;
  el("today-level").textContent = `Lv ${level}`;
  el("today-xp").textContent = `${xp} XP total`;

  const progress = xpForNextLevel(xp);
  el("today-xp-fill").style.width = progress
    ? `${Math.round((progress.xpIntoLevel / progress.xpNeededForLevel) * 100)}%`
    : "100%";

  el("today-streak").textContent =
    `Current streak: ${currentStreakDays} day${currentStreakDays === 1 ? "" : "s"} · Longest: ${longestStreakDays} day${longestStreakDays === 1 ? "" : "s"}`;

  if (el("today-coins")) el("today-coins").textContent = coins || 0;

  const openTasks = (state.tasks || []).filter((t) => !t.done);
  const taskBadge = el("today-task-badge");
  if (taskBadge) taskBadge.textContent = openTasks.length;

  const list = el("today-task-list");
  if (list) {
    list.innerHTML = "";
    if (openTasks.length === 0) {
      list.innerHTML = '<li class="muted small">No open tasks right now.</li>';
    } else {
      for (const t of openTasks.slice(0, 8)) {
        const li = document.createElement("li");
        li.textContent = (t.id === state.activeTaskId ? "🎯 " : "") + t.title;
        list.appendChild(li);
      }
      if (openTasks.length > 8) {
        const more = document.createElement("li");
        more.className = "muted small";
        more.textContent = `+${openTasks.length - 8} more…`;
        list.appendChild(more);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// History — 7-day chart
// ---------------------------------------------------------------------------

async function renderHistory() {
  const weekly = await getWeeklyInsights();

  renderFocusChart(weekly);
  renderWeekGrid(weekly);
  renderAlltimeGrid();
}

function renderFocusChart(weekly) {
  const canvas = el("focus-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const PAD = { top: 16, right: 16, bottom: 8, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(60, ...weekly.map((d) => d.focusMinutes));
  const barWidth = chartW / weekly.length;

  // Y-axis grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  ctx.strokeStyle = "rgba(225, 232, 228, 0.8)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#5B6B67";
  ctx.font = "10px Manrope, sans-serif";
  ctx.textAlign = "right";

  for (const frac of gridLines) {
    const y = PAD.top + chartH * (1 - frac);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(frac * maxVal)), PAD.left - 4, y + 4);
  }

  // Bars
  const teal = "#2B6E64";
  const tealSoft = "#E4EFEC";
  const today = new Date().toISOString().slice(0, 10);

  weekly.forEach((day, i) => {
    const barH = chartH * (day.focusMinutes / maxVal);
    const x = PAD.left + i * barWidth + barWidth * 0.15;
    const w = barWidth * 0.7;
    const y = PAD.top + chartH - barH;
    const isToday = day.date === today;

    // Bar fill gradient
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, isToday ? teal : "#5ABFB0");
    grad.addColorStop(1, isToday ? "#1F534B" : "#A8D8D2");

    ctx.fillStyle = day.focusMinutes === 0 ? tealSoft : grad;
    const radius = Math.min(5, w / 2, barH / 2 || 5);
    roundRect(ctx, x, y, w, Math.max(barH, 4), radius);
    ctx.fill();

    // Value label on top of bar
    if (day.focusMinutes > 0) {
      ctx.fillStyle = "#17242A";
      ctx.font = `${isToday ? "700" : "500"} 10px Manrope, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(day.focusMinutes), x + w / 2, y - 4);
    }
  });

  // Day labels
  const labelsEl = el("chart-labels");
  if (labelsEl) {
    labelsEl.innerHTML = "";
    labelsEl.style.display = "flex";
    labelsEl.style.justifyContent = "space-around";
    labelsEl.style.padding = `0 ${PAD.right}px 0 ${PAD.left}px`;
    weekly.forEach((day) => {
      const span = document.createElement("span");
      const isToday = day.date === today;
      span.textContent = day.label;
      span.style.cssText = `
        font-size: 11px;
        font-weight: ${isToday ? "800" : "500"};
        color: ${isToday ? "#2B6E64" : "#5B6B67"};
        flex: 1;
        text-align: center;
      `;
      labelsEl.appendChild(span);
    });
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderWeekGrid(weekly) {
  const grid = el("week-grid");
  if (!grid) return;
  const totalMin = weekly.reduce((s, d) => s + d.focusMinutes, 0);
  const totalSessions = weekly.reduce((s, d) => s + d.sessionsCompleted, 0);
  const totalTasks = weekly.reduce((s, d) => s + d.tasksCompleted, 0);
  const totalNudges = weekly.reduce((s, d) => s + d.distractionAttempts, 0);

  grid.innerHTML = `
    <div class="wk-stat"><span class="wk-val">${totalMin}</span><span class="wk-label">Focus mins</span></div>
    <div class="wk-stat"><span class="wk-val">${totalSessions}</span><span class="wk-label">Sessions</span></div>
    <div class="wk-stat"><span class="wk-val">${totalTasks}</span><span class="wk-label">Tasks done</span></div>
    <div class="wk-stat"><span class="wk-val">${totalNudges}</span><span class="wk-label">Nudges</span></div>
  `;
}

function renderAlltimeGrid() {
  const grid = el("alltime-grid");
  if (!grid || !state) return;
  const { xp, coins, level, currentStreakDays, longestStreakDays } = state.gamification;
  const totalSessions = state.timer.sessionsCompletedAllTime || 0;
  const totalTasks = state.gamification.totalTasksCompleted || 0;

  grid.innerHTML = `
    <div class="wk-stat teal"><span class="wk-val">${xp}</span><span class="wk-label">Total XP</span></div>
    <div class="wk-stat amber"><span class="wk-val">${coins}</span><span class="wk-label">Coins 🪙</span></div>
    <div class="wk-stat"><span class="wk-val">Lv ${level}</span><span class="wk-label">Level</span></div>
    <div class="wk-stat"><span class="wk-val">${totalSessions}</span><span class="wk-label">Sessions ever</span></div>
    <div class="wk-stat"><span class="wk-val">${totalTasks}</span><span class="wk-label">Tasks done ever</span></div>
    <div class="wk-stat"><span class="wk-val">${longestStreakDays}d</span><span class="wk-label">Best streak</span></div>
  `;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

function renderAchievements() {
  const grid = el("achievement-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const earned = new Set(state.gamification.achievements || []);

  for (const [key, def] of Object.entries(ACHIEVEMENTS)) {
    const isEarned = earned.has(key);
    const card = document.createElement("div");
    card.className = `achievement-card ${isEarned ? "earned" : "locked"}`;
    card.innerHTML = `
      <div class="ach-icon">${def.icon}</div>
      <div class="ach-label">${def.label}</div>
      <div class="ach-desc">${def.desc}</div>
      ${isEarned ? '<div class="ach-earned-mark">✓ Earned</div>' : '<div class="ach-locked-mark">🔒 Locked</div>'}
    `;
    grid.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Focus settings
// ---------------------------------------------------------------------------

function renderFocusSettings() {
  const { settings } = state;
  el("focus-minutes").value = settings.focusMinutes;
  el("short-break-minutes").value = settings.shortBreakMinutes;
  el("long-break-minutes").value = settings.longBreakMinutes;
  el("sessions-until-long").value = settings.sessionsUntilLongBreak;
  el("daily-goal-minutes").value = settings.dailyGoalMinutes;

  renderChipList("block-list", settings.blockList, async (domain) => {
    const list = settings.blockList.filter((d) => d !== domain);
    await saveSettings({ blockList: list });
  });

  renderChipList("allow-list", settings.allowList, async (domain) => {
    const list = settings.allowList.filter((d) => d !== domain);
    await saveSettings({ allowList: list });
  });

  el("block-outside-focus").checked = Boolean(settings.blockOutsideFocus);
  el("notifications-enabled").checked = Boolean(settings.notificationsEnabled);
}

function renderChipList(containerId, domains, onRemove) {
  const container = el(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!domains || !domains.length) {
    container.innerHTML = '<span class="muted small">None added yet</span>';
    return;
  }
  for (const d of domains) {
    const item = document.createElement("span");
    item.className = "chip-item";
    item.textContent = d;
    const btn = document.createElement("button");
    btn.className = "chip-remove";
    btn.textContent = "×";
    btn.setAttribute("aria-label", `Remove ${d}`);
    btn.addEventListener("click", () => onRemove(d));
    item.appendChild(btn);
    container.appendChild(item);
  }
}

function renderTasksSettings() {
  // Notion integration stubbed pending backend
}

// ---------------------------------------------------------------------------
// Account settings
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Account & Profile settings
// ---------------------------------------------------------------------------

function renderAccountSettings() {
  const signedOut = el("account-signed-out");
  const signedIn = el("account-signed-in");
  const user = state?.account;

  if (user?.signedIn) {
    if (signedOut) signedOut.hidden = true;
    if (signedIn) signedIn.hidden = false;

    if (el("user-display-name")) el("user-display-name").textContent = user.name || "Focusora User";
    if (el("user-email-addr")) el("user-email-addr").textContent = user.email || "";
    if (el("user-uid-pill")) el("user-uid-pill").textContent = user.uid ? `UID: ${user.uid}` : "";

    const avatarImg = el("user-avatar-img");
    const avatarInit = el("user-avatar-initial");

    if (user.photoURL && avatarImg) {
      avatarImg.src = user.photoURL;
      avatarImg.hidden = false;
      if (avatarInit) avatarInit.hidden = true;
    } else if (avatarInit) {
      avatarInit.textContent = (user.name || user.email || "U")[0].toUpperCase();
      avatarInit.hidden = false;
      if (avatarImg) avatarImg.hidden = true;
    }

    // Populate profile stat chips
    if (el("profile-level")) el("profile-level").textContent = `Lv ${state.gamification?.level || 1}`;
    if (el("profile-xp")) el("profile-xp").textContent = `${state.gamification?.xp || 0}`;
    if (el("profile-coins")) el("profile-coins").textContent = `${state.gamification?.coins || 0} 🪙`;
    if (el("profile-streak")) el("profile-streak").textContent = `${state.gamification?.currentStreakDays || 0}d 🔥`;
  } else {
    if (signedOut) signedOut.hidden = false;
    if (signedIn) signedIn.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

async function saveSettings(patch) {
  const nextSettings = { ...state.settings, ...patch };
  const res = await send("UPDATE_SETTINGS", { settings: nextSettings });
  if (res?.ok) {
    state = res.state;
    render();
  }
}

function normalizeDomain(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const sectionId = `section-${btn.dataset.section}`;
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.hidden = panel.id !== sectionId;
    });
    // Lazy-render history when switching to that tab
    if (btn.dataset.section === "history") {
      await renderHistory();
    }
  });
});

// ---------------------------------------------------------------------------
// Form event wiring
// ---------------------------------------------------------------------------

const bindNumberField = (id, key) => {
  const input = el(id);
  if (!input) return;
  input.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0) saveSettings({ [key]: val });
  });
};
bindNumberField("focus-minutes", "focusMinutes");
bindNumberField("short-break-minutes", "shortBreakMinutes");
bindNumberField("long-break-minutes", "longBreakMinutes");
bindNumberField("sessions-until-long", "sessionsUntilLongBreak");
bindNumberField("daily-goal-minutes", "dailyGoalMinutes");

el("block-add-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = el("block-add-input");
  const domain = normalizeDomain(input.value);
  if (!domain) return;
  input.value = "";
  if (!state.settings.blockList.includes(domain)) {
    await saveSettings({ blockList: [...state.settings.blockList, domain] });
  }
});

el("allow-add-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = el("allow-add-input");
  const domain = normalizeDomain(input.value);
  if (!domain) return;
  input.value = "";
  if (!state.settings.allowList.includes(domain)) {
    await saveSettings({ allowList: [...state.settings.allowList, domain] });
  }
});

el("block-outside-focus")?.addEventListener("change", (e) => {
  saveSettings({ blockOutsideFocus: e.target.checked });
});

el("notifications-enabled")?.addEventListener("change", (e) => {
  saveSettings({ notificationsEnabled: e.target.checked });
});

// ---------------------------------------------------------------------------
// Account & Cloud Sync actions
// ---------------------------------------------------------------------------

el("btn-google-login")?.addEventListener("click", async () => {
  const errEl = el("auth-error-msg");
  if (errEl) { errEl.hidden = true; errEl.textContent = ""; }

  const loginBtn = el("btn-google-login");
  if (loginBtn) { loginBtn.disabled = true; loginBtn.style.opacity = "0.7"; }

  try {
    initFirebase();
    const user = await signInWithGoogle();
    if (user) {
      const res = await send("UPDATE_ACCOUNT", {
        account: {
          signedIn: true,
          uid: user.uid,
          email: user.email,
          name: user.displayName || (user.email ? user.email.split("@")[0] : "Focusora User"),
          photoURL: user.photoURL || null,
          plan: "free"
        }
      });
      if (res?.ok) {
        state = res.state;
      }
      await refresh();
      // Perform initial cloud backup
      try {
        await syncFullStateToFirestore(state);
      } catch (syncErr) {
        console.warn("[Focusora] Initial Firestore sync warning:", syncErr);
      }
    }
  } catch (err) {
    console.warn("Sign-in notice:", err.message);
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = err.message;
    } else {
      alert("Sign in notice: " + err.message);
    }
  } finally {
    if (loginBtn) { loginBtn.disabled = false; loginBtn.style.opacity = "1"; }
  }
});

el("btn-google-logout")?.addEventListener("click", async () => {
  try { await signOut(); } catch (_) {}
  const res = await send("UPDATE_ACCOUNT", {
    account: { signedIn: false, uid: null, email: null, name: null, photoURL: null, plan: "free" }
  });
  if (res?.ok) state = res.state;
  await refresh();
});

el("btn-sync-now")?.addEventListener("click", async () => {
  const btn = el("btn-sync-now");
  const lastSyncText = el("last-synced-text");
  if (!btn) return;

  btn.classList.add("syncing");
  btn.disabled = true;

  try {
    initFirebase();
    await syncFullStateToFirestore(state);
    if (lastSyncText) {
      lastSyncText.textContent = `Last synced: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  } catch (err) {
    console.error("[Focusora] Sync error:", err);
    if (lastSyncText) {
      lastSyncText.textContent = `Sync failed: ${err.message}`;
    }
  } finally {
    setTimeout(() => {
      btn.classList.remove("syncing");
      btn.disabled = false;
    }, 600);
  }
});

// Data management
el("export-btn")?.addEventListener("click", () => {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `focusora-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

el("clear-btn")?.addEventListener("click", async () => {
  if (confirm("Are you sure? This permanently deletes all your local tasks, streaks, and focus history.")) {
    const res = await send("CLEAR_ALL_DATA");
    if (res?.ok) { state = res.state; render(); }
  }
});

// Version number
el("version-num").textContent = chrome.runtime.getManifest().version;

// ---------------------------------------------------------------------------
// Storage change listener
// ---------------------------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.focusora_state_v1) {
    state = changes.focusora_state_v1.newValue;
    render();
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

initFirebase();
refresh();
