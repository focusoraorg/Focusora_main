# Focusora Admin & Analytics Portal

An internal, founder-facing administration and analytics dashboard for the **Focusora** productivity platform. Built with **React 18**, **TypeScript**, and **Vite**, connecting in real-time to **Firebase Firestore** (`focusora-ca5a8`).

---

## 🚀 Key Capabilities

- **Platform Telemetry & KPI Overview**: Aggregates total registered users, focus hours logged, distraction attempts prevented, and tasks completed across all user documents in real-time.
- **Live User Directory**: Search, filter, and inspect user profiles, plan tiers, XP, level progression, and streaks.
- **Deep Activity Inspector**:
  - **`insights.dailyLog`**: Date-by-date breakdown of focus minutes, sessions, tasks completed, and distractions shielded.
  - **`settings.blockList`**: Active domain blocker list (e.g. `instagram.com`, `x.com`, `youtube.com`) and outside-focus enforcement status.
  - **`settings`**: User timer preferences, soundscape choice, and notification settings.
  - **`gamification`**: XP balance, coin balance, current/longest streaks, and unlocked achievement badges.
- **Subscriptions & Billing Ledger**: Live feed of active/refunded subscription records with status toggling.
- **B2B Campus Inquiries**: Manage inbound institutional pilot requests from universities and colleges.
- **CSV Data Exporter**: Instant 1-click CSV exports for users directory and transaction ledgers.

---

## 📁 Firestore Data Architecture

The Admin Portal binds directly to the production Focusora schema:

```
users/{uid}
├── uid: string
├── displayName: string ("Kapil Nath")
├── email: string
├── photoURL: string
├── plan: "free" | "pro_monthly" | "pro_yearly" | "institution"
├── lastLoginAt: timestamp
├── lastSyncedAt: timestamp
│
├── gamification: map
│   ├── xp: number (e.g. 65)
│   ├── coins: number (e.g. 13)
│   ├── level: number (e.g. 2)
│   ├── currentStreakDays: number (e.g. 2)
│   ├── longestStreakDays: number (e.g. 2)
│   ├── totalTasksCompleted: number (e.g. 1)
│   └── achievements: array
│
├── insights: map
│   └── dailyLog: map
│       └── {date}: map
│           ├── distractionAttempts: number
│           ├── focusMinutes: number
│           ├── sessionsCompleted: number
│           └── tasksCompleted: number
│
└── settings: map
    ├── allowList: array
    ├── blockList: array (e.g. [instagram.com, x.com, ...])
    ├── blockOutsideFocus: boolean
    ├── dailyGoalMinutes: number (e.g. 100)
    ├── focusMinutes: number (e.g. 25)
    ├── shortBreakMinutes: number
    ├── longBreakMinutes: number
    ├── soundscapeId: string
    └── soundscapeVolume: number
```

---

## 🔒 Firestore Security Rules

To allow authenticated administrators to stream collection-level metrics while keeping user data secure, configure your rules in **Firebase Console → Firestore Database → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User Documents: Each user can update their own data; authenticated users/admins can read
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Subscriptions collection
    match /subscriptions/{subId} {
      allow read, write: if request.auth != null;
    }
    
    // B2B Campus Inquiries
    match /b2b_inquiries/{inqId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

---

## 💻 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Build for Production
```bash
npm run build
```
Production assets are generated in the `dist/` directory.

---

## 🔑 Admin Credentials

| Field | Default Value |
| :--- | :--- |
| **Username / Email** | `admin@focusora.app` |
| **Password** | `admin123456` |
