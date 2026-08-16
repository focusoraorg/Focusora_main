// login.js

// Reference to the Google login button
const googleBtn = document.querySelector('.google-login-btn');

googleBtn.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();

  // Sign in popup
  auth.signInWithPopup(provider)
    .then((result) => {
      // ✅ Successfully logged in
      console.log('User logged in:', result.user);
      
      // Redirect to dashboard after login
      window.location.href = "dashboard.html";
    })
    .catch((error) => {
      console.error('Error during login:', error.message);
      alert("Login failed. Please try again.");
    });
});