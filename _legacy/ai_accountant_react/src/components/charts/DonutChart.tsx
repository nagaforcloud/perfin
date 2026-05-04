import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt } from '@/lib/utils';
import { color } from './theme';

interface DataItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: DataItem[];
  size?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-xs"
      style={{
        background: '#F2E9D8',
        border: '1px solid #1A1814',
        boxShadow: '3px 3px 0 0 #1A1814',
      }}
    >
      <div
        className="smallcaps"
        style={{ fontSize: 9, color: payload[0].payload.fill, letterSpacing: '0.15em' }}
      >
        {payload[0].name}
      </div>
      <div className="fin" style={{ fontSize: 13, fontWeight: 600, color: '#1A1814', marginTop: 2 }}>
        {fmt(payload[0].value)}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 200 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const top = [...data].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="flex gap-6 items-center flex-wrap">
      <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="88%"
              dataKey="value"
              nameKey="label"
              strokeWidth={1.5}
              stroke="#F2E9D8"
            >
              {data.map((d, i) => (
                <Cell key={d.label} fill={d.color || color(i)} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <div
            className="smallcaps"
            style={{ fontSize: 8, color: '#7A6B58', letterSpacing: '0.22em' }}
          >
            Total
          </div>
          <div
            className="font-display"
            style={{ fontSize: 18, fontWeight: 700, color: '#1A1814', lineHeight: 1 }}
          >
            {fmt(total)}
          </div>
          {top && (
            <div
              className="font-serif italic mt-1"
              style={{ fontSize: 10, color: '#7A6B58' }}
            >
              {top.label}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {data.map((d, i) => {
          const c = d.color || color(i);
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
          return (
            <div key={d.label} className="flex items-center gap-2.5 text-xs group">
              <span
                className="w-2.5 h-2.5 shrink-0"
                style={{ background: c, border: '1px solid rgba(26,24,20,0.4)' }}
              />
              <span className="truncate flex-1" style={{ color: '#3E342A', fontSize: 12 }}>{d.label}</span>
              <span className="fin shrink-0" style={{ color: '#1A1814', fontWeight: 600 }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
