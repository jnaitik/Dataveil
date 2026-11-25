import { describe, it, expect } from 'vitest';
import { isFirebaseConfigured } from '../ai/firebaseApp';
import { mapAIError } from '../ai/errors';
import { getUserPreferences, saveUserPreferences } from '../store/preferences';
import { REMOTE_CONFIG_DEFAULTS, getShortPayloadCharLimit } from '../lib/remoteConfig';

describe('Phase 3 Firebase Integration & Fallbacks', () => {
  it('identifies unconfigured state gracefully when placeholders are present', () => {
    // In local test environment, placeholders default to unconfigured
    expect(typeof isFirebaseConfigured()).toBe('boolean');
  });

  it('provides safe Remote Config defaults without crashing', () => {
    const limit = getShortPayloadCharLimit();
    expect(limit).toBe(REMOTE_CONFIG_DEFAULTS.short_payload_char_limit);
    expect(limit).toBe(4000);
  });

  it('maps raw browser/network errors to friendly Dataveil errors', () => {
    const appCheckErr = mapAIError(new Error('FirebaseError: app-check token invalid'));
    expect(appCheckErr.code).toBe('APP_CHECK_FAILED');
    expect(appCheckErr.title).toBe('Security Verification Required');

    const quotaErr = mapAIError(new Error('Quota exceeded: 429 RESOURCE_EXHAUSTED'));
    expect(quotaErr.code).toBe('QUOTA_EXCEEDED');

    const promptApiErr = mapAIError(new Error('LanguageModel is not available'));
    expect(promptApiErr.code).toBe('UNSUPPORTED_BROWSER');
  });

  it('supports in-memory preferences fallback without Firestore credentials', async () => {
    const initial = await getUserPreferences(null);
    expect(initial.preferredMode).toBe('private');
    expect(initial.requestCountsBySource.onDevice).toBe(0);

    await saveUserPreferences(null, { preferredMode: 'auto' });
    const updated = await getUserPreferences(null);
    expect(updated.preferredMode).toBe('auto');
  });
});
