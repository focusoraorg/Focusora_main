// blocked/blocked.js
// Shows blocked site name, records distraction attempt, displays live timer
// and active task, and rotates motivational quotes.
// Note: quotes are inlined here to avoid module-resolution complexity in
// web-accessible resource pages.

const MOTIVATIONAL_QUOTES = [
  "The secret of getting ahead is getting started.",
  "You don't have to be great to start, but you have to start to be great.",
  "Focus is the art of knowing what to ignore.",
  "One task at a time. One moment at a time.",
  "Every distraction is a choice. So is focus.",
  "Progress, not perfection. You're doing great.",
  "This moment is exactly where your work lives.",
  "Small steps. Consistent effort. Big results.",
  "You got this. Back to it.",
  "The mind is everything. What you think, you become.",
  "Deep work is a superpower in a distracted world.",
  "Protect your attention — it's your most valuable resource.",
  "Discomfort is where growth happens. Stay with it.",
  "Your future self will thank you for this session.",
  "Each focused minute compounds over a lifetime."
];

const params = new URLSearchParams(location.search);
const site = params.get("site") || "this site";

document.getElementById("site-line").textContent = site;

// ── Motivational quote ─────────────────────────────────────────────────────

function showQuote() {
  const el = document.getElementById("quote-text");
  if (!el) return;
  const idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  el.textContent = `"${MOTIVATIONAL_QUOTES[idx]}"`;
}
showQuote();

// ── Record distraction attempt ─────────────────────────────────────────────

chrome.runtime.sendMessage({ type: "RECORD_DISTRACTION" }, (res) => {
  if (chrome.runtime.lastError) return;
  const count = res?.state?.timer?.distractionAttemptsThisSession;
  if (typeof count === "number") {
    const note = document.getElementById("attempt-note");
    if (count === 1) {
      note.textContent = "First nudge this session — no judgment, just a gentle reminder.";
    } else if (count <= 3) {
      note.textContent = `${count} nudges this session. You can do this. `;
    } else {
      note.textContent = `${count} nudges today. Consider a short reset break.`;
    }
  }
});

// ── Session state: active task + live countdown ────────────────────────────

let countdownInterval = null;

function formatSeconds(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateCountdown(endsAt) {
  const display = document.getElementById("timer-display");
  if (!display) return;
  const remaining = endsAt - Date.now();
  display.textContent = formatSeconds(remaining);

  if (remaining <= 0) {
    clearInterval(countdownInterval);
    display.textContent = "Done!";
    document.getElementById("timer-card").hidden = true;
  }
}

chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
  if (chrome.runtime.lastError) return;
  const state = res?.state;
  if (!state) return;

  // Active task
  const activeTask = state.tasks?.find((t) => t.id === state.activeTaskId && !t.done);
  if (activeTask) {
    document.getElementById("task-card").hidden = false;
    document.getElementById("task-title").textContent = activeTask.title;
  }

  // Live countdown — only during a focus session
  if (state.timer?.status === "focus" && state.timer?.endsAt) {
    const timerCard = document.getElementById("timer-card");
    timerCard.hidden = false;
    updateCountdown(state.timer.endsAt);
    countdownInterval = setInterval(() => updateCountdown(state.timer.endsAt), 1000);
  }
});

// ── Actions ────────────────────────────────────────────────────────────────

document.getElementById("back-btn").addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    // Close tab or go to new tab
    chrome.tabs.create({ url: "chrome://newtab" });
  }
});

document.getElementById("options-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Cleanup on unload
window.addEventListener("unload", () => {
  if (countdownInterval) clearInterval(countdownInterval);
});
