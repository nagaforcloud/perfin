import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Stat } from '@/components/ui/Stat';
import { DateRangeBar, RANGE_OPTIONS, rangeToParams, type RangeOption } from '@/components/ui/DateRangeBar';
import { SavingsLineChart } from '@/components/charts/SavingsLineChart';
import { useDashboard, useMonthly, useAnomalies, useRecurring } from '@/hooks/useAnalytics';
import { useTransactions } from '@/hooks/useTransactions';
import { useAppStore } from '@/store/useAppStore';
import type { Transaction } from '@/lib/types';
import { useNavigate } from 'react-router-dom';

function fmt(n: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function fmtSigned(n: number) { return (n >= 0 ? '+' : '−') + fmt(Math.abs(n)); }

function MiniSparkline({ data }: { data: any[] }) {
  const points = useMemo(() => {
    if (!data.length) return '';
    const vals = data.map((m: any) => m.net || 0);
    const max = Math.max(...vals.map(Math.abs), 1);
    const w = data.length * 16; const h = 40;
    return vals.map((v: number, i: number) => `${i * 16},${h / 2 - (v / max) * (h / 2 - 4)}`).join(' ');
  }, [data]);
  if (!points) return null;
  return (
    <svg width={data.length * 16} height="40" viewBox={`0 0 ${data.length * 16} 40`} className="w-full h-10">
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<RangeOption>(RANGE_OPTIONS[3]);
  const { selectedAccount } = useAppStore();
  const params = { ...rangeToParams(range), ...(selectedAccount ? { account: selectedAccount } : {}) };
  const { data: s, isLoading } = useDashboard(params);
  const { data: monthly = [] } = useMonthly(params);
  const { data: anomalies = [] } = useAnomalies(params);
  const { data: recurring = [] } = useRecurring(params);
  const { data: txns } = useTransactions({ page: 1, per_page: 8, account: selectedAccount || undefined });
  const navigate = useNavigate();
  const recent = txns?.transactions || [];

  if (isLoading) return <div className="space-y-4"><Skeleton.Chart /><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><Skeleton.KPI key={i}/>)}</div></div>;

  const net = s?.net_savings || 0; const positive = net >= 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <DateRangeBar value={range} onChange={setRange} />
      </div>

      {/* Row 1: Net Worth Hero + Income/Expense */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Net Worth</span>
            <div className={`text-4xl md:text-5xl font-bold tabular mt-1 ${positive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{fmtSigned(net)}</div>
            <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-[var(--radius-full)] text-xs font-medium ${positive ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
              <TrendingUp size={12} />{(s?.savings_rate || 0).toFixed(1)}% savings rate
            </span>
          </div>
          <MiniSparkline data={monthly} />
        </Card>
        <Card><Stat label="Income" value={fmt(s?.total_income || 0)} /></Card>
        <Card><Stat label="Expenses" value={fmt(s?.total_expenses || 0)} /></Card>
      </div>

      {/* Row 2: Chart (span 3) + Top Categories (span 1) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="md:col-span-3" title="Cash Flow"><SavingsLineChart data={monthly} height={260} /></Card>
        <Card title="Top Categories">
          <div className="space-y-2">
            {(() => {
              const m = new Map<string,number>();
              recent.forEach((t:Transaction) => { if(t.type==='expense'&&t.category)m.set(t.category,(m.get(t.category)||0)+Math.abs(t.amount)); });
              return Array.from(m).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,a],i)=>(<div key={i} className="flex justify-between text-sm"><span className="text-[var(--text-muted)] truncate">{c}</span><span className="tabular font-medium ml-2">{fmt(a)}</span></div>));
            })()}
            {recent.length===0 && <span className="text-sm text-[var(--text-muted)]">No data</span>}
          </div>
        </Card>
      </div>

      {/* Row 3: Recent Activity + Savings Rate */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="md:col-span-3" title="Recent Activity" kicker={`${recent.length} transactions`}>
          {recent.length===0 ? <div className="text-sm text-[var(--text-muted)] py-4">No recent transactions.</div> : (
            <div>
              {recent.map((txn:Transaction)=>(<div key={txn.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--surface-2)] -mx-2 px-2 rounded-[var(--radius-sm)] transition-colors" onClick={()=>navigate('/transactions')}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center ${txn.type==='income'?'bg-[var(--success-soft)]':'bg-[var(--danger-soft)]'}`}>{txn.type==='income'?<TrendingUp size={14} className="text-[var(--success)]"/>:<TrendingDown size={14} className="text-[var(--danger)]"/>}</div>
                  <div className="min-w-0"><div className="text-sm font-medium truncate">{txn.description}</div><div className="text-xs text-[var(--text-muted)]">{txn.date}{txn.category&&<Badge variant="neutral" className="ml-2">{txn.category}</Badge>}</div></div>
                </div>
                <span className={`text-sm font-semibold tabular ml-3 ${txn.type==='income'?'text-[var(--success)]':'text-[var(--danger)]'}`}>{txn.type==='expense'?'−':'+'}{fmt(Math.abs(txn.amount))}</span>
              </div>))}
            </div>
          )}
          <Button variant="ghost" size="sm" className="mt-3" onClick={()=>navigate('/transactions')}>View all <ArrowRight size={14}/></Button>
        </Card>
        <Card><Stat label="Savings Rate" value={(s?.savings_rate||0).toFixed(1)} format="percent" /><div className="mt-3"><Stat label="Transactions" value={(s?.transaction_count||0).toLocaleString()} /></div></Card>
      </div>

      {/* Row 4: Anomalies + Recurring */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Anomalies" kicker={`${anomalies.length} detected`}>
          {anomalies.length===0?<div className="text-sm text-[var(--text-muted)] py-4">No unusual activity.</div>:anomalies.slice(0,4).map((a:any,i:number)=>(<div key={i} className="flex items-center gap-2 py-2 border-b border-[var(--border)] last:border-0"><AlertTriangle size={14} className="text-[var(--warning)] shrink-0"/><span className="text-sm truncate">{a.description||a.transaction?.description}</span><Badge variant="warning" className="ml-auto shrink-0">{a.severity}</Badge></div>))}
        </Card>
        <Card title="Recurring Payments" kicker={`${recurring.length} subscriptions`}>
          {recurring.length===0?<div className="text-sm text-[var(--text-muted)] py-4">No subscriptions.</div>:recurring.slice(0,4).map((r:any,i:number)=>(<div key={i} className="flex justify-between py-2 border-b border-[var(--border)] last:border-0"><span className="text-sm flex items-center gap-2"><RefreshCw size={14} className="text-[var(--text-muted)]"/>{r.merchant}</span><span className="text-sm font-semibold text-[var(--danger)] tabular">{fmt(r.amount)}</span></div>))}
        </Card>
      </div>
    </div>
  );
}
