import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { DeterministicChartSpec } from '../csv/chartSpecs';

interface ChartCardProps {
  spec: DeterministicChartSpec;
}

export function ChartCard({ spec }: ChartCardProps) {
  const isLine = spec.type === 'line';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
      <div className="mb-3 text-left">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800">{spec.title}</h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
            {spec.type}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{spec.description}</p>
      </div>

      <div className="w-full h-48 text-[11px]">
        <ResponsiveContainer width="100%" height="100%">
          {isLine ? (
            <LineChart data={spec.data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '11px',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0284c7"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0284c7' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <BarChart data={spec.data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="value" fill="#0284c7" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
