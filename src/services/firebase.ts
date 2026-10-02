/* ============================================================
   CBT.AI — Firebase Authentication & Firestore Service
   Provides seamless Google Auth and cross-device user sync.
   ============================================================ */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Environment-driven client configuration with cbt-ai-53140 defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCIC6dJ7YCFkk05SiNy-tUrPFW7a63Qw4Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'cbt-ai-53140.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'cbt-ai-53140',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'cbt-ai-53140.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1095090260841',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1095090260841:web:aef75c3e6c9f57e525cbf8',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn('[CBT.AI] Firebase initialization error, falling back to local mode:', err);
  }
}

// ── Google Sign-In Provider ──
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<User | null> {
  if (!isFirebaseConfigured || !auth) {
    // Graceful local demo fallback if Firebase credentials are not yet configured
    const mockUser: User = {
      uid: 'demo_user_' + Math.random().toString(36).substring(2, 9),
      email: 'student@example.com',
      displayName: 'Demonstration Scholar',
      photoURL: '',
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'mock-token',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      providerId: 'google.com',
    };
    localStorage.setItem('cbtai_mock_auth_user', JSON.stringify(mockUser));
    return mockUser;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      return null;
    }
    console.error('[CBT.AI Auth Error]', error);
    throw new Error('We could not complete sign-in. Please try again.');
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured || !auth) {
    localStorage.removeItem('cbtai_mock_auth_user');
    return;
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error('[CBT.AI SignOut Error]', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured || !auth) {
    const saved = localStorage.getItem('cbtai_mock_auth_user');
    if (saved) {
      try {
        callback(JSON.parse(saved));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
    // Return unsubscribe no-op
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export { auth, db };
