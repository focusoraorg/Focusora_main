// Focusora — background service worker (Manifest V3)
// Owns: timer/alarm lifecycle, focus-mode site blocking (declarativeNetRequest),
// notifications, and the message API the popup/options pages talk to.

import {
  getState,
  setState,
  grantReward,
  recordDistractionAttempt,
  resetDailyCountersIfNeeded
} from "./lib/storage.js";
import { REWARDS, rewardKeyForMinutes } from "./lib/constants.js";

const TIMER_ALARM = "focusora-timer-end";
const BLOCK_RULE_BASE_ID = 10000; // dynamic rule ids for the active session's block list

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  await getState(); // ensure default state exists
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await resetDailyCountersIfNeeded();
  // If the browser restarted mid-session, reconcile:
  const state = await getState();
  if (state.timer.status === "focus" || state.timer.status === "shortBreak" || state.timer.status === "longBreak") {
    if (state.timer.endsAt && state.timer.endsAt > Date.now()) {
      chrome.alarms.create(TIMER_ALARM, { when: state.timer.endsAt });
      if (state.timer.status === "focus") await applyBlockRules();
    } else {
      await handleSessionComplete(false); // timed out while browser was closed
    }
  }
});

// ---------------------------------------------------------------------------
// Message API (popup + options call this)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    console.error("[Focusora] message handler error", message?.type, err);
    sendResponse({ ok: false, error: String(err?.message || err) });
  });
  return true; // keep the message channel open for the async response
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_STATE":
      return { ok: true, state: await getState() };

    case "START_FOCUS":
      return { ok: true, state: await startFocusSession(message.minutes) };

    case "PAUSE_TIMER":
      return { ok: true, state: await pauseTimer() };

    case "RESUME_TIMER":
      return { ok: true, state: await resumeTimer() };

    case "RESET_TIMER":
      return { ok: true, state: await resetTimer() };

    case "START_BREAK":
      return { ok: true, state: await startBreak(message.breakType) };

    case "COMPLETE_SESSION_NOW":
      return { ok: true, state: await handleSessionComplete(true) };

    case "ADD_TASK":
      return { ok: true, state: await addTask(message.title) };

    case "TOGGLE_TASK":
      return { ok: true, state: await toggleTask(message.taskId) };

    case "DELETE_TASK":
      return { ok: true, state: await deleteTask(message.taskId) };

    case "SET_ACTIVE_TASK":
      return { ok: true, state: await setState({ activeTaskId: message.taskId }) };

    case "UPDATE_SETTINGS": {
      const state = await setState({ settings: message.settings });
      await applyBlockRules(); // reflect new block/allow list immediately
      return { ok: true, state };
    }

    case "COMPLETE_ONBOARDING":
      return {
        ok: true,
        state: await setState({
          onboardingComplete: true,
          settings: message.settings || {}
        })
      };

    case "CLEAR_ALL_DATA":
      await chrome.storage.local.clear();
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: (await chrome.declarativeNetRequest.getDynamicRules()).map(r => r.id)
      });
      return { ok: true, state: await getState() };

    case "RECORD_DISTRACTION":
      await recordDistractionAttempt();
      return { ok: true, state: await getState() };

    case "DISMISS_COMPLETE":
      // User acknowledged the session complete state — go back to idle
      return {
        ok: true,
        state: await setState({
          timer: {
            status: "idle",
            lastSessionXp: null,
            lastSessionCoins: null,
            lastSessionMinutes: null
          }
        })
      };

    // --- Backend-dependent features: stubbed until the API exists ---------
    case "NOTION_CONNECT":
    case "AI_SUGGEST_PLAN":
    case "AI_BREAK_TASK":
      return {
        ok: false,
        error: "This feature requires the Focusora backend (not yet configured).",
        comingSoon: true
      };

    default:
      return { ok: false, error: `Unknown message type: ${message?.type}` };
  }
}

// ---------------------------------------------------------------------------
// Timer logic
// ---------------------------------------------------------------------------

