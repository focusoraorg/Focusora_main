// utils/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// Firebase Firestore & Auth integration for the extension.
//
// Uses Firebase JS SDK via importScripts-compatible CDN builds.
// All calls are guarded by auth state — no writes happen when signed out.
//
// Data model:
//   users/{uid}                   → profile, settings, xp, coins, streak
//   users/{uid}/tasks/{taskId}    → individual tasks
//   users/{uid}/sessions/{id}     → completed focus sessions
// ─────────────────────────────────────────────────────────────────────────────

import FIREBASE_CONFIG from "../firebase/firebase-config.js";

// We use the Firebase compat SDK loaded via importScripts in background.js.
// In popup context, firebase is available from the CDN scripts loaded in popup.html.
// This module provides helper wrappers around those globals.

let _db = null;
let _auth = null;
let _currentUser = null;

/**
 * Initialize Firebase. Call once after CDN scripts are loaded.
 * Safe to call multiple times — only initializes once.
 */
export function initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = firebase.firestore();
    _auth = firebase.auth();

    _auth.onAuthStateChanged((user) => {
      _currentUser = user;
    });

    console.log("[Focusora Firebase] Initialized.");
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
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "Auth failed"));
        return;
      }
      try {
        const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
        const result = await _auth.signInWithCredential(credential);
        resolve(result.user);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Sign out from Firebase and revoke Chrome identity token.
 */
export async function signOut() {
  if (_auth) await _auth.signOut();
  chrome.identity.clearAllCachedAuthTokens(() => {});
}

// ── User Profile ──────────────────────────────────────────────────────────────

/**
 * Create or update the user document in Firestore.
 * @param {object} data - partial user profile fields
 */
export async function saveUserProfile(data) {
  if (!_currentUser || !_db) return;
  const ref = _db.collection("users").doc(_currentUser.uid);
  await ref.set(data, { merge: true });
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

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * Save a task to Firestore.
 * @param {object} task - { id, title, completed, createdAt }
 */
export async function saveTask(task) {
  if (!_currentUser || !_db) return;
  await _db
    .collection("users").doc(_currentUser.uid)
    .collection("tasks").doc(task.id)
    .set(task, { merge: true });
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
  if (!_currentUser || !_db) return;
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
  if (!_currentUser || !_db) return;
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
 * Atomically increment XP and coins for the current user.
 * @param {number} xp
 * @param {number} coins
 */
export async function addXpAndCoins(xp, coins) {
  if (!_currentUser || !_db) return;
  const ref = _db.collection("users").doc(_currentUser.uid);
  await ref.update({
    xp: firebase.firestore.FieldValue.increment(xp),
    coins: firebase.firestore.FieldValue.increment(coins),
    lastActiveDate: firebase.firestore.FieldValue.serverTimestamp()
  });
}
