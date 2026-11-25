import { useState } from 'react';
import { InferenceMode, createModelInstance } from '../../ai/aiClient';
import { routeInference } from '../../ai/router';
import { checkDeviceModelAvailability } from '../../ai/guard';
import { buildGateTestPrompt } from '../../ai/prompts';
import { mapAIError, type DataveilError } from '../../ai/errors';
import { SourceLabel, type InferenceSource } from '../../components/SourceLabel';
import { ConsentCard } from '../../components/ConsentCard';
import { type InferenceLogEntry } from '../../components/UnderTheHood';

interface GateTestHarnessProps {
  preferredMode: 'private' | 'auto';
  onLogUpdate: (entry: InferenceLogEntry) => void;
}

export function GateTestHarness({ preferredMode, onLogUpdate }: GateTestHarnessProps) {
  const [topic, setTopic] = useState('Amount column has positive numeric values with min=10, max=500, mean=125');
  const [isRunning, setIsRunning] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [responseSource, setResponseSource] = useState<InferenceSource | null>(null);
  const [errorState, setErrorState] = useState<DataveilError | null>(null);
  const [showConsentCard, setShowConsentCard] = useState(false);
  const [consentReason, setConsentReason] = useState<string>('');
  const [simulateUnavailable, setSimulateUnavailable] = useState(false);

  const executeInference = async (forceCloud = false) => {
    setIsRunning(true);
    setErrorState(null);
    setResponseOutput(null);
    setShowConsentCard(false);

    const startTime = performance.now();
    const promptText = buildGateTestPrompt(topic);

    // Check device availability unless simulated
    const avail = simulateUnavailable ? 'unavailable' : await checkDeviceModelAvailability();
    const isDeviceAvailable = avail === 'available';

    // Route decision
    const decision = routeInference({
      userSetting: preferredMode,
      payloadLength: promptText.length,
      hasCloudConsent: forceCloud,
      isDeviceModelAvailable: isDeviceAvailable,
    });

    if (decision.needsConsent && !forceCloud) {
      setIsRunning(false);
      setConsentReason(decision.reason);
      setShowConsentCard(true);
      return;
    }

    try {
      const model = createModelInstance({
        mode: decision.mode,
        systemInstruction: 'You are a private CSV assistant. Be concise. Do not invent numbers.',
      });

      if (!model) {
        // Fallback demo response if Firebase credentials are unconfigured
        const latency = Math.round(performance.now() - startTime);
        const demoSource: InferenceSource = decision.mode === InferenceMode.ONLY_ON_DEVICE ? 'ON_DEVICE' : 'IN_CLOUD';
        setResponseSource(demoSource);
        setResponseOutput(
          `[Demo Mode] A column with values between 10 and 500 (average 125) typically indicates standard consumer retail transactions or routine expenses with no extreme outliers.`
        );
        onLogUpdate({
          modeRequested: decision.mode,
          sourceReturned: demoSource,
          latencyMs: latency,
          payloadChars: promptText.length,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsRunning(false);
        return;
      }

      const result = await model.generateContent(promptText);
      const latency = Math.round(performance.now() - startTime);
      const text = result.response.text();
      // True provenance from SDK response
      const realSource = (result.response as unknown as { inferenceSource?: InferenceSource }).inferenceSource || 'IN_CLOUD';

      setResponseOutput(text);
      setResponseSource(realSource);

      onLogUpdate({
        modeRequested: decision.mode,
        sourceReturned: realSource,
        latencyMs: latency,
        payloadChars: promptText.length,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      const mapped = mapAIError(err);
      setErrorState(mapped);

      // If strict on-device failed and user is in Private mode, trigger consent card
      if (decision.mode === InferenceMode.ONLY_ON_DEVICE) {
        setConsentReason(`On-device model failed: ${mapped.message}`);
        setShowConsentCard(true);
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-left shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Phase 4 Verification Gate</h3>
          <p className="text-xs text-slate-500">Test on-device (Private) vs consent-gated cloud inference</p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          GATE 4
        </span>
      </div>

      {/* Input query */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Synthetic Summary Input:
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
          className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
          placeholder="Enter a column summary description..."
        />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => executeInference(false)}
          disabled={isRunning}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isRunning ? 'Processing...' : 'Run On-Device (Private Mode)'}
        </button>

        {/* Developer simulation toggle */}
        <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={simulateUnavailable}
            onChange={(e) => setSimulateUnavailable(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Simulate device unavailable</span>
        </label>
      </div>

      {/* Consent Card when triggered */}
      {showConsentCard && (
        <ConsentCard
          payloadPreview={buildGateTestPrompt(topic)}
          reason={consentReason}
          onConsent={() => executeInference(true)}
          onCancel={() => setShowConsentCard(false)}
          isSubmitting={isRunning}
        />
      )}

      {/* Error state */}
      {errorState && !showConsentCard && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
          <div className="font-semibold">{errorState.title}</div>
          <div>{errorState.message}</div>
          {errorState.actionableHint && (
            <div className="text-[11px] text-rose-600">{errorState.actionableHint}</div>
          )}
        </div>
      )}

      {/* Successful output with true source label */}
      {responseOutput && responseSource && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Response Output
            </span>
            <SourceLabel source={responseSource} />
          </div>
          <p className="text-xs text-slate-800 leading-relaxed font-sans">{responseOutput}</p>
        </div>
      )}
    </div>
  );
}
