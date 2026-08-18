// firebase/firebase-config.js
// ─────────────────────────────────────────────────────────────────────────────
// PASTE YOUR FIREBASE CONFIG BELOW.
// You get this from: Firebase Console → Project Settings → Your apps → SDK setup
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "focusora-ca5a8.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "focusora-ca5a8",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "focusora-ca5a8.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "29212107881",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:29212107881:web:f554b729212667d8a96ef8"
};

export default FIREBASE_CONFIG;
