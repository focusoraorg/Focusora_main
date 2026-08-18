// utils/notifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Chrome Notifications helpers with Focusora branding.
// ─────────────────────────────────────────────────────────────────────────────

const ICON = chrome.runtime.getURL("icons/icon128.png");

/**
 * Show a Chrome notification.
 * @param {object} opts
 * @param {string} opts.id      - Unique notification ID (auto-clears previous with same id)
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {'basic'|'list'} [opts.type='basic']
 * @param {Array}  [opts.buttons] - Up to 2 button objects {title}
 */
export function notify({ id, title, message, type = "basic", buttons = [] }) {
  const options = {
    type,
    iconUrl: ICON,
    title,
    message,
    priority: 2,
    silent: false
  };
  if (buttons.length) options.buttons = buttons;

  // Clear existing notification with same id first
  chrome.notifications.clear(id, () => {
    chrome.notifications.create(id, options);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-defined notification events
// ─────────────────────────────────────────────────────────────────────────────

export const Notifications = {
  sessionStarted(taskTitle) {
    notify({
      id: "focusora_session",
      title: "🎯 Focus session started!",
      message: taskTitle
        ? `Working on: "${taskTitle}". Stay focused — you've got this!`
        : "Your focus session has started. Distractions are now blocked."
    });
  },

  sessionComplete(durationMin, xpEarned) {
    notify({
      id: "focusora_session",
      title: "✅ Session complete! Great work.",
      message: `You focused for ${durationMin} min and earned ${xpEarned} XP. Take a well-deserved break.`
    });
  },

  breakStarted(breakMin) {
    notify({
      id: "focusora_break",
      title: "☕ Break time!",
      message: `Enjoy your ${breakMin}-minute break. Step away from the screen.`
    });
  },

  breakComplete() {
    notify({
      id: "focusora_break",
      title: "🔔 Break's over — ready to refocus?",
      message: "Your break is done. Open Focusora to start your next session."
    });
  },

  distractionBlocked(count) {
    notify({
      id: "focusora_distraction",
      title: "💪 You stayed on track!",
      message: `You got distracted ${count} time${count !== 1 ? "s" : ""} this session — that's okay. Back to work!`
    });
  }
};
