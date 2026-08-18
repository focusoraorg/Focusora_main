// onboarding/onboarding.js
import FIREBASE_CONFIG from "../firebase/firebase-config.js";

let db = null;
let auth = null;
let currentUser = null;
let currentStep = 0;
const TOTAL_STEPS = 5; // 0..4

// ── Firebase ──────────────────────────────────────────────────────────────────

function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.warn("[Focusora] Firebase SDK not loaded — sign-in unavailable.");
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth();
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateAuthUI(user);
    });
  } catch (e) {
    console.warn("[Focusora Onboarding] Firebase not configured:", e.message);
    // Gracefully degrade — show error in the auth card
    const errorEl = document.getElementById("auth-error");
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = "Sign-in is not available in this build. You can skip and use Focusora locally.";
    }
    const googleBtn = document.getElementById("ob-google-btn");
    if (googleBtn) googleBtn.disabled = true;
  }
}

function updateAuthUI(user) {
  const out = document.getElementById("ob-signed-out");
  const inn = document.getElementById("ob-signed-in");
  if (!out || !inn) return;

  if (user) {
    out.classList.add("hidden");
    inn.classList.remove("hidden");
    document.getElementById("ob-user-name").textContent = `✓ Signed in as ${user.displayName || "you"}`;
    const emailEl = document.getElementById("ob-user-email");
    if (emailEl) emailEl.textContent = user.email || "";
  } else {
    out.classList.remove("hidden");
    inn.classList.add("hidden");
  }
}

// ── Step navigation ───────────────────────────────────────────────────────────

function goToStep(stepNum) {
  const current = document.getElementById(`step-${currentStep}`);
  if (current) {
    current.classList.add("hidden");
    current.classList.remove("active");
  }
  currentStep = stepNum;
  const next = document.getElementById(`step-${currentStep}`);
  if (next) {
    next.classList.remove("hidden");
    next.classList.add("active");
  }

  // Update dots
  document.querySelectorAll(".step-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === currentStep);
    dot.classList.toggle("done", i < currentStep);
  });
}

// ── Block list helpers ────────────────────────────────────────────────────────

function getSelectedBlockList() {
  const selected = [];
  document.querySelectorAll(".preset-chip.selected").forEach((chip) => {
    selected.push(chip.dataset.domain);
  });
  return selected;
}

// ── Notification permission ───────────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch (_) {
    return false;
  }
}

// ── Finish onboarding ─────────────────────────────────────────────────────────

async function finishOnboarding() {
  const selectedBlockList = getSelectedBlockList();
  const selectedRhythm = document.querySelector('input[name="rhythm"]:checked');
  const sessionMinutes = parseInt(selectedRhythm?.value || "25");
  const breakMinutes = sessionMinutes === 25 ? 5 : sessionMinutes === 50 ? 10 : 3;

  // Request notification permission
  const notifGranted = await requestNotificationPermission();

  const settings = {
    blockList: selectedBlockList,
    focusMinutes: sessionMinutes,
    shortBreakMinutes: breakMinutes,
    longBreakMinutes: sessionMinutes === 50 ? 15 : sessionMinutes === 25 ? 15 : 8,
    notificationsEnabled: notifGranted
  };

  const accountData = currentUser
    ? { signedIn: true, uid: currentUser.uid, email: currentUser.email, name: currentUser.displayName, plan: "free" }
    : { signedIn: false };

  chrome.runtime.sendMessage({
    type: "COMPLETE_ONBOARDING",
    settings,
    account: accountData
  });

  // Save to Firestore if signed in
  if (currentUser && db) {
    try {
      await db.collection("users").doc(currentUser.uid).set({
        displayName: currentUser.displayName,
        email: currentUser.email,
        settings,
        onboardingComplete: true,
        plan: "free",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("[Focusora] Firestore onboarding write error:", e);
    }
  }

  // Close this tab
  window.close();
}

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();

  // Step 0 — welcome
  document.getElementById("btn-step-0-next")?.addEventListener("click", () => goToStep(1));

  // Step 1 — auth
  document.getElementById("ob-google-btn")?.addEventListener("click", () => {
    if (!auth) return;
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        const errorEl = document.getElementById("auth-error");
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Sign-in failed: " + (chrome.runtime.lastError?.message || "No token received.");
        }
        return;
      }
      try {
        const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
        await auth.signInWithCredential(credential);
        // Auth state listener will update UI
      } catch (e) {
        console.error("[Focusora] Auth error:", e);
        const errorEl = document.getElementById("auth-error");
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Sign-in error: " + e.message;
        }
      }
    });
  });

  document.getElementById("btn-skip-auth")?.addEventListener("click", () => goToStep(2));
  document.getElementById("btn-step-1-next")?.addEventListener("click", () => goToStep(2));

  // Step 2 — block list
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => chip.classList.toggle("selected"));
  });

  document.getElementById("ob-add-custom-btn")?.addEventListener("click", () => {
    const input = document.getElementById("ob-custom-site");
    let domain = (input.value || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!domain) return;
    const existing = document.querySelector(`.preset-chip[data-domain="${domain}"]`);
    if (existing) {
      existing.classList.add("selected");
    } else {
      const chip = document.createElement("button");
      chip.className = "preset-chip selected";
      chip.dataset.domain = domain;
      chip.textContent = `🌐 ${domain}`;
      chip.addEventListener("click", () => chip.classList.toggle("selected"));
      document.querySelector(".preset-grid").appendChild(chip);
    }
    input.value = "";
  });

  document.getElementById("btn-step-2-back")?.addEventListener("click", () => goToStep(1));
  document.getElementById("btn-step-2-next")?.addEventListener("click", () => goToStep(3));

  // Step 3 — rhythm
  document.querySelectorAll(".rhythm-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".rhythm-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      const radio = opt.querySelector("input");
      if (radio) radio.checked = true;
    });
  });

  document.getElementById("btn-step-3-back")?.addEventListener("click", () => goToStep(2));
  document.getElementById("btn-step-3-next")?.addEventListener("click", () => goToStep(4));

  // Step 4 — notifications
  document.getElementById("btn-step-4-back")?.addEventListener("click", () => goToStep(3));
  document.getElementById("btn-step-4-finish")?.addEventListener("click", finishOnboarding);
});