async function startFocusSession(minutesOverride) {
  await resetDailyCountersIfNeeded();
  const state = await getState();
  const minutes = minutesOverride || state.settings.focusMinutes;
  const now = Date.now();
  const endsAt = now + minutes * 60 * 1000;

  const next = await setState({
    timer: {
      status: "focus",
      previousStatus: null,
      startedAt: now,
      endsAt,
      remainingMsAtPause: null,
      distractionAttemptsThisSession: 0,
      lastSessionMinutes: minutes,
      lastSessionXp: null,
      lastSessionCoins: null,
      lastSessionDate: new Date().toISOString().slice(0, 10)
    }
  });

  chrome.alarms.create(TIMER_ALARM, { when: endsAt });
  await applyBlockRules();
  await broadcastState(next);
  await notify(
    "Focus session started 🎯",
    `${minutes} minutes of protected focus. You've got this.`
  );
  return next;
}

async function pauseTimer() {
  const state = await getState();
  const pausable = ["focus", "shortBreak", "longBreak"].includes(state.timer.status);
  if (!pausable) return state;

  const remaining = Math.max(0, (state.timer.endsAt || Date.now()) - Date.now());
  chrome.alarms.clear(TIMER_ALARM);
  const next = await setState({
    timer: {
      status: "paused",
      previousStatus: state.timer.status,
      remainingMsAtPause: remaining,
      endsAt: null
    }
  });
  await clearBlockRules(); // pausing restores user control
  await broadcastState(next);
  return next;
}

async function resumeTimer() {
  const state = await getState();
  if (state.timer.status !== "paused" || state.timer.remainingMsAtPause == null) return state;

  const endsAt = Date.now() + state.timer.remainingMsAtPause;
  const status = state.timer.previousStatus || "focus";
  const next = await setState({
    timer: { status, previousStatus: null, endsAt, remainingMsAtPause: null }
  });
  chrome.alarms.create(TIMER_ALARM, { when: endsAt });
  if (status === "focus") await applyBlockRules();
  await broadcastState(next);
  return next;
}

async function resetTimer() {
  chrome.alarms.clear(TIMER_ALARM);
  await clearBlockRules();
  const next = await setState({
    timer: {
      status: "idle",
      previousStatus: null,
      startedAt: null,
      endsAt: null,
      remainingMsAtPause: null,
      distractionAttemptsThisSession: 0,
      lastSessionXp: null,
      lastSessionCoins: null,
      lastSessionMinutes: null
    }
  });
  await broadcastState(next);
  return next;
}

async function startBreak(breakType /* "short" | "long" */) {
  const state = await getState();
  const minutes = breakType === "long"
    ? state.settings.longBreakMinutes
    : state.settings.shortBreakMinutes;
  const now = Date.now();
  const endsAt = now + minutes * 60 * 1000;

  const next = await setState({
    timer: {
      status: breakType === "long" ? "longBreak" : "shortBreak",
      startedAt: now,
      endsAt,
      remainingMsAtPause: null,
      distractionAttemptsThisSession: 0
    }
  });
  chrome.alarms.create(TIMER_ALARM, { when: endsAt });
  await clearBlockRules();
  await broadcastState(next);
  await notify("Break time ☕", `Step away for ${minutes} minutes. Focusora will bring you back.`);
  return next;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TIMER_ALARM) return;
  await handleSessionComplete(false); // alarm fired — natural completion
});

