import { useState } from 'react';
import type { DatasetProfile } from '../../csv/profiler';
import { validateOperation, executeOperation, type QueryOperation, type OperationResult } from '../../csv/operations';
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

  // Manual query builder state
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [manualType, setManualType] = useState<QueryOperation['type']>('count');
  const [manualTarget, setManualTarget] = useState<string>(profile.columns.find((c) => c.type === 'number')?.name || '');
  const [manualGroup, setManualGroup] = useState<string>(profile.columns.find((c) => c.type === 'text')?.name || '');
  const [manualAgg, setManualAgg] = useState<'count' | 'sum' | 'mean'>('count');

  const askAi = async (forceCloud = false) => {
    if (!question.trim()) return;

    setIsLoading(true);
    setErrorState(null);
    setShowConsent(false);
    setOperationResult(null);

    const payload = buildAiPayload(profile, payloadOpts);
    const prompt = `You are Dataveil AI. Map the user's natural language question into a single JSON query operation from the allowed whitelist.
NEVER PERFORM ARITHMETIC OR INVENT NUMBERS. Only output the JSON operation specification.

WHITELIST OPERATION FORMAT:
{
  "type": "count" | "sum" | "mean" | "min" | "max" | "groupBy",
  "targetColumn": "ExactNumericColumnName", (required for sum, mean, min, max; optional for groupBy)
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
      });

      if (!model) {
        // Fallback demo operation
        const numCol = profile.columns.find((c) => c.type === 'number')?.name;
        const demoOp: QueryOperation = numCol
          ? { type: 'sum', targetColumn: numCol }
          : { type: 'count' };

        const execRes = executeOperation(demoOp, profile, profile.previewRows);
        setMappedOp(demoOp);
        setOperationResult(execRes);
        setSource(decision.mode === InferenceMode.ONLY_ON_DEVICE ? 'ON_DEVICE' : 'IN_CLOUD');
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
    } catch (err) {
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

  const executeManualQuery = () => {
    const op: QueryOperation = {
      type: manualType,
      targetColumn: manualType === 'count' ? undefined : manualTarget,
      groupColumn: manualType === 'groupBy' ? manualGroup : undefined,
      aggregate: manualType === 'groupBy' ? manualAgg : undefined,
    };

    const validation = validateOperation(op, profile);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const execResult = executeOperation(op, profile, profile.previewRows);
    setMappedOp(op);
    setOperationResult(execResult);
    setSource(null);
  };

  const sampleQuestions = [
    `Count of records`,
    `Total of ${profile.columns.find((c) => c.type === 'number')?.name || 'value'}`,
    `Group by ${profile.columns.find((c) => c.type === 'text')?.name || 'category'}`,
  ];

  return (
    <div className="w-full space-y-6 text-left">
      <PayloadPreview profile={profile} options={payloadOpts} onOptionsChange={setPayloadOpts} />

      {/* Natural Language Ask Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Ask Your Data (AI Maps, Code Calculates)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Type any question. AI picks the operation from a strict whitelist; deterministic local code calculates the result.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAi(false)}
            placeholder='e.g., "What is the total revenue?" or "Count by category"'
            className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800"
          />
          <button
            type="button"
            onClick={() => askAi(false)}
            disabled={isLoading || !question.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer shrink-0"
          >
            {isLoading ? 'Executing...' : 'Ask'}
          </button>
        </div>

        {/* Suggestion pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-400">Try:</span>
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuestion(q);
              }}
              className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {showConsent && (
        <ConsentCard
          payloadPreview={buildAiPayload(profile, payloadOpts)}
          reason={consentReason}
          onConsent={() => askAi(true)}
          onCancel={() => setShowConsent(false)}
          isSubmitting={isLoading}
        />
      )}

      {errorState && !showConsent && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
          <div className="font-semibold">{errorState.title}</div>
          <div>{errorState.message}</div>
        </div>
      )}

      {/* Operation Execution Result */}
      {operationResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Executed Operation
              </span>
              <h4 className="text-sm font-bold text-slate-900">{operationResult.humanReadableQuery}</h4>
            </div>
            {source ? (
              <SourceLabel source={source} />
            ) : (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Manual Query Builder
              </span>
            )}
          </div>

          {operationResult.resultType === 'scalar' ? (
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Exact Result</span>
              <div className="text-4xl font-black text-slate-900 mt-1">
                {operationResult.scalarValue?.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
          {showManualBuilder ? 'Hide Manual Query Builder' : 'Prefer to build queries manually? Click here'}
        </button>

        {showManualBuilder && (
          <div className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-xs text-left space-y-4">
            <h4 className="text-xs font-bold text-slate-900">Deterministic Query Builder (Zero AI)</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Operation Type</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as QueryOperation['type'])}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
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
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
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
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Group By Column</label>
                    <select
                      value={manualGroup}
                      onChange={(e) => setManualGroup(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    >
                      {profile.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Aggregate</label>
                    <select
                      value={manualAgg}
                      onChange={(e) => setManualAgg(e.target.value as 'count' | 'sum' | 'mean')}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="mean">Mean</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={executeManualQuery}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Execute Query Locally
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
