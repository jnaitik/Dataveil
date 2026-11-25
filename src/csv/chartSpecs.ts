import type { DatasetProfile } from './profiler';

export type ChartType = 'bar' | 'line' | 'histogram';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface DeterministicChartSpec {
  id: string;
  title: string;
  description: string;
  type: ChartType;
  xAxisLabel: string;
  yAxisLabel: string;
  data: ChartDataPoint[];
}

export function generateDefaultCharts(profile: DatasetProfile): DeterministicChartSpec[] {
  const charts: DeterministicChartSpec[] = [];

  const dateCols = profile.columns.filter((c) => c.type === 'date');
  const numCols = profile.columns.filter((c) => c.type === 'number');
  const catCols = profile.columns.filter((c) => (c.type === 'text' || c.type === 'boolean') && (c.topCategories?.length || 0) > 1);

  // 1. Time-Series Line Chart (if date column exists + numeric column exists)
  if (dateCols.length > 0 && numCols.length > 0) {
    const dateCol = dateCols[0];
    const numCol = numCols[0];

    const dataPoints: ChartDataPoint[] = profile.previewRows
      .filter((r) => r[dateCol.name] && !isNaN(Number(r[numCol.name])))
      .slice(0, 15)
      .map((r) => ({
        label: r[dateCol.name],
        value: Number(r[numCol.name]),
      }));

    if (dataPoints.length > 2) {
      charts.push({
        id: 'time-series-default',
        title: `${numCol.name} Over Time`,
        description: `Temporal progression of ${numCol.name} grouped by ${dateCol.name}.`,
        type: 'line',
        xAxisLabel: dateCol.name,
        yAxisLabel: numCol.name,
        data: dataPoints,
      });
    }
  }

  // 2. Categorical Distribution Bar Chart (category column + top values)
  if (catCols.length > 0) {
    const catCol = catCols[0];
    const top = catCol.topCategories || [];

    if (top.length > 1) {
      charts.push({
        id: 'category-bar-default',
        title: `Distribution of ${catCol.name}`,
        description: `Frequency counts for the top occurrences in ${catCol.name}.`,
        type: 'bar',
        xAxisLabel: catCol.name,
        yAxisLabel: 'Record Count',
        data: top.map((t) => ({
          label: t.value,
          value: t.count,
        })),
      });
    }
  }

  // 3. Numeric Histogram / Distribution (for primary numeric column)
  if (numCols.length > 0 && charts.length < 3) {
    const numCol = numCols[numCols.length - 1];
    const values = profile.previewRows
      .map((r) => Number(r[numCol.name]))
      .filter((n) => !isNaN(n));

    if (values.length > 3) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const bins = 5;
      const binWidth = (max - min) / bins || 1;

      const histogramBins: ChartDataPoint[] = [];
      for (let i = 0; i < bins; i++) {
        const bStart = Math.round(min + i * binWidth);
        const bEnd = Math.round(min + (i + 1) * binWidth);
        const count = values.filter((v) => (i === bins - 1 ? v >= bStart && v <= bEnd : v >= bStart && v < bEnd)).length;
        histogramBins.push({
          label: `${bStart}-${bEnd}`,
          value: count,
        });
      }

      charts.push({
        id: 'histogram-default',
        title: `${numCol.name} Distribution`,
        description: `Binned frequency spread for ${numCol.name}.`,
        type: 'histogram',
        xAxisLabel: 'Value Range',
        yAxisLabel: 'Frequency',
        data: histogramBins,
      });
    }
  }

  return charts;
}
