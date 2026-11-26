import { useState, useRef, useEffect } from 'react';
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
  const [cancelledNotice, setCancelledNotice] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'bar' | 'line' | 'histogram'>('all');

  // Reliability: Throttling & AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestTimeRef = useRef<number>(0);
  const [throttleNotice, setThrottleNotice] = useState(false);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCancelledNotice(true);
      setTimeout(() => setCancelledNotice(false), 3000);
    }
  };

  const requestAiCharts = async (forceCloud = false) => {
    const now = Date.now();
    if (now - lastRequestTimeRef.current < 2000 && !forceCloud) {
      setThrottleNotice(true);
      setTimeout(() => setThrottleNotice(false), 2000);
      return;
    }
    lastRequestTimeRef.current = now;

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setErrorState(null);
    setShowConsent(false);
    setCancelledNotice(false);

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
        systemInstruction: 'You are Dataveil AI. Propose charts strictly following the requested JSON whitelist format.',
        abortSignal: abortController.signal,
      });

      if (!model) {
        const latency = Math.round(performance.now() - startTime);
        const demoSource: InferenceSource = decision.mode === InferenceMode.ONLY_ON_DEVICE ? 'ON_DEVICE' : 'IN_CLOUD';
        const numCol = profile.columns.find((c) => c.type === 'number')?.name || 'Value';
        const catCol = profile.columns.find((c) => c.type === 'text')?.name || 'Category';

        const demoProposals: ProposedChartSpec[] = [
          {
            title: `${numCol} Distribution by ${catCol}`,
            description: `Aggregated total of ${numCol} across ${catCol} segments`,
            type: 'bar',
            xAxisColumn: catCol,
            yAxisColumn: numCol,
            aggregate: 'sum',
          },
          {
            title: `${numCol} Frequency Density`,
            description: `Histogram distribution of observed values for ${numCol}`,
            type: 'histogram',
            xAxisColumn: numCol,
          },
        ];

        const materialized = validateAndMaterializeChartProposals(demoProposals, profile);
        setCharts(materialized);
        setSource(demoSource);
        onLogUpdate({
          modeRequested: decision.mode,
          sourceReturned: demoSource,
          latencyMs: latency,
          payloadChars: prompt.length,
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsLoading(false);
        return;
      }

      const result = await model.generateContent(prompt);
      const latency = Math.round(performance.now() - startTime);
      const text = result.response.text();
      const realSource = (result.response as unknown as { inferenceSource?: InferenceSource }).inferenceSource || 'IN_CLOUD';

      const proposals = extractJsonFromAiResponse<ProposedChartSpec[]>(text);

      if (!proposals || !Array.isArray(proposals)) {
        throw new Error('AI output was not a valid chart recommendation JSON array.');
      }

      const materialized = validateAndMaterializeChartProposals(proposals, profile);

      if (materialized.length === 0) {
        throw new Error('None of the suggested charts matched the dataset schema columns.');
      }

      setCharts(materialized);
      setSource(realSource);

      onLogUpdate({
        modeRequested: decision.mode,
        sourceReturned: realSource,
        latencyMs: latency,
        payloadChars: prompt.length,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) {
        setCancelledNotice(true);
        return;
      }
      const mapped = mapAIError(err);
      setErrorState(mapped);
      if (decision.mode === InferenceMode.ONLY_ON_DEVICE) {
        setConsentReason(`On-device model failed: ${mapped.message}`);
        setShowConsent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCharts = charts.filter((c) => {
    if (filterType === 'all') return true;
    return c.type === filterType;
  });

  return (
    <div className="w-full space-y-6 text-left" role="tabpanel" aria-label="Suggested Charts Module">
      <PayloadPreview profile={profile} options={payloadOpts} onOptionsChange={setPayloadOpts} />

      {/* Control Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Suggested Charts</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200">
              Deterministic Recharts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gemini suggests chart dimensions from schema metadata; charts are rendered locally with zero AI arithmetic.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              ⏹ Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => requestAiCharts(false)}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {isLoading ? 'Synthesizing Ideas...' : 'Suggest AI Charts'}
          </button>
        </div>
      </div>

      {/* Throttling Notification */}
      {throttleNotice && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center animate-in fade-in duration-150">
          ⏳ Please wait a moment between chart requests.
        </div>
      )}

      {/* Cancelled Notification */}
      {cancelledNotice && (
        <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 text-center animate-in fade-in duration-150">
          Chart suggestion request was cancelled by user.
        </div>
      )}

      {/* Consent Card */}
      {showConsent && (
        <ConsentCard
          payloadPreview={buildAiPayload(profile, payloadOpts)}
          reason={consentReason}
          onConsent={() => requestAiCharts(true)}
          onCancel={() => setShowConsent(false)}
          isSubmitting={isLoading}
        />
      )}

      {/* Error Banner */}
      {errorState && !showConsent && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
          <div className="font-semibold">{errorState.title}</div>
          <div>{errorState.message}</div>
          {errorState.actionableHint && (
            <div className="text-[11px] text-rose-600">{errorState.actionableHint}</div>
          )}
        </div>
      )}

      {/* Active Source Banner & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-700">Displaying:</span>
          <span className="text-xs text-slate-500">{filteredCharts.length} Charts</span>
          <span className="text-slate-300">•</span>
          {source === 'DETERMINISTIC' ? (
            <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              Default Deterministic
            </span>
          ) : (
            <SourceLabel source={source} />
          )}
        </div>

        {/* Chart Filter Pills */}
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'bar', 'line', 'histogram'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer capitalize text-[11px] ${
                filterType === t
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6 h-80 space-y-4">
              <div className="h-4 bg-slate-200 rounded-md w-1/3" />
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
              <div className="h-56 bg-slate-50 rounded-2xl border border-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCharts.map((chart) => (
            <ChartCard key={chart.id} spec={chart} />
          ))}
        </div>
      )}
    </div>
  );
}
