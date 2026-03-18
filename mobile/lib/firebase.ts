/**
 * Firebase SDK initialization.
 *
 * Only initializes when EXPO_PUBLIC_FIREBASE_API_KEY is set.
 * Without it, `isFirebaseConfigured` is false and the auth provider
 * falls back to a dev-mode mock user.
 */

import { type FirebaseApp, initializeApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
  GoogleAuthProvider,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const hasAllRequired = requiredFields.every((key) => Boolean(firebaseConfig[key]));

export const isFirebaseConfigured = hasAllRequired;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    } catch {
      // Already initialized (e.g. Fast Refresh) — reuse existing instance
      auth = getAuth(app);
    }
  }
  googleProvider = new GoogleAuthProvider();
}

export { app, auth, googleProvider };
