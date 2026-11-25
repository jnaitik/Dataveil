export type DeviceModelAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unsupported';

export async function checkDeviceModelAvailability(): Promise<DeviceModelAvailability> {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  try {
    // 1. Direct Prompt API global
    const win = window as unknown as {
      LanguageModel?: {
        availability?: () => Promise<string>;
      };
      ai?: {
        languageModel?: {
          availability?: () => Promise<string>;
          capabilities?: () => Promise<{ available: string }>;
        };
      };
    };

    if (typeof win.LanguageModel?.availability === 'function') {
      const status = await win.LanguageModel.availability();
      return (status as DeviceModelAvailability) || 'unavailable';
    }

    // 2. window.ai.languageModel namespace
    if (typeof win.ai?.languageModel?.availability === 'function') {
      const status = await win.ai.languageModel.availability();
      return (status as DeviceModelAvailability) || 'unavailable';
    }

    if (typeof win.ai?.languageModel?.capabilities === 'function') {
      const caps = await win.ai.languageModel.capabilities();
      return (caps?.available as DeviceModelAvailability) || 'unavailable';
    }
  } catch (err) {
    console.warn('[Guard] Prompt API availability check warning:', err);
  }

  return 'unsupported';
}
