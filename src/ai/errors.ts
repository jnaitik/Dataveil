export type AIErrorCode =
  | 'CONFIG_MISSING'
  | 'UNSUPPORTED_BROWSER'
  | 'MODEL_DOWNLOAD_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'APP_CHECK_FAILED'
  | 'OFFLINE_NO_ON_DEVICE'
  | 'CONSENT_REQUIRED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_OUTPUT'
  | 'UNKNOWN';

export interface DataveilError {
  code: AIErrorCode;
  title: string;
  message: string;
  actionableHint?: string;
}

export function mapAIError(err: unknown): DataveilError {
  const rawMsg = err instanceof Error ? err.message : String(err);

  if (rawMsg.includes('app-check') || rawMsg.includes('AppCheck')) {
    return {
      code: 'APP_CHECK_FAILED',
      title: 'Security Verification Required',
      message: 'App Check verification was unable to validate the client request.',
      actionableHint: 'Check your App Check debug token in .env or reload the application.',
    };
  }

  if (rawMsg.includes('quota') || rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      code: 'QUOTA_EXCEEDED',
      title: 'Rate Limit Reached',
      message: 'The AI request limit was reached. Please wait a moment before trying again.',
      actionableHint: 'Wait 30-60 seconds before submitting another request.',
    };
  }

  if (rawMsg.includes('LanguageModel') || rawMsg.includes('not supported') || rawMsg.includes('availability')) {
    return {
      code: 'UNSUPPORTED_BROWSER',
      title: 'On-Device AI Unavailable',
      message: 'Your browser does not currently support or enable Chrome Gemini Nano on-device inference.',
      actionableHint: 'Open chrome://flags/#prompt-api-for-gemini-nano, enable it, and relaunch Chrome.',
    };
  }

  if (rawMsg.includes('download') || rawMsg.includes('downloadable')) {
    return {
      code: 'MODEL_DOWNLOAD_REQUIRED',
      title: 'Model Downloading',
      message: 'The on-device Gemini Nano model is being downloaded by Chrome.',
      actionableHint: 'Visit chrome://components to inspect "Optimization Guide On Device Model" progress.',
    };
  }

  if (!navigator.onLine && rawMsg.includes('network')) {
    return {
      code: 'OFFLINE_NO_ON_DEVICE',
      title: 'Offline and On-Device Unavailable',
      message: 'You are offline, and the local on-device model is not ready.',
      actionableHint: 'Connect to Wi-Fi to initialize or use deterministic data profile features offline.',
    };
  }

  return {
    code: 'UNKNOWN',
    title: 'Inference Interrupted',
    message: 'An unexpected issue occurred while processing the request.',
    actionableHint: 'Try refreshing or rephrasing your query.',
  };
}
