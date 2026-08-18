// Focusora — shared constants
// Single source of truth for the gamification economy, achievements, defaults,
// soundscapes, and quotes so background, popup, and options never drift out of sync.

export const STORAGE_KEY = "focusora_state_v1";

// ---------------------------------------------------------------------------
// Rewards — XP and coins for various actions
// ---------------------------------------------------------------------------

export const REWARDS = {
  FOCUS_SESSION_25:  { xp: 25,  coins: 5  }, // 25-minute focus session
  FOCUS_SESSION_15:  { xp: 15,  coins: 3  }, // 15-minute quick sprint
  FOCUS_SESSION_50:  { xp: 40,  coins: 8  }, // 50-minute deep work
  FOCUS_SESSION_90:  { xp: 65,  coins: 13 }, // 90-minute ultra-focus
  TASK_COMPLETE:     { xp: 15,  coins: 3  }, // completing a planned task
  DAILY_GOAL:        { xp: 50,  coins: 10 }, // hitting daily focus goal
  STREAK_7:          { xp: 150, coins: 30 }, // 7-day streak milestone
  STREAK_14:         { xp: 300, coins: 60 }, // 14-day streak milestone
  STREAK_30:         { xp: 700, coins: 140}, // 30-day streak milestone
  POSTURE_CHECK:     { xp: 10,  coins: 2  }, // optional posture/break check
};

/**
 * Returns the most appropriate reward key for a given session length.
 * @param {number} minutes
 */
export function rewardKeyForMinutes(minutes) {
  if (minutes <= 20) return "FOCUS_SESSION_15";
  if (minutes <= 35) return "FOCUS_SESSION_25";
  if (minutes <= 65) return "FOCUS_SESSION_50";
  return "FOCUS_SESSION_90";
}

// ---------------------------------------------------------------------------
// Levels — XP required to reach each level. Level = array index + 1.
// ---------------------------------------------------------------------------

export const LEVEL_THRESHOLDS = [
  0, 50, 120, 220, 350, 520, 730, 1000, 1350, 1800,
  2400, 3200, 4200, 5500, 7200, 9500, 12500, 16500, 22000, 30000
];

// ---------------------------------------------------------------------------
// Session duration defaults
// ---------------------------------------------------------------------------

export const DEFAULT_DURATIONS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4
};

// ---------------------------------------------------------------------------
// Distraction sites — shown as presets in onboarding
// ---------------------------------------------------------------------------

export const SUGGESTED_DISTRACTION_SITES = [
  "instagram.com", "x.com", "twitter.com", "facebook.com",
  "youtube.com", "reddit.com", "tiktok.com", "netflix.com",
  "whatsapp.com", "snapchat.com", "linkedin.com"
];

// ---------------------------------------------------------------------------
// Daily focus goal
// ---------------------------------------------------------------------------

export const DAILY_FOCUS_GOAL_MINUTES_DEFAULT = 100; // ~4 × 25-min sessions

// ---------------------------------------------------------------------------
// Achievements — definitions for display and unlock conditions
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS = {
  first_session: {
    id: "first_session",
    label: "First Focus",
    icon: "🎯",
    desc: "Completed your first focus session."
  },
  streak_3: {
    id: "streak_3",
    label: "3-Day Streak",
    icon: "🔥",
    desc: "Focused 3 days in a row."
  },
  streak_7: {
    id: "streak_7",
    label: "Week Warrior",
    icon: "⚡",
    desc: "Focused 7 days in a row."
  },
  streak_14: {
    id: "streak_14",
    label: "Fortnight Focus",
    icon: "💎",
    desc: "Focused 14 days in a row."
  },
  streak_30: {
    id: "streak_30",
    label: "Unstoppable",
    icon: "🏆",
    desc: "Focused 30 days in a row."
  },
  tasks_10: {
    id: "tasks_10",
    label: "Task Crusher",
    icon: "✅",
    desc: "Completed 10 tasks."
  },
  tasks_50: {
    id: "tasks_50",
    label: "Task Master",
    icon: "🌟",
    desc: "Completed 50 tasks."
  },
  daily_goal_first: {
    id: "daily_goal_first",
    label: "Goal Getter",
    icon: "🎖",
    desc: "Hit your daily focus goal for the first time."
  },
  deep_worker: {
    id: "deep_worker",
    label: "Deep Worker",
    icon: "🧠",
    desc: "Completed a 50+ minute focus session."
  },
  early_bird: {
    id: "early_bird",
    label: "Early Bird",
    icon: "🌅",
    desc: "Started a focus session before 8am."
  }
};

// ---------------------------------------------------------------------------
// Soundscapes — definitions for the in-popup ambient player
// ---------------------------------------------------------------------------

export const SOUNDSCAPES = [
  { id: "rain",       label: "Rain",        icon: "🌧",  type: "noise", color: "#4A90D9" },
  { id: "forest",     label: "Forest",      icon: "🌲",  type: "noise", color: "#2B6E64" },
  { id: "cafe",       label: "Café",        icon: "☕",  type: "noise", color: "#8B5E3C" },
  { id: "whitenoise", label: "White Noise", icon: "〜",  type: "noise", color: "#7B7B8D" },
  { id: "deep",       label: "Deep Focus",  icon: "🎵",  type: "tone",  color: "#5B3FA6" },
  { id: "off",        label: "Off",         icon: "🔇",  type: "off",   color: "#5B6B67" }
];

// ---------------------------------------------------------------------------
// Motivational quotes — displayed on the blocked page (rotated randomly)
// ---------------------------------------------------------------------------

export const MOTIVATIONAL_QUOTES = [
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

// ---------------------------------------------------------------------------
// Default application state
// ---------------------------------------------------------------------------

export const DEFAULT_STATE = {
  version: 2,
  onboardingComplete: false,

  account: {
    signedIn: false,
    uid: null,
    email: null,
    name: null,
    photoURL: null,
    plan: "free" // "free" | "premium"
  },

  settings: {
    focusMinutes: DEFAULT_DURATIONS.focusMinutes,
    shortBreakMinutes: DEFAULT_DURATIONS.shortBreakMinutes,
    longBreakMinutes: DEFAULT_DURATIONS.longBreakMinutes,
    sessionsUntilLongBreak: DEFAULT_DURATIONS.sessionsUntilLongBreak,
    dailyGoalMinutes: DAILY_FOCUS_GOAL_MINUTES_DEFAULT,
    blockList: ["instagram.com", "x.com", "twitter.com", "facebook.com", "reddit.com", "tiktok.com"],
    allowList: [],
    notificationsEnabled: true,
    blockOutsideFocus: false,
    soundscapeId: "off",      // default: no ambient sound
    soundscapeVolume: 0.5
  },

  tasks: [],
  activeTaskId: null,

  timer: {
    status: "idle", // "idle" | "focus" | "shortBreak" | "longBreak" | "paused" | "complete"
    previousStatus: null,
    startedAt: null,
    endsAt: null,
    remainingMsAtPause: null,
    sessionsCompletedToday: 0,
    sessionsCompletedAllTime: 0,
    distractionAttemptsThisSession: 0,
    lastSessionMinutes: null,   // for XP display after completion
    lastSessionXp: null,        // XP earned in last session
    lastSessionCoins: null,     // coins earned in last session
    lastSessionDate: null       // ISO date of last session — for daily reset
  },

  gamification: {
    xp: 0,
    coins: 0,
    level: 1,
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastActiveDateISO: null,
    achievements: [],
    totalTasksCompleted: 0
  },

  insights: {
    dailyLog: {}
  }
};
