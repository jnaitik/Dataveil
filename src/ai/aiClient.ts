import {
  getAI,
  GoogleAIBackend,
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
} from 'firebase/ai';
import { app, isFirebaseConfigured } from './firebaseApp';

export { InferenceMode, type GenerativeModel };

let aiInstance: ReturnType<typeof getAI> | null = null;

export function getAIService() {
  if (!isFirebaseConfigured() || !app) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = getAI(app, {
      backend: new GoogleAIBackend(),
    });
  }
  return aiInstance;
}

export interface ModelOptions {
  mode?: InferenceMode;
  inCloudModel?: string;
  systemInstruction?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export function createModelInstance(options: ModelOptions = {}): GenerativeModel | null {
  const ai = getAIService();
  if (!ai) {
    return null;
  }

  const {
    mode = InferenceMode.ONLY_ON_DEVICE,
    inCloudModel = 'gemini-3.5-flash-lite',
    systemInstruction,
    temperature = 0.2,
    abortSignal,
  } = options;

  return getGenerativeModel(ai, {
    mode,
    inCloudParams: {
      model: inCloudModel,
      generationConfig: {
        temperature,
      },
      systemInstruction: systemInstruction || undefined,
    },
    onDeviceParams: {
      createOptions: {
        signal: abortSignal,
        initialPrompts: systemInstruction
          ? [
              {
                role: 'system',
                content: [{ type: 'text', value: systemInstruction }],
              },
            ]
          : undefined,
      },
    },
  });
}
