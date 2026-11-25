import type { DeterministicChartSpec, ChartType } from '../csv/chartSpecs';
import type { DatasetProfile } from '../csv/profiler';

export interface ProposedChartSpec {
  title: string;
  description: string;
  type: ChartType;
  xAxisColumn: string;
  yAxisColumn?: string;
  aggregate?: 'count' | 'sum' | 'mean';
}

/**
 * Validates and converts AI-proposed chart specs against real dataset schema.
 * Rejects invalid columns, illegal types, and drops malformed proposals.
 */
export function validateAndMaterializeChartProposals(
  proposals: ProposedChartSpec[],
  profile: DatasetProfile
): DeterministicChartSpec[] {
  const colMap = new Map(profile.columns.map((c) => [c.name.toLowerCase(), c]));
  const validSpecs: DeterministicChartSpec[] = [];

  for (let idx = 0; idx < proposals.length && validSpecs.length < 4; idx++) {
    const p = proposals[idx];
    if (!p.title || !p.type || !p.xAxisColumn) continue;

    const xCol = colMap.get(p.xAxisColumn.toLowerCase());
    if (!xCol) continue;

    // 1. Line chart: requires date/ordinal on X and numeric on Y
    if (p.type === 'line') {
      if (!p.yAxisColumn) continue;
      const yCol = colMap.get(p.yAxisColumn.toLowerCase());
      if (!yCol || yCol.type !== 'number') continue;

      const dataPoints = profile.previewRows
        .filter((r) => r[xCol.name] && !isNaN(Number(r[yCol.name])))
        .slice(0, 15)
        .map((r) => ({
          label: r[xCol.name],
          value: Number(r[yCol.name]),
        }));

      if (dataPoints.length > 1) {
        validSpecs.push({
          id: `ai-line-${idx}`,
          title: p.title,
          description: p.description || `${yCol.name} progression over ${xCol.name}`,
          type: 'line',
          xAxisLabel: xCol.name,
          yAxisLabel: yCol.name,
          data: dataPoints,
        });
      }
    }

    // 2. Bar chart: category on X vs count/sum/mean on Y
    if (p.type === 'bar') {
      const agg = p.aggregate || 'count';
      let yColName = 'Count';

      if (agg === 'sum' || agg === 'mean') {
        if (!p.yAxisColumn) continue;
        const yCol = colMap.get(p.yAxisColumn.toLowerCase());
        if (!yCol || yCol.type !== 'number') continue;
        yColName = yCol.name;
      }

      // Group locally
      const groups = new Map<string, number[]>();
      for (const r of profile.previewRows) {
        const cat = String(r[xCol.name] || 'Other').trim();
        if (!groups.has(cat)) groups.set(cat, []);
        if (agg === 'count') {
          groups.get(cat)!.push(1);
        } else if (p.yAxisColumn) {
          const num = Number(r[p.yAxisColumn]);
          if (!isNaN(num)) groups.get(cat)!.push(num);
        }
      }

      const dataPoints = Array.from(groups.entries())
        .map(([cat, vals]) => {
          let val = 0;
          if (agg === 'count') val = vals.length;
          else if (agg === 'sum') val = vals.reduce((a, b) => a + b, 0);
          else if (agg === 'mean') val = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          return { label: cat, value: Math.round(val * 100) / 100 };
        })
        .slice(0, 10);

      if (dataPoints.length > 1) {
        validSpecs.push({
          id: `ai-bar-${idx}`,
          title: p.title,
          description: p.description || `${agg.toUpperCase()} of ${yColName} by ${xCol.name}`,
          type: 'bar',
          xAxisLabel: xCol.name,
          yAxisLabel: yColName,
          data: dataPoints,
        });
      }
    }

    // 3. Histogram: single numeric column binned
    if (p.type === 'histogram') {
      if (xCol.type !== 'number') continue;
      const values = profile.previewRows
        .map((r) => Number(r[xCol.name]))
        .filter((n) => !isNaN(n));

      if (values.length > 2) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const bins = 5;
        const step = (max - min) / bins || 1;

        const dataPoints = [];
        for (let b = 0; b < bins; b++) {
          const bStart = Math.round(min + b * step);
          const bEnd = Math.round(min + (b + 1) * step);
          const count = values.filter((v) => (b === bins - 1 ? v >= bStart && v <= bEnd : v >= bStart && v < bEnd)).length;
          dataPoints.push({
            label: `${bStart}-${bEnd}`,
            value: count,
          });
        }

        validSpecs.push({
          id: `ai-hist-${idx}`,
          title: p.title,
          description: p.description || `Distribution of ${xCol.name}`,
          type: 'histogram',
          xAxisLabel: 'Range',
          yAxisLabel: 'Count',
          data: dataPoints,
        });
      }
    }
  }

  return validSpecs;
}

/**
 * Defensive JSON parser for AI outputs.
 * Extracts JSON blocks from markdown code blocks or raw text.
 */
export function extractJsonFromAiResponse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        // continue
      }
    }
  }
  return null;
}
