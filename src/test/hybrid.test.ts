import { describe, it, expect } from 'vitest';
import { routeInference } from '../ai/router';
import { InferenceMode } from 'firebase/ai';
import { checkDeviceModelAvailability } from '../ai/guard';

describe('Phase 4 Hybrid AI Router & Consent Verification', () => {
  it('routes strictly to ONLY_ON_DEVICE in Private mode when device is available', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 500,
      hasCloudConsent: false,
      isDeviceModelAvailable: true,
    });

    expect(decision.mode).toBe(InferenceMode.ONLY_ON_DEVICE);
    expect(decision.needsConsent).toBe(false);
  });

  it('demands consent in Private mode when on-device model is unavailable', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 500,
      hasCloudConsent: false,
      isDeviceModelAvailable: false,
    });

    expect(decision.needsConsent).toBe(true);
    expect(decision.reason).toContain('consent required');
  });

  it('routes to PREFER_IN_CLOUD only after user grants explicit consent', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 500,
      hasCloudConsent: true,
      isDeviceModelAvailable: false,
    });

    expect(decision.mode).toBe(InferenceMode.PREFER_IN_CLOUD);
    expect(decision.needsConsent).toBe(false);
  });

  it('demands consent in Private mode when payload exceeds threshold (4000 chars)', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 5000,
      hasCloudConsent: false,
      isDeviceModelAvailable: true,
    });

    expect(decision.needsConsent).toBe(true);
    expect(decision.reason).toContain('budget');
  });

  it('routes to ONLY_IN_CLOUD when developer force cloud toggle is active', () => {
    const decision = routeInference({
      userSetting: 'private',
      payloadLength: 100,
      hasCloudConsent: false,
      isDeviceModelAvailable: true,
      developerForceCloud: true,
    });

    expect(decision.mode).toBe(InferenceMode.ONLY_IN_CLOUD);
    expect(decision.needsConsent).toBe(false);
  });

  it('safely checks device model availability without throwing in test environment', async () => {
    const status = await checkDeviceModelAvailability();
    expect(typeof status).toBe('string');
    expect(['available', 'downloadable', 'downloading', 'unavailable', 'unsupported']).toContain(status);
  });
});
