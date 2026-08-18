// utils/storage.js
// ─────────────────────────────────────────────────────────────────────────────
// Unified storage abstraction.
// Reads/writes to chrome.storage.local (always fast, offline-safe).
// Mirrors to Firestore when the user is signed in.
// ─────────────────────────────────────────────────────────────────────────────

export const storage = {
  /**
   * Get one or more keys from chrome.storage.local.
   * @param {string|string[]} keys
   * @returns {Promise<object>}
   */
  get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  },

  /**
   * Set values in chrome.storage.local.
   * @param {object} items
   * @returns {Promise<void>}
   */
  set(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  },

  /**
   * Remove keys from chrome.storage.local.
   * @param {string|string[]} keys
   * @returns {Promise<void>}
   */
  remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  },

  /**
   * Clear all local storage. Used on sign-out.
   * @returns {Promise<void>}
   */
  clear() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Default app state shape
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_STATE = {
  // Auth
  userId: null,
  userEmail: null,
  userName: "Friend",
  isSignedIn: false,

  // Session
  sessionState: "IDLE",         // IDLE | FOCUSING | BREAK | PAUSED
  sessionStartTime: null,       // epoch ms
  sessionDuration: 25 * 60,     // seconds
  breakDuration: 5 * 60,        // seconds
  sessionElapsed: 0,            // seconds elapsed in current phase
  currentTaskId: null,
  distractionsBlocked: 0,

  // Gamification
  xp: 0,
  coins: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,

  // Settings
  blockList: ["youtube.com", "instagram.com", "twitter.com", "facebook.com", "reddit.com", "netflix.com"],
  notificationsEnabled: true,
  onboardingComplete: false,
  focusBadgeEnabled: true
};

/**
 * Load the full app state from chrome.storage.local.
 * Falls back to DEFAULT_STATE for any missing keys.
 * @returns {Promise<object>}
 */
export async function loadState() {
  const saved = await storage.get(null); // get everything
  return { ...DEFAULT_STATE, ...saved };
}

/**
 * Persist a partial state update.
 * @param {object} partial
 */
export async function saveState(partial) {
  await storage.set(partial);
}
