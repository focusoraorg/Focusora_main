import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCsoscNqkeFe1D4FZTAcVsEGnUZBXnGV0Q",
  authDomain: "focusora-ca5a8.firebaseapp.com",
  projectId: "focusora-ca5a8",
  storageBucket: "focusora-ca5a8.firebasestorage.app",
  messagingSenderId: "29212107881",
  appId: "1:29212107881:web:f554b729212667d8a96ef8"
};

// Initialize Firebase once
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
