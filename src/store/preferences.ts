import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '../ai/firebaseApp';

export interface UserPreferences {
  preferredMode: 'private' | 'auto';
  acceptedCloudNotice: boolean;
  requestCountsBySource: {
    onDevice: number;
    cloud: number;
  };
  updatedAt?: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  preferredMode: 'private',
  acceptedCloudNotice: false,
  requestCountsBySource: {
    onDevice: 0,
    cloud: 0,
  },
};

// In-memory fallback if Firestore is not configured or fails
let memoryPreferences: UserPreferences = { ...DEFAULT_PREFERENCES };

export async function getUserPreferences(uid?: string | null): Promise<UserPreferences> {
  if (!uid || !isFirebaseConfigured() || !firestore) {
    return memoryPreferences;
  }

  try {
    const userDocRef = doc(firestore, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserPreferences;
    }
    // Initialize default document
    await setDoc(userDocRef, {
      ...DEFAULT_PREFERENCES,
      updatedAt: new Date().toISOString(),
    });
    return DEFAULT_PREFERENCES;
  } catch (err) {
    console.warn('[Preferences] Using in-memory fallback:', err);
    return memoryPreferences;
  }
}

export async function saveUserPreferences(
  uid: string | null | undefined,
  prefs: Partial<UserPreferences>
): Promise<void> {
  memoryPreferences = { ...memoryPreferences, ...prefs };

  if (!uid || !isFirebaseConfigured() || !firestore) {
    return;
  }

  try {
    const userDocRef = doc(firestore, 'users', uid);
    await setDoc(
      userDocRef,
      {
        ...prefs,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Preferences] Save failed, saved to memory:', err);
  }
}

export async function recordInferenceCount(
  uid: string | null | undefined,
  source: 'ON_DEVICE' | 'IN_CLOUD'
): Promise<void> {
  if (source === 'ON_DEVICE') {
    memoryPreferences.requestCountsBySource.onDevice += 1;
  } else {
    memoryPreferences.requestCountsBySource.cloud += 1;
  }

  if (!uid || !isFirebaseConfigured() || !firestore) {
    return;
  }

  try {
    const userDocRef = doc(firestore, 'users', uid);
    const fieldPath = source === 'ON_DEVICE' ? 'requestCountsBySource.onDevice' : 'requestCountsBySource.cloud';
    await updateDoc(userDocRef, {
      [fieldPath]: increment(1),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Preferences] Could not increment remote counter:', err);
  }
}