async function handleSessionComplete(wasManual) {
  const state = await getState();
  const wasFocus = state.timer.status === "focus";
  await clearBlockRules();

  if (wasFocus) {
    // Read values BEFORE writing (avoids race condition with grantReward)
    const minutes = state.timer.lastSessionMinutes || state.settings.focusMinutes;
    const todayLog = state.insights.dailyLog[new Date().toISOString().slice(0, 10)] || {};
    const focusMinutesBeforeThis = todayLog.focusMinutes || 0;
    const dailyGoal = state.settings.dailyGoalMinutes;
    const hitDailyGoal =
      !todayLog.dailyGoalGranted &&
      (focusMinutesBeforeThis + minutes) >= dailyGoal;

    const rewardKey = rewardKeyForMinutes(minutes);
    const { reward, leveledUp, newLevel, streakJustHit7, streakJustHit14, streakJustHit30, newAchievements } =
      await grantReward(rewardKey, {
        focusMinutes: minutes,
        sessionCompleted: true,
        sessionMinutes: minutes,
        hitDailyGoal
      });

    if (hitDailyGoal) {
      await grantReward("DAILY_GOAL", {});
      // Mark goal as granted today
      await setState({
        insights: {
          dailyLog: {
            [new Date().toISOString().slice(0, 10)]: { dailyGoalGranted: true }
          }
        }
      });
    }

    if (streakJustHit7) await grantReward("STREAK_7", {});
    if (streakJustHit14) await grantReward("STREAK_14", {});
    if (streakJustHit30) await grantReward("STREAK_30", {});

    const sessionsToday = (state.timer.sessionsCompletedToday || 0) + 1;
    const sessionsAllTime = (state.timer.sessionsCompletedAllTime || 0) + 1;

    const next = await setState({
      timer: {
        status: "complete", // special state — popup shows XP toast
        startedAt: null,
        endsAt: null,
        remainingMsAtPause: null,
        sessionsCompletedToday: sessionsToday,
        sessionsCompletedAllTime: sessionsAllTime,
        distractionAttemptsThisSession: 0,
        lastSessionXp: reward.xp,
        lastSessionCoins: reward.coins,
        lastSessionMinutes: minutes
      }
    });

    await broadcastState(next);

    let notifMsg = `+${reward.xp} XP  +${reward.coins} coins`;
    if (leveledUp) notifMsg += ` · Level up → Lv ${newLevel}! 🎉`;
    if (hitDailyGoal) notifMsg += ` · Daily goal hit! ✨`;
    await notify("Focus session complete 🎉", notifMsg);

  } else {
    // Break ended
    const next = await setState({
      timer: {
        status: "idle",
        startedAt: null,
        endsAt: null,
        remainingMsAtPause: null,
        distractionAttemptsThisSession: 0
      }
    });
    await broadcastState(next);
    await notify("Break's over 🎯", "Ready for another focus session whenever you are.");
  }

  return getState();
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

async function addTask(title) {
  const trimmed = (title || "").trim();
  if (!trimmed) return getState();
  const state = await getState();
  const task = {
    id: crypto.randomUUID(),
    title: trimmed,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
    source: "manual"
  };
  const tasks = [task, ...state.tasks];
  const activeTaskId = state.activeTaskId || task.id;
  return setState({ tasks, activeTaskId });
}

async function toggleTask(taskId) {
  const state = await getState();
  let justCompleted = false;
  const tasks = state.tasks.map((t) => {
    if (t.id !== taskId) return t;
    const done = !t.done;
    if (done) justCompleted = true;
    return { ...t, done, completedAt: done ? Date.now() : null };
  });
  const next = await setState({ tasks });
  if (justCompleted) {
    await grantReward("TASK_COMPLETE", { taskCompleted: true });
  }
  return getState();
}

async function deleteTask(taskId) {
  const state = await getState();
  const tasks = state.tasks.filter((t) => t.id !== taskId);
  const activeTaskId = state.activeTaskId === taskId ? null : state.activeTaskId;
  return setState({ tasks, activeTaskId });
}

// ---------------------------------------------------------------------------
// Focus-mode blocking (declarativeNetRequest)
// ---------------------------------------------------------------------------

async function applyBlockRules() {
  const state = await getState();
  const shouldBlock = state.timer.status === "focus" || state.settings.blockOutsideFocus;
  if (!shouldBlock) return clearBlockRules();

  const domains = state.settings.blockList.filter(
    (d) => d && !state.settings.allowList.includes(d)
  );
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const addRules = domains.map((domain, i) => ({
    id: BLOCK_RULE_BASE_ID + i,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: `/blocked/blocked.html?site=${encodeURIComponent(domain)}` }
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: ["main_frame"]
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function clearBlockRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length === 0) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id)
  });
}

// ---------------------------------------------------------------------------
// State broadcast — tells content scripts and other extension pages
// ---------------------------------------------------------------------------

async function broadcastState(state) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATE", state }).catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function notify(title, message) {
  const state = await getState();
  if (!state.settings.notificationsEnabled) return;
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message,
    priority: 1
  });
}
