import { InferenceMode } from 'firebase/ai';
import { getShortPayloadCharLimit } from '../lib/remoteConfig';

export interface RouteDecision {
  mode: InferenceMode;
  needsConsent: boolean;
  reason: string;
}

export interface RouteOptions {
  userSetting: 'private' | 'auto';
  payloadLength: number;
  hasCloudConsent: boolean;
  isDeviceModelAvailable: boolean;
  developerForceCloud?: boolean;
}

export function routeInference(options: RouteOptions): RouteDecision {
  const {
    userSetting,
    payloadLength,
    hasCloudConsent,
    isDeviceModelAvailable,
    developerForceCloud,
  } = options;

  // Developer toggle (for testing only)
  if (developerForceCloud) {
    return {
      mode: InferenceMode.ONLY_IN_CLOUD,
      needsConsent: false,
      reason: 'Developer toggle: ONLY_IN_CLOUD forced for testing',
    };
  }

  const limit = getShortPayloadCharLimit();

  // 1. Private Mode (Strict default: NEVER send to cloud without explicit consent)
  if (userSetting === 'private') {
    if (!isDeviceModelAvailable) {
      if (hasCloudConsent) {
        return {
          mode: InferenceMode.PREFER_IN_CLOUD,
          needsConsent: false,
          reason: 'On-device unavailable; one-time cloud consent granted',
        };
      }
      return {
        mode: InferenceMode.ONLY_ON_DEVICE,
        needsConsent: true,
        reason: 'On-device model unavailable; consent required for cloud fallback',
      };
    }

    if (payloadLength > limit) {
      if (hasCloudConsent) {
        return {
          mode: InferenceMode.PREFER_IN_CLOUD,
          needsConsent: false,
          reason: 'Payload exceeds on-device budget; one-time cloud consent granted',
        };
      }
      return {
        mode: InferenceMode.ONLY_ON_DEVICE,
        needsConsent: true,
        reason: 'Payload exceeds on-device budget; consent required for cloud escalation',
      };
    }

    // Standard private execution
    return {
      mode: InferenceMode.ONLY_ON_DEVICE,
      needsConsent: false,
      reason: 'Private mode: Strict on-device execution',
    };
  }

  // 2. Auto Mode (Optional setting, off by default)
  if (payloadLength <= limit && isDeviceModelAvailable) {
    return {
      mode: InferenceMode.PREFER_ON_DEVICE,
      needsConsent: false,
      reason: 'Auto mode: Payload within local budget and device available',
    };
  }

  // If payload exceeds limit or device unavailable in Auto mode
  if (hasCloudConsent) {
    return {
      mode: InferenceMode.PREFER_IN_CLOUD,
      needsConsent: false,
      reason: 'Auto mode: Cloud execution with consent',
    };
  }

  return {
    mode: InferenceMode.PREFER_ON_DEVICE,
    needsConsent: true,
    reason: 'Auto mode: Threshold exceeded; cloud notification required',
  };
}
