import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { MonthlyData } from '@/lib/types';
import { fmt } from '@/lib/utils';
import { GRID_COLOR, AXIS_COLOR, ACCENT_COLOR } from './theme';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value as number;
  const positive = value >= 0;
  return (
    <div className="px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)' }}>
      <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="text-xs" style={{ color: positive ? 'var(--success)' : 'var(--danger)' }}>{positive ? 'Net gain' : 'Net loss'}</div>
      <div className="text-sm font-semibold tabular" style={{ color: positive ? 'var(--success)' : 'var(--danger)' }}>{fmt(value)}</div>
    </div>
  );
}

export function SavingsLineChart({ data, height = 220 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity={0.2} />
            <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="1 3" />
        <XAxis dataKey="month" tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke={GRID_COLOR} strokeWidth={1} />
        <Area type="monotone" dataKey="net" name="Net" stroke={ACCENT_COLOR} strokeWidth={2} fill="url(#savingsFill)" dot={{ r: 2.5, fill: 'var(--surface)', stroke: ACCENT_COLOR, strokeWidth: 1.5 }} activeDot={{ r: 4.5, fill: ACCENT_COLOR, stroke: 'var(--border)', strokeWidth: 1 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface Props { data: MonthlyData[]; height?: number; }
