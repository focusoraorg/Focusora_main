// Focusora — storage layer
// All state lives in chrome.storage.local under STORAGE_KEY.
// deepMerge patches nested objects while preserving unmentioned keys.

import {
  STORAGE_KEY,
  DEFAULT_STATE,
  REWARDS,
  LEVEL_THRESHOLDS,
  ACHIEVEMENTS,
  rewardKeyForMinutes
} from "./constants.js";

// ---------------------------------------------------------------------------
// Deep merge utility
// ---------------------------------------------------------------------------

function deepMerge(base, patch) {
  if (Array.isArray(base)) return patch !== undefined ? patch : base;
  if (typeof base !== "object" || base === null) return patch !== undefined ? patch : base;
  const out = { ...base };
  for (const key of Object.keys(patch || {})) {
    out[key] = deepMerge(base[key], patch[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core state accessors
// ---------------------------------------------------------------------------

export async function getState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const existing = stored[STORAGE_KEY];
  if (!existing) {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STATE });
    return structuredClone(DEFAULT_STATE);
  }
  // Always merge against DEFAULT_STATE so new keys are populated
  return deepMerge(DEFAULT_STATE, existing);
}

export async function setState(patch) {
  const current = await getState();
  const next = deepMerge(current, patch);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function replaceState(next) {
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export function onStateChanged(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;
    callback(changes[STORAGE_KEY].newValue, changes[STORAGE_KEY].oldValue);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isYesterday(dateISO) {
  if (!dateISO) return false;
  const d = new Date(dateISO + "T00:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

// ---------------------------------------------------------------------------
// Gamification — level helpers
// ---------------------------------------------------------------------------

export function levelForXp(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function xpForNextLevel(xp) {
  const currentLevel = levelForXp(xp);
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel];
  if (nextThreshold === undefined) return null; // max level
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1];
  return {
    xpIntoLevel: xp - currentThreshold,
    xpNeededForLevel: nextThreshold - currentThreshold,
    nextLevel: currentLevel + 1
  };
}

// ---------------------------------------------------------------------------
// Daily counters reset (call at the start of each day)
// ---------------------------------------------------------------------------

export async function resetDailyCountersIfNeeded() {
  const state = await getState();
  const today = todayISO();
  const lastDate = state.timer.lastSessionDate;

  // If last session was not today, reset per-day timer counters
  if (lastDate && lastDate !== today) {
    await setState({
      timer: {
        sessionsCompletedToday: 0
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Weekly insights aggregator
// ---------------------------------------------------------------------------

export async function getWeeklyInsights() {
  const state = await getState();
  const log = state.insights.dailyLog;
  const today = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    result.push({
      date: iso,
      label: i === 0 ? "Today" : dayName,
      focusMinutes: log[iso]?.focusMinutes || 0,
      sessionsCompleted: log[iso]?.sessionsCompleted || 0,
      tasksCompleted: log[iso]?.tasksCompleted || 0,
      distractionAttempts: log[iso]?.distractionAttempts || 0
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Achievement checker — call after any gamification update
// ---------------------------------------------------------------------------

function checkAndUnlockAchievements(g, extra = {}) {
  const newAchievements = [];
  const earned = g.achievements;

  const maybe = (id) => !earned.includes(id) && !newAchievements.includes(id);

  if (maybe("first_session") && g.xp > 0) newAchievements.push("first_session");
  if (maybe("streak_3") && g.currentStreakDays >= 3) newAchievements.push("streak_3");
  if (maybe("streak_7") && g.currentStreakDays >= 7) newAchievements.push("streak_7");
  if (maybe("streak_14") && g.currentStreakDays >= 14) newAchievements.push("streak_14");
  if (maybe("streak_30") && g.currentStreakDays >= 30) newAchievements.push("streak_30");
  if (maybe("tasks_10") && g.totalTasksCompleted >= 10) newAchievements.push("tasks_10");
  if (maybe("tasks_50") && g.totalTasksCompleted >= 50) newAchievements.push("tasks_50");
  if (maybe("daily_goal_first") && extra.hitDailyGoal) newAchievements.push("daily_goal_first");
  if (maybe("deep_worker") && extra.sessionMinutes >= 50) newAchievements.push("deep_worker");
  if (maybe("early_bird") && extra.earlyBird) newAchievements.push("early_bird");

  return newAchievements;
}

// ---------------------------------------------------------------------------
// Grant reward — called after completing sessions, tasks, goals, streaks
// ---------------------------------------------------------------------------

export async function grantReward(rewardKey, extra = {}) {
  const state = await getState();
  const reward = REWARDS[rewardKey];
  if (!reward) throw new Error(`Unknown reward key: ${rewardKey}`);

  const g = state.gamification;
  const newXp = g.xp + reward.xp;
  const newCoins = g.coins + reward.coins;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > g.level;

  const today = todayISO();

  // Streak calculation
  let streak = g.currentStreakDays;
  if (g.lastActiveDateISO !== today) {
    if (isYesterday(g.lastActiveDateISO)) {
      streak += 1;
    } else if (!g.lastActiveDateISO) {
      streak = 1;
    } else {
      // Gap in streak — reset
      streak = 1;
    }
  }
  const longest = Math.max(g.longestStreakDays, streak);

  // Check for early bird (session started before 8am)
  const hour = new Date().getHours();
  const earlyBird = hour < 8;

  // Achievement check
  const updatedG = {
    ...g,
    xp: newXp,
    coins: newCoins,
    level: newLevel,
    currentStreakDays: streak,
    longestStreakDays: longest,
    lastActiveDateISO: today
  };
  const newAchievements = checkAndUnlockAchievements(updatedG, {
    ...extra,
    earlyBird,
    sessionMinutes: extra.focusMinutes
  });

  const allAchievements = [...g.achievements, ...newAchievements];

  await setState({
    gamification: {
      xp: newXp,
      coins: newCoins,
      level: newLevel,
      currentStreakDays: streak,
      longestStreakDays: longest,
      lastActiveDateISO: today,
      achievements: allAchievements,
      totalTasksCompleted: extra.taskCompleted
        ? (g.totalTasksCompleted || 0) + 1
        : (g.totalTasksCompleted || 0)
    }
  });

  // Update daily log
  const log = state.insights.dailyLog[today] || {
    focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0, distractionAttempts: 0
  };
  if (extra.focusMinutes) log.focusMinutes = (log.focusMinutes || 0) + extra.focusMinutes;
  if (extra.sessionCompleted) log.sessionsCompleted = (log.sessionsCompleted || 0) + 1;
  if (extra.taskCompleted) log.tasksCompleted = (log.tasksCompleted || 0) + 1;

  await setState({ insights: { dailyLog: { [today]: log } } });

  return {
    reward,
    leveledUp,
    newLevel,
    newStreak: streak,
    streakJustHit7: streak === 7 && g.currentStreakDays < 7,
    streakJustHit14: streak === 14 && g.currentStreakDays < 14,
    streakJustHit30: streak === 30 && g.currentStreakDays < 30,
    newAchievements
  };
}

// ---------------------------------------------------------------------------
// Record a distraction attempt during a focus session
// ---------------------------------------------------------------------------

export async function recordDistractionAttempt() {
  const state = await getState();
  const today = todayISO();
  const log = state.insights.dailyLog[today] || {
    focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0, distractionAttempts: 0
  };
  log.distractionAttempts = (log.distractionAttempts || 0) + 1;

  await setState({
    timer: {
      distractionAttemptsThisSession: (state.timer.distractionAttemptsThisSession || 0) + 1
    },
    insights: { dailyLog: { [today]: log } }
  });
}
