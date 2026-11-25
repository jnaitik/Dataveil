import { useState } from 'react';
import type { DatasetProfile } from '../../csv/profiler';
import { generateDefaultCharts, type DeterministicChartSpec } from '../../csv/chartSpecs';
import { buildAiPayload, type PayloadOptions } from '../../ai/payload';
import { routeInference } from '../../ai/router';
import { checkDeviceModelAvailability } from '../../ai/guard';
import { createModelInstance, InferenceMode } from '../../ai/aiClient';
import { extractJsonFromAiResponse, validateAndMaterializeChartProposals, type ProposedChartSpec } from '../../ai/schemas';
import { mapAIError, type DataveilError } from '../../ai/errors';
import { ChartCard } from '../../components/ChartCard';
import { SourceLabel, type InferenceSource } from '../../components/SourceLabel';
import { ConsentCard } from '../../components/ConsentCard';
import { PayloadPreview } from '../../components/PayloadPreview';
import type { InferenceLogEntry } from '../../components/UnderTheHood';

interface SuggestedChartsTabProps {
  profile: DatasetProfile;
  preferredMode: 'private' | 'auto';
  onLogUpdate: (entry: InferenceLogEntry) => void;
}

export function SuggestedChartsTab({ profile, preferredMode, onLogUpdate }: SuggestedChartsTabProps) {
  const [payloadOpts, setPayloadOpts] = useState<PayloadOptions>({
    includeTopValues: false,
    excludedColumns: [],
    excludePiiByDefault: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [charts, setCharts] = useState<DeterministicChartSpec[]>(generateDefaultCharts(profile));
  const [source, setSource] = useState<InferenceSource | 'DETERMINISTIC'>('DETERMINISTIC');
  const [errorState, setErrorState] = useState<DataveilError | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consentReason, setConsentReason] = useState('');

  const requestAiCharts = async (forceCloud = false) => {
    setIsLoading(true);
    setErrorState(null);
    setShowConsent(false);

    const payload = buildAiPayload(profile, payloadOpts);
    const prompt = `You are Dataveil AI. Based on the dataset summary below, propose up to 4 meaningful charts.
WHITELIST CONSTRAINTS:
- Allowed "type": "bar", "line", or "histogram"
- "xAxisColumn": exact column name from dataset
- "yAxisColumn": exact numeric column name (required for line, optional for bar)
- "aggregate": "count", "sum", or "mean"

OUTPUT FORMAT: Return ONLY valid JSON in this exact structure:
[
  {
    "title": "Chart Title",
    "description": "Short explanation",
    "type": "bar",
    "xAxisColumn": "ColumnName",
    "yAxisColumn": "NumericCol",
    "aggregate": "sum"
  }
]

${payload}`;

    const avail = await checkDeviceModelAvailability();
    const isDeviceAvailable = avail === 'available';

    const decision = routeInference({
      userSetting: preferredMode,
      payloadLength: prompt.length,
      hasCloudConsent: forceCloud,
      isDeviceModelAvailable: isDeviceAvailable,
    });

    if (decision.needsConsent && !forceCloud) {
      setIsLoading(false);
      setConsentReason(decision.reason);
      setShowConsent(true);
      return;
    }

    const startTime = performance.now();

    try {
      const model = createModelInstance({
        mode: decision.mode,
        systemInstruction: 'You are Dataveil AI. Return only strict JSON with chart proposals from the whitelist. Never invent column names.',
      });

      if (!model) {
        // Keep deterministic defaults
        setIsLoading(false);
        return;
      }

      const result = await model.generateContent(prompt);
      const latency = Math.round(performance.now() - startTime);
      const text = result.response.text();
      const realSource = (result.response as unknown as { inferenceSource?: InferenceSource }).inferenceSource || 'IN_CLOUD';

      const parsed = extractJsonFromAiResponse<ProposedChartSpec[]>(text);

      if (parsed && Array.isArray(parsed)) {
        const validated = validateAndMaterializeChartProposals(parsed, profile);
        if (validated.length > 0) {
          setCharts(validated);
          setSource(realSource);
        }
      }

      onLogUpdate({
        modeRequested: decision.mode,
        sourceReturned: realSource,
        latencyMs: latency,
        payloadChars: prompt.length,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      const mapped = mapAIError(err);
      setErrorState(mapped);
      // Fallback: Default deterministic charts remain active
      if (decision.mode === InferenceMode.ONLY_ON_DEVICE) {
        setConsentReason(`On-device model unavailable: ${mapped.message}`);
        setShowConsent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-left">
      <PayloadPreview profile={profile} options={payloadOpts} onOptionsChange={setPayloadOpts} />

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Suggested Charts</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            AI proposes chart configurations from a strict whitelist; code deterministically draws the charts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => requestAiCharts(false)}
          disabled={isLoading}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isLoading ? 'Analyzing Schema...' : 'Suggest AI Charts'}
        </button>
      </div>

      {showConsent && (
        <ConsentCard
          payloadPreview={buildAiPayload(profile, payloadOpts)}
          reason={consentReason}
          onConsent={() => requestAiCharts(true)}
          onCancel={() => setShowConsent(false)}
          isSubmitting={isLoading}
        />
      )}

      {errorState && !showConsent && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          Showing deterministic default charts ({errorState.message}).
        </div>
      )}

      {/* Render Materialized Charts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            {charts.length} Chart{charts.length !== 1 ? 's' : ''} Rendered
          </span>
          {source !== 'DETERMINISTIC' ? (
            <SourceLabel source={source} />
          ) : (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Deterministic Default (Zero AI)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {charts.map((spec) => (
            <ChartCard key={spec.id} spec={spec} />
          ))}
        </div>
      </div>
    </div>
  );
}
