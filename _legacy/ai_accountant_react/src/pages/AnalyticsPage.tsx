import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { DateRangeBar, RANGE_OPTIONS, rangeToParams, type RangeOption } from '@/components/ui/DateRangeBar';
import { useCategories, useMerchants, useHealth } from '@/hooks/useAnalytics';
import { useAppStore } from '@/store/useAppStore';

function fmt(n:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);}

export function AnalyticsPage() {
  const [range,setRange]=useState<RangeOption>(RANGE_OPTIONS[3]);const{selectedAccount}=useAppStore();
  const params={...rangeToParams(range),...(selectedAccount?{account:selectedAccount}:{})};
  const{data:categories=[],isLoading}=useCategories(params);const{data:merchants=[]}=useMerchants({...params,top:10});const{data:health}=useHealth();
  const mx=Math.max(1,...categories.map((c:any)=>c.total_expenses||c.total_debits||0));

  return(<div>
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3"><h2 className="text-xl font-semibold">Analytics</h2><DateRangeBar value={range} onChange={setRange}/></div>
    {isLoading?<Skeleton.Chart/>:(
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><Card title="Category Breakdown"><div className="space-y-3">{categories.slice(0,12).map((c:any,i:number)=>{const a=c.total_expenses||c.total_debits||0;const p=(a/mx)*100;return(<div key={i} className="flex items-center gap-3"><span className="w-28 text-sm truncate">{c.category}</span><div className="flex-1 h-2.5 bg-[var(--surface-2)] rounded-[var(--radius-full)] overflow-hidden"><div className="h-full rounded-[var(--radius-full)] bg-[var(--primary)] transition-all duration-500" style={{width:`${p}%`}}/></div><span className="w-24 text-sm tabular text-right text-[var(--text-muted)]">{fmt(a)}</span></div>)})}{categories.length===0&&<div className="text-sm text-[var(--text-muted)]">No data.</div>}</div></Card></div>
        <div className="space-y-5">
          <Card title="Top Merchants">{merchants.length===0?<div className="text-sm text-[var(--text-muted)]">No data.</div>:merchants.slice(0,8).map((m:any,i:number)=>(<div key={i} className="flex justify-between py-1.5 border-b border-[var(--border)] last:border-0"><span className="text-sm">{m.merchant}</span><span className="text-sm tabular text-[var(--text-muted)]">{fmt(m.total||0)}</span></div>))}</Card>
          {health&&<Card title="Financial Health"><div className="flex items-center gap-6"><div className="text-5xl font-bold tabular text-[var(--primary)]">{health.total_score}</div><div><div className="text-sm text-[var(--text-muted)]">out of {health.max_score}</div><div className="text-base font-medium mt-1">{health.rating}</div></div></div></Card>}
        </div>
      </div>
    )}
  </div>);
}
