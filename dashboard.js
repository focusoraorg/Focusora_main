// dashboard.js

auth.onAuthStateChanged((user) => {
  if (user) {
    // ✅ User is logged in
    document.getElementById('userName').textContent = user.displayName;
    document.getElementById('userEmail').textContent = user.email;
  } else {
    // ❌ No user → redirect back to login
    window.location.href = "login.html";
  }
});