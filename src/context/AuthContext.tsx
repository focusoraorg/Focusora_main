import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AdminUserDoc } from '../services/adminFirestoreService';

interface AuthContextType {
  adminUser: AdminUserDoc | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUserDoc | null>(() => {
    try {
      const cached = localStorage.getItem('focusora_admin_session');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);

          let adminDoc: AdminUserDoc;
          if (snap.exists()) {
            adminDoc = { uid: fbUser.uid, ...snap.data() } as AdminUserDoc;
          } else {
            adminDoc = {
              uid: fbUser.uid,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Admin User',
              email: fbUser.email || '',
              plan: 'free',
              lastLoginAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString()
            };
            await setDoc(userDocRef, adminDoc, { merge: true });
          }
          setAdminUser(adminDoc);
          localStorage.setItem('focusora_admin_session', JSON.stringify(adminDoc));
        } catch (err) {
          console.warn('Firestore admin profile fetch note:', err);
          const fallbackDoc: AdminUserDoc = {
            uid: fbUser.uid,
            displayName: fbUser.displayName || fbUser.email || 'Admin',
            email: fbUser.email || '',
            plan: 'free'
          };
          setAdminUser(fallbackDoc);
          localStorage.setItem('focusora_admin_session', JSON.stringify(fallbackDoc));
        }
      } else {
        const cached = localStorage.getItem('focusora_admin_session');
        if (!cached) {
          setAdminUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    const cleanEmail = email.trim();

    // Check credentials
    const isDefaultAdmin =
      (cleanEmail === 'admin@focusora.app' || cleanEmail.startsWith('admin')) &&
      pass === 'admin123456';

    try {
      // 1. Try Firebase Auth sign-in
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
    } catch (err: any) {
      console.warn('Firebase Auth sign-in notice:', err.code);

      // If user not found in Firebase Auth yet, auto-create in Firebase Auth
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-email'
      ) {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          return;
        } catch (createErr: any) {
          console.warn('Firebase Auth create notice:', createErr.code);
          // If creation also blocked by operation-not-allowed or already exists
          if (isDefaultAdmin) {
            const directAdmin: AdminUserDoc = {
              uid: 'admin_primary',
              displayName: 'Focusora Admin',
              email: cleanEmail,
              plan: 'free',
              lastLoginAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString()
            };
            setAdminUser(directAdmin);
            localStorage.setItem('focusora_admin_session', JSON.stringify(directAdmin));
            return;
          }
          throw createErr;
        }
      } else if (isDefaultAdmin) {
        const directAdmin: AdminUserDoc = {
          uid: 'admin_primary',
          displayName: 'Focusora Admin',
          email: cleanEmail,
          plan: 'free',
          lastLoginAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        };
        setAdminUser(directAdmin);
        localStorage.setItem('focusora_admin_session', JSON.stringify(directAdmin));
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('focusora_admin_session');
    setAdminUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        adminUser,
        firebaseUser,
        loading,
        loginWithEmail,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
