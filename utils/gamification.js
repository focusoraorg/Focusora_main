// utils/gamification.js
// ─────────────────────────────────────────────────────────────────────────────
// XP, Coins, Levels, Streaks, and Achievements logic.
// ─────────────────────────────────────────────────────────────────────────────

// ── XP & Coin rewards ────────────────────────────────────────────────────────
export const REWARDS = {
  COMPLETE_SESSION_25:  { xp: 25, coins: 5 },
  COMPLETE_SESSION_50:  { xp: 50, coins: 10 },
  COMPLETE_TASK:        { xp: 15, coins: 3 },
  DAILY_GOAL:           { xp: 50, coins: 10 },
  STREAK_7_DAYS:        { xp: 150, coins: 30 },
  STREAK_30_DAYS:       { xp: 500, coins: 100 },
};

// ── Level thresholds (XP needed to reach each level) ────────────────────────
export const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  900,   // Level 5
  1400,  // Level 6
  2000,  // Level 7
  2800,  // Level 8
  3800,  // Level 9
  5000,  // Level 10
];

export const LEVEL_NAMES = [
  "Beginner",
  "Focused",
  "Consistent",
  "Dedicated",
  "Productive",
  "Sharp",
  "Elite",
  "Master",
  "Expert",
  "Legend"
];

/**
 * Calculate the current level from total XP.
 * @param {number} totalXp
 * @returns {{ level: number, levelName: string, xpToNext: number, progress: number }}
 */
export function calculateLevel(totalXp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const xpInLevel = totalXp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
  const xpToNext = Math.max(0, nextThreshold - totalXp);

  return {
    level,
    levelName: LEVEL_NAMES[level - 1] || "Legend",
    xpToNext,
    progress
  };
}

/**
 * Compute rewards for completing a focus session.
 * @param {number} durationSeconds - Actual session duration
 * @param {boolean} completedTask  - Did the user mark their task done?
 * @returns {{ xp: number, coins: number, events: string[] }}
 */
export function computeSessionRewards(durationSeconds, completedTask) {
  const durationMin = durationSeconds / 60;
  let xp = 0;
  let coins = 0;
  const events = [];

  if (durationMin >= 50) {
    xp += REWARDS.COMPLETE_SESSION_50.xp;
    coins += REWARDS.COMPLETE_SESSION_50.coins;
    events.push("COMPLETE_SESSION_50");
  } else if (durationMin >= 25) {
    xp += REWARDS.COMPLETE_SESSION_25.xp;
    coins += REWARDS.COMPLETE_SESSION_25.coins;
    events.push("COMPLETE_SESSION_25");
  } else {
    // Partial session — proportional reward
    const ratio = durationMin / 25;
    xp += Math.round(REWARDS.COMPLETE_SESSION_25.xp * ratio);
    coins += Math.round(REWARDS.COMPLETE_SESSION_25.coins * ratio);
  }

  if (completedTask) {
    xp += REWARDS.COMPLETE_TASK.xp;
    coins += REWARDS.COMPLETE_TASK.coins;
    events.push("COMPLETE_TASK");
  }

  return { xp, coins, events };
}

/**
 * Update streak based on the last active date.
 * @param {number|null} lastActiveDateMs  - epoch ms of last active day, or null
 * @param {number} currentStreak
 * @returns {{ streak: number, streakBroken: boolean, newRecord: boolean }}
 */
export function updateStreak(lastActiveDateMs, currentStreak) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!lastActiveDateMs) {
    return { streak: 1, streakBroken: false, newRecord: false };
  }

  const lastActive = new Date(lastActiveDateMs);
  lastActive.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today - lastActive) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Already active today — streak unchanged
    return { streak: currentStreak, streakBroken: false, newRecord: false };
  } else if (diffDays === 1) {
    // Consecutive day — increment
    const newStreak = currentStreak + 1;
    return { streak: newStreak, streakBroken: false, newRecord: newStreak > currentStreak };
  } else {
    // Missed a day — reset
    return { streak: 1, streakBroken: true, newRecord: false };
  }
}

// ── Achievements ──────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: "first_session",   title: "First Step",       desc: "Complete your first focus session",    xpBonus: 20  },
  { id: "sessions_5",      title: "Getting Started",  desc: "Complete 5 focus sessions",            xpBonus: 30  },
  { id: "sessions_25",     title: "In the Flow",      desc: "Complete 25 focus sessions",           xpBonus: 75  },
  { id: "sessions_100",    title: "Focus Master",     desc: "Complete 100 focus sessions",          xpBonus: 200 },
  { id: "streak_3",        title: "Consistent",       desc: "Maintain a 3-day streak",              xpBonus: 30  },
  { id: "streak_7",        title: "Week Warrior",     desc: "Maintain a 7-day streak",              xpBonus: 100 },
  { id: "streak_30",       title: "Unstoppable",      desc: "Maintain a 30-day streak",             xpBonus: 300 },
  { id: "tasks_10",        title: "Finisher",         desc: "Complete 10 tasks",                    xpBonus: 50  },
  { id: "level_5",         title: "Sharp Mind",       desc: "Reach Level 5",                        xpBonus: 100 },
  { id: "level_10",        title: "Legend",           desc: "Reach Level 10",                       xpBonus: 500 },
];

/**
 * Check which achievements are newly unlocked given current stats.
 * @param {object} stats - { sessions, streak, tasksCompleted, level, unlockedAchievements }
 * @returns {string[]} Array of newly unlocked achievement IDs
 */
export function checkAchievements(stats) {
  const { sessions, streak, tasksCompleted, level, unlockedAchievements = [] } = stats;
  const newly = [];

  const check = (id, condition) => {
    if (condition && !unlockedAchievements.includes(id)) newly.push(id);
  };

  check("first_session",  sessions >= 1);
  check("sessions_5",     sessions >= 5);
  check("sessions_25",    sessions >= 25);
  check("sessions_100",   sessions >= 100);
  check("streak_3",       streak >= 3);
  check("streak_7",       streak >= 7);
  check("streak_30",      streak >= 30);
  check("tasks_10",       tasksCompleted >= 10);
  check("level_5",        level >= 5);
  check("level_10",       level >= 10);

  return newly;
}
