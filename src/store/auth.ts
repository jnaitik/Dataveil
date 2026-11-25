import { useEffect, useState } from 'react';
import { auth, signInAnonymously, onAuthStateChanged, type User, isFirebaseConfigured } from '../ai/firebaseApp';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
}

export function useAnonymousAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentAuth = auth;
    if (!isFirebaseConfigured() || !currentAuth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      currentAuth,
      (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setLoading(false);
        } else {
          // Automatically trigger anonymous authentication
          signInAnonymously(currentAuth)
            .then((credential) => {
              setUser(credential.user);
              setLoading(false);
            })
            .catch((err) => {
              console.warn('[Auth] Anonymous sign-in failed:', err);
              setError(err instanceof Error ? err.message : 'Auth failed');
              setLoading(false);
            });
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    user,
    loading,
    error,
    isConfigured: isFirebaseConfigured(),
  };
}
