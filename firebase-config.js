// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD7i7trh0jlad9HrymtFaf52MgzDvSlPgc",
  authDomain: "focusora-9c626.firebaseapp.com",
  projectId: "focusora-9c626",
  storageBucket: "focusora-9c626.firebasestorage.app",
  messagingSenderId: "333021061664",
  appId: "1:333021061664:web:eb159249689285ff27d245",
  measurementId: "G-CXCC9BWY0M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);