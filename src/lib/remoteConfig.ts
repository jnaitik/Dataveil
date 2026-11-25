import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig, isFirebaseConfigured } from '../ai/firebaseApp';

export const REMOTE_CONFIG_DEFAULTS = {
  short_payload_char_limit: 4000,
  enable_auto_mode: false,
};

let initialized = false;

export async function initRemoteConfig(): Promise<void> {
  if (initialized || !isFirebaseConfigured() || !remoteConfig) {
    return;
  }

  try {
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour
    remoteConfig.defaultConfig = {
      short_payload_char_limit: REMOTE_CONFIG_DEFAULTS.short_payload_char_limit,
      enable_auto_mode: REMOTE_CONFIG_DEFAULTS.enable_auto_mode,
    };
    await fetchAndActivate(remoteConfig);
    initialized = true;
  } catch (err) {
    console.warn('[RemoteConfig] Default fallback active:', err);
  }
}

export function getShortPayloadCharLimit(): number {
  if (!isFirebaseConfigured() || !remoteConfig) {
    return REMOTE_CONFIG_DEFAULTS.short_payload_char_limit;
  }
  try {
    const val = getValue(remoteConfig, 'short_payload_char_limit').asNumber();
    return val > 0 ? val : REMOTE_CONFIG_DEFAULTS.short_payload_char_limit;
  } catch {
    return REMOTE_CONFIG_DEFAULTS.short_payload_char_limit;
  }
}
