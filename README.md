# Focusora Chrome Extension

> Your supportive AI-powered focus companion. Protect your attention, complete meaningful work, build better habits.

---

## 🏗️ Project Structure

```
Focusora_main/
├── manifest.json              ← MV3 extension manifest
├── background.js              ← Service worker (timer, blocking, session logic)
├── content.js                 ← Focus badge injected into pages
│
├── popup/
│   ├── popup.html             ← Main popup (4 tabs: Focus, Tasks, Stats, Settings)
│   ├── popup.js               ← Popup controller (Firebase sync, UI)
│   └── popup.css              ← Premium dark design system
│
├── onboarding/
│   ├── onboarding.html        ← First-run wizard
│   ├── onboarding.js          ← Onboarding logic
│   └── onboarding.css         ← Onboarding styles
│
├── blocked/
│   ├── blocked.html           ← Custom redirect when a site is blocked
│   ├── blocked.js
│   └── blocked.css
│
├── firebase/
│   └── firebase-config.js     ← ⚠️  PASTE YOUR FIREBASE CONFIG HERE
│
├── utils/
│   ├── storage.js             ← chrome.storage wrapper
│   ├── timer.js               ← Pomodoro state machine
│   ├── blocker.js             ← Dynamic DNR rule management
│   ├── gamification.js        ← XP, coins, levels, streaks
│   ├── notifications.js       ← Chrome notifications
│   └── firebase.js            ← Firestore / Auth helpers
│
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔥 Firebase Setup (Do This First!)

### Step 1 — Create a Firebase Project

1. Go to **[https://console.firebase.google.com](https://console.firebase.google.com)**
2. Click **"Add project"**
3. Name it `focusora` (or anything you like)
4. Disable Google Analytics for now (you can add it later)
5. Click **"Create project"** and wait for it to finish

---

### Step 2 — Add a Web App

1. On your project homepage, click the **`</>`** (Web) icon
2. Register app name: `Focusora Extension`
3. **Don't** check "Firebase Hosting" for now
4. Click **"Register app"**
5. You'll see a code block like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "focusora-xxxxx.firebaseapp.com",
  projectId: "focusora-xxxxx",
  storageBucket: "focusora-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

6. **Copy all 6 values** and paste them into [`firebase/firebase-config.js`](firebase/firebase-config.js)

---

### Step 3 — Enable Google Sign-In

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Click **Google** → Enable → set **Project support email** → Save
3. Under **Authorized domains**, your extension's `chrome-extension://` ID will be added automatically when you test it

> **Note**: You'll need to add your extension ID to the authorized domains after loading it unpacked. The ID looks like `chrome-extension://abcdefghijklmnop`. Find it at `chrome://extensions` after loading.

---

### Step 4 — Create Firestore Database

1. In Firebase Console → **Firestore Database** → **Create database**
2. Choose **"Start in production mode"** (we'll set up rules)
3. Choose a region: **`asia-south1` (Mumbai)** — closest for India
4. Click **Enable**

---

### Step 5 — Set Firestore Security Rules

In Firestore → **Rules** tab, paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /tasks/{taskId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /sessions/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Click **Publish**.

---

### Step 6 — Enable chrome.identity OAuth (For Google Sign-In in Extension)

1. Go to **[Google Cloud Console](https://console.cloud.google.com)**
2. Select the same project Firebase created (same project ID)
3. Go to **APIs & Services → Credentials**
4. Find the OAuth 2.0 client that Firebase created (named "Web client")
5. Under **Authorized JavaScript origins**, add your extension origin:
   - Format: `chrome-extension://YOUR_EXTENSION_ID`
   - Find your extension ID at `chrome://extensions` after loading unpacked

---

## 🚀 Loading the Extension in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **"Load unpacked"**
4. Select the `Focusora_main` folder
5. The extension appears in your toolbar — click the puzzle icon 🧩 to pin it

> ⚠️ **Delete these old files first** (they're from the prototype and conflict with the new structure):
> - `popup.html` (root level — the new one is in `popup/popup.html`)
> - `popup.js` (root level)
> - `popup.css` (root level)
> - `rules.json` (root level — rules are now dynamic)

---

## 🗂️ What to Give Me (Firebase Config)

Once you complete steps above, paste your config into [`firebase/firebase-config.js`](firebase/firebase-config.js):

```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...your-key...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

That's the **only thing** you need to copy from Firebase.

---

## ⚙️ Extension Features

| Feature | Status |
|---|---|
| Pomodoro timer (alarm-based, survives popup close) | ✅ |
| Focus session state machine (IDLE→FOCUSING→BREAK) | ✅ |
| Dynamic site blocking (only during sessions) | ✅ |
| Custom block list (user editable) | ✅ |
| Custom blocked page (branded redirect) | ✅ |
| Distraction counter | ✅ |
| Task management (add, complete, delete) | ✅ |
| Task selection for sessions | ✅ |
| XP + Coins + Levels + Streaks | ✅ |
| Achievements | ✅ |
| Session history | ✅ |
| 4-tab popup (Focus / Tasks / Stats / Settings) | ✅ |
| First-run onboarding wizard | ✅ |
| Google Sign-In (via chrome.identity) | ✅ |
| Firestore sync (sessions, tasks, XP) | ✅ |
| Chrome notifications | ✅ |
| Focus badge on active pages | ✅ |
| Premium dark design system | ✅ |

---

## 🔒 Privacy

- Distraction blocking is **session-scoped only** — no always-on surveillance
- No browsing URLs are stored — only domain-level block counts
- Camera is never used (posture check is a future feature)
- All AI calls go through a server (future — not in extension v1)
- User data is stored in their own Firestore document — nobody else can read it

---

## 📋 Next Steps After Extension

1. **Firebase setup** → paste config → test sign-in
2. **Generate icons** → create 16/32/48/128px icons
3. **Test all flows** → onboarding → session → blocking → XP
4. **Web dashboard** → Next.js app reading from same Firestore
5. **Chrome Web Store** → listing, screenshots, privacy policy

---

*Focusora v1.0.0 — Built with 💜*
