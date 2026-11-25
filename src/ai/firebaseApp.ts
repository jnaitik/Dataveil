import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getRemoteConfig, type RemoteConfig } from 'firebase/remote-config';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider, type AppCheck } from 'firebase/app-check';

// Declare global window property for App Check debug token
declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your_api_key_here' &&
    firebaseConfig.projectId !== 'your_project_id'
  );
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let remoteConfigInstance: RemoteConfig | null = null;
let appCheckInstance: AppCheck | null = null;

if (isFirebaseConfigured()) {
  try {
    appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig as Record<string, string>);
    authInstance = getAuth(appInstance);
    firestoreInstance = getFirestore(appInstance);
    remoteConfigInstance = getRemoteConfig(appInstance);

    // Initialize App Check (required for Firebase AI Logic)
    if (typeof window !== 'undefined') {
      const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
      if (debugToken && debugToken !== 'your_appcheck_debug_token_here') {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
      } else if (import.meta.env.DEV) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      const recaptchaSiteKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;
      if (recaptchaSiteKey) {
        appCheckInstance = initializeAppCheck(appInstance, {
          provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } else if (window.FIREBASE_APPCHECK_DEBUG_TOKEN) {
        appCheckInstance = initializeAppCheck(appInstance, {
          provider: new CustomProvider({
            getToken: async () => ({
              token: String(window.FIREBASE_APPCHECK_DEBUG_TOKEN),
              expireTimeMillis: Date.now() + 60 * 60 * 1000,
            }),
          }),
          isTokenAutoRefreshEnabled: true,
        });
      }
    }
  } catch (err) {
    console.warn('[Firebase] Initialization notice:', err);
  }
}

export const app = appInstance;
export const auth = authInstance;
export const firestore = firestoreInstance;
export const remoteConfig = remoteConfigInstance;
export const appCheck = appCheckInstance;
export { signInAnonymously, onAuthStateChanged, type User };
