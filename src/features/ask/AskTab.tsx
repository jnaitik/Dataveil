import { useState, useRef, useEffect } from 'react';
import type { DatasetProfile } from '../../csv/profiler';
import { executeOperation, validateOperation, type QueryOperation, type OperationResult } from '../../csv/operations';
import { buildAiPayload, type PayloadOptions } from '../../ai/payload';
import { routeInference } from '../../ai/router';
import { checkDeviceModelAvailability } from '../../ai/guard';
import { createModelInstance, InferenceMode } from '../../ai/aiClient';
import { extractJsonFromAiResponse } from '../../ai/schemas';
import { mapAIError, type DataveilError } from '../../ai/errors';
import { SourceLabel, type InferenceSource } from '../../components/SourceLabel';
import { ConsentCard } from '../../components/ConsentCard';
import { PayloadPreview } from '../../components/PayloadPreview';
import type { InferenceLogEntry } from '../../components/UnderTheHood';

interface AskTabProps {
  profile: DatasetProfile;
  preferredMode: 'private' | 'auto';
  onLogUpdate: (entry: InferenceLogEntry) => void;
}

export function AskTab({ profile, preferredMode, onLogUpdate }: AskTabProps) {
  const [payloadOpts, setPayloadOpts] = useState<PayloadOptions>({
    includeTopValues: false,
    excludedColumns: [],
    excludePiiByDefault: true,
  });

  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const [mappedOp, setMappedOp] = useState<QueryOperation | null>(null);
  const [source, setSource] = useState<InferenceSource | null>(null);
  const [errorState, setErrorState] = useState<DataveilError | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consentReason, setConsentReason] = useState('');
  const [copiedResult, setCopiedResult] = useState(false);
  const [cancelledNotice, setCancelledNotice] = useState(false);

  // Manual query builder toggle
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualType, setManualType] = useState<QueryOperation['type']>('count');
  const [manualTarget, setManualTarget] = useState<string>(
    profile.columns.find((c) => c.type === 'number')?.name || ''
  );
  const [manualGroup, setManualGroup] = useState<string>(
    profile.columns.find((c) => c.type === 'text')?.name || ''
  );

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

  const handleCopyResult = () => {
    if (!operationResult) return;
    let text = `${operationResult.humanReadableQuery}\n`;
    if (operationResult.resultType === 'scalar') {
      text += `Exact Result: ${operationResult.scalarValue}`;
    } else if (operationResult.tableData) {
      text += operationResult.tableData.map((r) => `${r.group}: ${r.value}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const askAi = async (forceCloud = false) => {
    if (!question.trim()) return;

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
    const prompt = `You are Dataveil AI. Map the user's question into a strictly formatted JSON QueryOperation.
DO NOT CALCULATE ANY NUMBERS. DO NOT RETURN ARITHMETIC. Only return the JSON query specification.

ALLOWED TYPES:
- "count": Count rows matching optional filter
- "sum": Sum a numeric column
- "mean": Average of a numeric column
- "min": Minimum of a numeric column
- "max": Maximum of a numeric column
- "groupBy": Group by a category column and aggregate a numeric column

JSON FORMAT:
{
  "type": "count" | "sum" | "mean" | "min" | "max" | "groupBy",
  "targetColumn": "ExactColumnName", (required for sum, mean, min, max, and groupBy with sum/mean)
  "groupColumn": "ExactColumnName", (required for groupBy)
  "aggregate": "count" | "sum" | "mean", (for groupBy)
  "filter": { "column": "ColName", "value": "val" } (optional)
}

USER QUESTION: "${question}"

${payload}

OUTPUT FORMAT: Return ONLY the JSON object. No explanation.`;

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
        systemInstruction: 'You are Dataveil AI. Map queries strictly to whitelist JSON operations. Never invent numbers.',
        abortSignal: abortController.signal,
      });

      if (!model) {
        const latency = Math.round(performance.now() - startTime);
        const demoSource: InferenceSource = decision.mode === InferenceMode.ONLY_ON_DEVICE ? 'ON_DEVICE' : 'IN_CLOUD';
        const numCol = profile.columns.find((c) => c.type === 'number')?.name;
        const demoOp: QueryOperation = numCol
          ? { type: 'sum', targetColumn: numCol }
          : { type: 'count' };

        const execRes = executeOperation(demoOp, profile, profile.previewRows);
        setMappedOp(demoOp);
        setOperationResult(execRes);
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

      const op = extractJsonFromAiResponse<QueryOperation>(text);

      if (!op) {
        throw new Error('Could not parse operation from AI output. Use the manual query builder below.');
      }

      const validation = validateOperation(op, profile);
      if (!validation.valid) {
        throw new Error(`AI generated an invalid operation: ${validation.error}`);
      }

      // Execute locally and deterministically
      const execResult = executeOperation(op, profile, profile.previewRows);
      setMappedOp(op);
      setOperationResult(execResult);
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
        setConsentReason(`On-device query mapper failed: ${mapped.message}`);
        setShowConsent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRun = () => {
    const op: QueryOperation = {
      type: manualType,
      targetColumn: manualTarget,
      groupColumn: manualGroup,
      aggregate: 'sum',
    };
    const res = executeOperation(op, profile, profile.previewRows);
    setMappedOp(op);
    setOperationResult(res);
    setSource(null);
  };

  const numCols = profile.columns.filter((c) => c.type === 'number').map((c) => c.name);
  const catCols = profile.columns.filter((c) => c.type === 'text' || c.type === 'boolean').map((c) => c.name);

  const sampleQuestions: string[] = ['Count of records'];
  if (numCols.length > 0) {
    sampleQuestions.push(`What is the average ${numCols[0]}?`);
    sampleQuestions.push(`What is the total ${numCols[0]}?`);
    if (numCols.length > 1) {
      sampleQuestions.push(`What is the highest ${numCols[1]}?`);
    }
  }
  if (catCols.length > 0) {
    sampleQuestions.push(`Count of records by ${catCols[0]}`);
    if (numCols.length > 0) {
      sampleQuestions.push(`Total ${numCols[0]} grouped by ${catCols[0]}`);
    }
  }

  return (
    <div className="w-full space-y-6 text-left" role="tabpanel" aria-label="Ask Questions Module">
      <PayloadPreview profile={profile} options={payloadOpts} onOptionsChange={setPayloadOpts} />

      {/* Natural Language Query Input Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Ask Your Data (AI Maps, Code Calculates)</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200">
              Zero AI Arithmetic
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gemini translates your question into a deterministic operation. The calculation runs 100% locally in your browser.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && askAi(false)}
            placeholder='e.g., "What is the total revenue?" or "Average profit"'
            className="flex-1 text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-800"
          />

          <div className="flex items-center gap-2">
            {isLoading && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                ⏹ Cancel
              </button>
            )}

            <button
              type="button"
              onClick={() => askAi(false)}
              disabled={isLoading || !question.trim()}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {isLoading ? 'Translating...' : 'Ask'}
            </button>
          </div>
        </div>

        {/* Suggestion pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-400">Quick ideas:</span>
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuestion(q);
              }}
              className="px-2.5 py-1 rounded-full text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Throttling Notification */}
      {throttleNotice && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center animate-in fade-in duration-150">
          ⏳ Please wait a moment between queries.
        </div>
      )}

      {/* Cancelled Notification */}
      {cancelledNotice && (
        <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 text-center animate-in fade-in duration-150">
          Query translation was cancelled by user.
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded-md w-1/4" />
          <div className="h-16 bg-slate-50 rounded-2xl border border-slate-100" />
        </div>
      )}

      {/* Consent Card */}
      {showConsent && (
        <ConsentCard
          payloadPreview={buildAiPayload(profile, payloadOpts)}
          reason={consentReason}
          onConsent={() => askAi(true)}
          onCancel={() => setShowConsent(false)}
          isSubmitting={isLoading}
        />
      )}

      {/* Error state */}
      {errorState && !showConsent && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
          <div className="font-semibold">{errorState.title}</div>
          <div>{errorState.message}</div>
        </div>
      )}

      {/* Operation Execution Result */}
      {operationResult && !isLoading && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Executed Operation
              </span>
              <h4 className="text-sm font-bold text-slate-900">{operationResult.humanReadableQuery}</h4>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyResult}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                title="Copy result"
              >
                {copiedResult ? '✓ Copied!' : '📋 Copy'}
              </button>
              {source ? (
                <SourceLabel source={source} />
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Manual Query
                </span>
              )}
            </div>
          </div>

          {operationResult.resultType === 'scalar' ? (
            <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Exact Result</span>
              <div className="text-4xl font-black text-slate-900 mt-1">
                {operationResult.scalarValue?.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">{mappedOp?.groupColumn || 'Group'}</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {operationResult.tableData?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{row.group}</td>
                      <td className="py-2.5 px-4 text-right text-slate-700">{row.value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Query Builder Fallback Toggle */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setShowManualBuilder(!showManualBuilder)}
          className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
        >
          {showManualBuilder ? 'Hide Manual Query Builder' : 'Prefer to build queries manually without AI? Click here'}
        </button>

        {showManualBuilder && (
          <div className="mt-4 p-5 bg-white border border-slate-200 rounded-3xl shadow-xs text-left space-y-4">
            <h4 className="text-xs font-bold text-slate-900">Deterministic Query Builder (Zero AI)</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Operation Type</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as QueryOperation['type'])}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                >
                  <option value="count">Count Rows</option>
                  <option value="sum">Sum</option>
                  <option value="mean">Average (Mean)</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                  <option value="groupBy">Group By</option>
                </select>
              </div>

              {manualType !== 'count' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Numeric Target Column</label>
                  <select
                    value={manualTarget}
                    onChange={(e) => setManualTarget(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                  >
                    {profile.columns
                      .filter((c) => c.type === 'number')
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {manualType === 'groupBy' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Group By Column</label>
                  <select
                    value={manualGroup}
                    onChange={(e) => setManualGroup(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                  >
                    {profile.columns
                      .filter((c) => c.type === 'text')
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleManualRun}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Execute Manual Query
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
