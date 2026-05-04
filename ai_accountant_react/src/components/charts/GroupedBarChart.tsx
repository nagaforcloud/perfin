import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { MonthlyData } from '@/lib/types';
import { fmt } from '@/lib/utils';
import { GRID_COLOR, AXIS_COLOR, INCOME_COLOR, EXPENSE_COLOR } from './theme';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-2)', minWidth: 140 }}>
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-3 text-xs tabular"><span>{p.name}</span><span className="font-semibold">{fmt(p.value)}</span></div>
      ))}
    </div>
  );
}

export function GroupedBarChart({ data, height = 260 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={3} barCategoryGap="30%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="1 3" />
        <XAxis dataKey="month" tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[4,4,0,0]} />
        <Bar dataKey="expenses" name="Expenses" fill={EXPENSE_COLOR} radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface Props { data: MonthlyData[]; height?: number; }
