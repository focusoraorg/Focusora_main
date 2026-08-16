// Import Firebase SDK
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { app } from "./firebase-config.js"; // 🔑 your firebase config file

// Initialize
const auth = getAuth(app);
const db = getFirestore(app);

// Elements on your dashboard
const userNameEl = document.querySelector(".user-name");
const userPlanEl = document.querySelector(".user-plan");
const xpStatEl = document.getElementById("xp-earned-stat");
const streakEl = document.getElementById("user-level");
const focusTimeStatEl = document.getElementById("focus-time-stat");
const sessionsCompletedEl = document.getElementById("sessions-completed-stat");

// Check login state
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // redirect if not logged in
    window.location.href = "index.html";
    return;
  }

  console.log("User logged in:", user.uid);

  // Fetch user document
  const userDocRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userDocRef);

  if (userSnap.exists()) {
    const userData = userSnap.data();

    // Update dashboard with user data
    userNameEl.textContent = userData.name || user.displayName || "User";
    userPlanEl.textContent = userData.plan || "free";
    xpStatEl.textContent = `${userData.xp || 0} XP`;
    streakEl.textContent = `Streak: ${userData.streak || 0} days`;
  }

  // Fetch sessions subcollection
  const sessionsRef = collection(db, "users", user.uid, "sessions");
  const sessionsSnap = await getDocs(sessionsRef);

  let totalFocusTime = 0;
  let sessionsCount = 0;

  sessionsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.duration) {
      totalFocusTime += data.duration; // duration in seconds
      sessionsCount++;
    }
  });

  // Convert seconds → hours/minutes
  const hours = Math.floor(totalFocusTime / 3600);
  const minutes = Math.floor((totalFocusTime % 3600) / 60);

  focusTimeStatEl.textContent = `${hours}h ${minutes}m`;
  sessionsCompletedEl.textContent = sessionsCount;
});