// utils/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Firestore & Auth integration for the extension.
//
// Uses Firebase JS SDK via local compat bundles (lib/firebase-*-compat.js).
// All calls are guarded by auth state — no writes happen when signed out.
//
// Data model:
//   users/{uid}                   → profile, settings, gamification, metadata
//   users/{uid}/tasks/{taskId}    → individual tasks
//   users/{uid}/sessions/{id}     → completed focus sessions
// ─────────────────────────────────────────────────────────────────────────────

import FIREBASE_CONFIG from "../firebase/firebase-config.js";

let _db = null;
let _auth = null;
let _currentUser = null;

/**
 * Initialize Firebase. Call once after local compat scripts are loaded.
 * Safe to call multiple times — only initializes once.
 */
export function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.warn("[Focusora Firebase] Firebase SDK scripts not yet loaded in this document.");
      return false;
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = firebase.firestore();
    _auth = firebase.auth();

    _auth.onAuthStateChanged((user) => {
      _currentUser = user;
    });

    console.log("[Focusora Firebase] Initialized successfully.");
    return true;
  } catch (e) {
    console.error("[Focusora Firebase] Init failed:", e);
    return false;
  }
}

export function getDb() { return _db; }
export function getAuth() { return _auth; }
export function getCurrentUser() { return _currentUser; }

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Sign in with Google using chrome.identity.
 * Gets an OAuth token via chrome.identity.getAuthToken,
 * then passes it to Firebase as a Google credential.
 * @returns {Promise<firebase.User>}
 */
export async function signInWithGoogle() {
  if (!initFirebase() && typeof firebase === "undefined") {
    throw new Error("Firebase SDK is not loaded. Please refresh the page.");
  }

  return new Promise((resolve, reject) => {
    if (!chrome?.identity?.getAuthToken) {
      reject(new Error("Chrome Identity API is unavailable in this environment."));
      return;
    }

    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        const msg = chrome.runtime.lastError?.message || "Google authentication was cancelled or failed.";
        if (msg.includes("OAuth2") || msg.includes("client ID")) {
          reject(new Error(`OAuth2 Client ID configuration issue: ${msg}. Make sure your Extension ID is added to Google Cloud Console.`));
        } else {
          reject(new Error(msg));
        }
        return;
      }

      try {
        const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
        const result = await _auth.signInWithCredential(credential);
        const user = result.user;
        _currentUser = user;

        // Upsert user profile in Firestore
        if (user && _db) {
          const userRef = _db.collection("users").doc(user.uid);
          await userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "Focusora User",
            photoURL: user.photoURL || null,
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }

        resolve(user);
      } catch (e) {
        console.error("[Focusora Firebase] Credential sign-in error:", e);
        reject(e);
      }
    });
  });
}

/**
 * Sign out from Firebase and revoke Chrome identity token.
 */
export async function signOut() {
  if (_auth) {
    try {
      await _auth.signOut();
    } catch (_) {}
  }
  _currentUser = null;
  if (chrome?.identity?.clearAllCachedAuthTokens) {
    chrome.identity.clearAllCachedAuthTokens(() => {});
  }
}

// ── User Profile & Full State Cloud Sync ──────────────────────────────────────

/**
 * Create or update the user document in Firestore.
 * @param {object} data - partial user profile fields
 */
export async function saveUserProfile(data) {
  if (!_currentUser || !_db) return;
  const ref = _db.collection("users").doc(_currentUser.uid);
  await ref.set({
    ...data,
    lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/**
 * Load user profile from Firestore.
 * @returns {Promise<object|null>}
 */
export async function loadUserProfile() {
  if (!_currentUser || !_db) return null;
  const doc = await _db.collection("users").doc(_currentUser.uid).get();
  return doc.exists ? doc.data() : null;
}

/**
 * Push full local state (gamification, settings, tasks, insights) to Firestore.
 * @param {object} state - full Focusora application state
 */
export async function syncFullStateToFirestore(state) {
  if (!_currentUser || !_db || !state) return false;

  const uid = _currentUser.uid;
  const userRef = _db.collection("users").doc(uid);

  const payload = {
    uid,
    email: state.account?.email || _currentUser.email,
    displayName: state.account?.name || _currentUser.displayName,
    photoURL: _currentUser.photoURL || null,
    plan: state.account?.plan || "free",
    gamification: state.gamification || {},
    settings: state.settings || {},
    insights: state.insights || {},
    lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await userRef.set(payload, { merge: true });

  // Sync tasks
  if (Array.isArray(state.tasks) && state.tasks.length) {
    const batch = _db.batch();
    for (const task of state.tasks) {
      if (!task.id) continue;
      const taskRef = userRef.collection("tasks").doc(task.id);
      batch.set(taskRef, task, { merge: true });
    }
    await batch.commit();
  }

  return true;
}

/**
 * Fetch full user data from Firestore to restore on a new device.
 */
export async function fetchFullStateFromFirestore() {
  if (!_currentUser || !_db) return null;
  const doc = await _db.collection("users").doc(_currentUser.uid).get();
  if (!doc.exists) return null;

  const data = doc.data();
  const tasksSnap = await _db
    .collection("users").doc(_currentUser.uid)
    .collection("tasks")
    .limit(100)
    .get();

  const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return {
    ...data,
    tasks: tasks.length ? tasks : (data.tasks || [])
  };
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * Save a task to Firestore.
 * @param {object} task - { id, title, completed, createdAt }
 */
export async function saveTask(task) {
  if (!_currentUser || !_db || !task?.id) return;
  await _db
    .collection("users").doc(_currentUser.uid)
    .collection("tasks").doc(task.id)
    .set({
      ...task,
      updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Load all tasks for the current user.
 * @returns {Promise<object[]>}
 */
export async function loadTasks() {
  if (!_currentUser || !_db) return [];
  const snap = await _db
    .collection("users").doc(_currentUser.uid)
    .collection("tasks")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Delete a task from Firestore.
 * @param {string} taskId
 */
export async function deleteTask(taskId) {
  if (!_currentUser || !_db || !taskId) return;
  await _db
    .collection("users").doc(_currentUser.uid)
    .collection("tasks").doc(taskId)
    .delete();
}

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * Save a completed focus session to Firestore.
 * @param {object} session
 */
export async function saveSession(session) {
  if (!_currentUser || !_db || !session?.id) return;
  const ref = _db
    .collection("users").doc(_currentUser.uid)
    .collection("sessions").doc(session.id);
  await ref.set(session);
}

/**
 * Load recent sessions for the stats display.
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
export async function loadRecentSessions(limit = 20) {
  if (!_currentUser || !_db) return [];
  const snap = await _db
    .collection("users").doc(_currentUser.uid)
    .collection("sessions")
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── XP & Gamification sync ────────────────────────────────────────────────────

/**
 * Atomically increment XP and coins for the current user in Firestore.
 * @param {number} xp
 * @param {number} coins
 */
export async function addXpAndCoins(xp, coins) {
  if (!_currentUser || !_db) return;
  const ref = _db.collection("users").doc(_currentUser.uid);
  await ref.update({
    "gamification.xp": firebase.firestore.FieldValue.increment(xp),
    "gamification.coins": firebase.firestore.FieldValue.increment(coins),
    lastActiveDate: firebase.firestore.FieldValue.serverTimestamp()
  });
}
