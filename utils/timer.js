// utils/timer.js
// ─────────────────────────────────────────────────────────────────────────────
// Pomodoro timer state machine using chrome.alarms.
// The alarm survives service worker sleep — this is critical for MV3.
//
// Session states: IDLE → FOCUSING → BREAK → IDLE
// ─────────────────────────────────────────────────────────────────────────────

export const SessionState = {
  IDLE: "IDLE",
  FOCUSING: "FOCUSING",
  PAUSED: "PAUSED",
  BREAK: "BREAK"
};

const ALARM_TICK = "focusora_tick";
const ALARM_SESSION_END = "focusora_session_end";
const ALARM_BREAK_END = "focusora_break_end";

/**
 * Start a new focus session.
 * @param {number} durationSeconds
 * @param {string|null} taskId
 * @param {function} onStateChange - called with updated partial state
 */
export async function startSession(durationSeconds, taskId, onStateChange) {
  const now = Date.now();

  const newState = {
    sessionState: SessionState.FOCUSING,
    sessionStartTime: now,
    sessionDuration: durationSeconds,
    sessionElapsed: 0,
    currentTaskId: taskId || null,
    distractionsBlocked: 0,
    pausedAt: null
  };

  // Schedule the session-end alarm
  chrome.alarms.create(ALARM_SESSION_END, {
    delayInMinutes: durationSeconds / 60
  });

  // Tick every 5 seconds to persist elapsed time (for popup display)
  chrome.alarms.create(ALARM_TICK, {
    periodInMinutes: 5 / 60  // every 5 seconds
  });

  onStateChange(newState);
}

/**
 * Pause a session (saves how far we got).
 * @param {object} currentState
 * @param {function} onStateChange
 */
export function pauseSession(currentState, onStateChange) {
  if (currentState.sessionState !== SessionState.FOCUSING) return;

  const elapsed = Math.floor((Date.now() - currentState.sessionStartTime) / 1000);
  chrome.alarms.clear(ALARM_SESSION_END);
  chrome.alarms.clear(ALARM_TICK);

  onStateChange({
    sessionState: SessionState.PAUSED,
    sessionElapsed: elapsed,
    pausedAt: Date.now()
  });
}

/**
 * Resume a paused session.
 * @param {object} currentState
 * @param {function} onStateChange
 */
export function resumeSession(currentState, onStateChange) {
  if (currentState.sessionState !== SessionState.PAUSED) return;

  const remaining = currentState.sessionDuration - currentState.sessionElapsed;
  const newStart = Date.now() - (currentState.sessionElapsed * 1000);

  chrome.alarms.create(ALARM_SESSION_END, {
    delayInMinutes: remaining / 60
  });
  chrome.alarms.create(ALARM_TICK, {
    periodInMinutes: 5 / 60
  });

  onStateChange({
    sessionState: SessionState.FOCUSING,
    sessionStartTime: newStart,
    pausedAt: null
  });
}

/**
 * End a session early (user choice).
 * @param {object} currentState
 * @param {function} onStateChange
 */
export function endSessionEarly(currentState, onStateChange) {
  chrome.alarms.clear(ALARM_SESSION_END);
  chrome.alarms.clear(ALARM_TICK);
  chrome.alarms.clear(ALARM_BREAK_END);

  onStateChange({
    sessionState: SessionState.IDLE,
    sessionStartTime: null,
    sessionElapsed: 0,
    currentTaskId: null,
    distractionsBlocked: 0,
    pausedAt: null
  });
}

/**
 * Start the break phase after session completion.
 * @param {number} breakSeconds
 * @param {function} onStateChange
 */
export function startBreak(breakSeconds, onStateChange) {
  chrome.alarms.clear(ALARM_TICK);
  chrome.alarms.create(ALARM_BREAK_END, {
    delayInMinutes: breakSeconds / 60
  });

  onStateChange({
    sessionState: SessionState.BREAK,
    sessionStartTime: Date.now(),
    sessionDuration: breakSeconds
  });
}

/**
 * Calculate seconds remaining in the current phase.
 * @param {object} state
 * @returns {number} seconds remaining (≥ 0)
 */
export function getSecondsRemaining(state) {
  if (state.sessionState === SessionState.IDLE) return 0;

  if (state.sessionState === SessionState.PAUSED) {
    return Math.max(0, state.sessionDuration - state.sessionElapsed);
  }

  const elapsed = Math.floor((Date.now() - state.sessionStartTime) / 1000);
  return Math.max(0, state.sessionDuration - elapsed);
}

/**
 * Format seconds as MM:SS string.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const ALARMS = { ALARM_TICK, ALARM_SESSION_END, ALARM_BREAK_END };
