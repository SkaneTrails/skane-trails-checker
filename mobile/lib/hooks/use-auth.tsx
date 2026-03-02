/**
 * Authentication hook for Firebase Auth with Google Sign-In.
 *
 * Uses Firebase signInWithPopup for web and expo-auth-session for native.
 * When Firebase is not configured (no env vars), provides a mock user
 * in __DEV__ mode so local development works without Firebase setup.
 */

import * as Google from 'expo-auth-session/providers/google';
import {
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { setAuthTokenGetter, setOnUnauthorized } from '../api/client';
import { auth, isFirebaseConfigured } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

const isAuthConfigured =
  isFirebaseConfigured &&
  Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  );

export const AuthProvider = ({ children }: AuthProviderProps) => {
  if (!isAuthConfigured) {
    const shouldUseMockUser = __DEV__;
    const mockUser = { email: 'dev@localhost' } as User;
    const authError = shouldUseMockUser
      ? null
      : 'Authentication is not configured. Please set Firebase and Google OAuth environment variables.';

    return (
      <AuthContext.Provider
        value={{
          user: shouldUseMockUser ? mockUser : null,
          loading: false,
          error: authError,
          signIn: async () => console.warn('Auth not configured — using dev mode'),
          signOut: async () => console.warn('Auth not configured — using dev mode'),
          getIdToken: async () => null,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return <AuthProviderImpl>{children}</AuthProviderImpl>;
};

const AuthProviderImpl = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handlingUnauthorizedRef = useRef(false);
  const userRef = useRef<User | null>(null);

  const googleProvider = Platform.OS === 'web' ? new GoogleAuthProvider() : null;

  const [_request, response, promptAsync] = Google.useAuthRequest(
    Platform.OS !== 'web'
      ? {
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
          androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
          responseType: 'id_token',
        }
      : {
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        },
  );

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const currentUser = userRef.current;
      if (!currentUser) return null;
      try {
        return await currentUser.getIdToken();
      } catch {
        return null;
      }
    });
  }, []);

  useEffect(() => {
    setOnUnauthorized((hadToken: boolean) => {
      if (!hadToken || handlingUnauthorizedRef.current) return;
      handlingUnauthorizedRef.current = true;

      firebaseSignOut(auth as NonNullable<typeof auth>).catch((err) => {
        if (__DEV__) {
          console.warn('Sign-out failed during unauthorized handling', err);
        }
      });

      setTimeout(() => {
        handlingUnauthorizedRef.current = false;
      }, 1000);
    });
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      userRef.current = firebaseUser;
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        handlingUnauthorizedRef.current = false;
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (response?.type === 'success') {
      const { id_token, access_token } = response.params;

      if (!id_token) {
        if (__DEV__) {
          console.error('No id_token in response. Received:', Object.keys(response.params));
        }
        setError('No ID token received from Google');
        return;
      }

      const credential = GoogleAuthProvider.credential(id_token, access_token);

      signInWithCredential(auth as NonNullable<typeof auth>, credential)
        .then(() => setError(null))
        .catch((err) => {
          if (__DEV__) {
            console.error('signInWithCredential error:', err);
          }
          setError('Sign-in failed. Please try again.');
        });
    } else if (response?.type === 'error') {
      setError(response.error?.message ?? 'Sign-in failed');
    }
  }, [response]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      if (Platform.OS === 'web' && googleProvider) {
        await signInWithPopup(auth as NonNullable<typeof auth>, googleProvider);
      } else {
        await promptAsync();
      }
    } catch (err) {
      if (__DEV__) {
        console.error('signIn error:', err);
      }
      const errorMessage = err instanceof Error ? err.message : '';
      if (!errorMessage.includes('popup-closed-by-user')) {
        setError('Sign-in failed. Please try again.');
      }
    }
  }, [promptAsync, googleProvider]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth as NonNullable<typeof auth>);
      setError(null);
    } catch (_err) {
      setError('Sign-out failed. Please try again.');
    }
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (err) {
      if (__DEV__) {
        console.error('Failed to get ID token:', err);
      }
      return null;
    }
  }, [user]);

  const contextValue = useMemo<AuthContextType>(
    () => ({ user, loading, error, signIn, signOut, getIdToken }),
    [user, loading, error, signIn, signOut, getIdToken],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
