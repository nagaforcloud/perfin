import { useState, useMemo } from 'react';
import { Search, Download, Edit2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTransactions, useCategories, useUpdateTransaction, useDeleteTransaction, useBulkDeleteTransactions } from '@/hooks/useTransactions';
import { useAppStore } from '@/store/useAppStore';
import type { Transaction } from '@/lib/types';

const PER_PAGE = 50;
function fmt(n: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function monthKey(d: string) { return new Date(d).toLocaleString('en-US', { month: 'long', year: 'numeric' }); }

export function TransactionsPage() {
  const { selectedAccount, showToast } = useAppStore();
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCat, setFilterCat] = useState(''); const [filterType, setFilterType] = useState<''|'income'|'expense'>('');
  const [editTxn, setEditTxn] = useState<Transaction|null>(null); const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  const { data: result, isLoading } = useTransactions({ page, per_page: PER_PAGE, account: selectedAccount||undefined, category: filterCat||undefined, type: filterType||undefined, search: debouncedSearch||undefined });
  const { data: categories = [] } = useCategories(); const updateMut = useUpdateTransaction(); const deleteMut = useDeleteTransaction(); const bulkMut = useBulkDeleteTransactions();
  const txns: Transaction[] = result?.transactions || []; const total = result?.total || 0; const pages = result?.pages || 1;
  const grouped = useMemo(() => { const m = new Map<string,Transaction[]>(); for(const t of txns){const k=monthKey(t.date);if(!m.has(k))m.set(k,[]);m.get(k)!.push(t);} return Array.from(m); }, [txns]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-semibold">{total} transactions</h2>
        <a href={`/api/transactions/export?format=csv${selectedAccount?`&account=${encodeURIComponent(selectedAccount)}`:''}`}><Button variant="secondary" size="sm"><Download size={14}/> Export</Button></a>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]" style={{maxWidth:320}}><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"/><Input style={{paddingLeft:34}} placeholder="Search..." value={search} onChange={e=>{setSearch(e.target.value);setTimeout(()=>setDebouncedSearch(e.target.value),300);setPage(1);}}/></div>
        <Select value={filterCat} onChange={e=>{setFilterCat(e.target.value);setPage(1);}} className="w-auto"><option value="">All categories</option>{categories.map((c:string)=><option key={c} value={c}>{c}</option>)}</Select>
        <div className="flex bg-[var(--surface-2)] rounded-[var(--radius-full)] p-0.5">
          {(['','income','expense']as const).map(t=>(<button key={t} onClick={()=>{setFilterType(t);setPage(1);}} className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-full)] transition-colors ${filterType===t?'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)]':'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>{t||'All'}</button>))}
        </div>
        {(filterCat||filterType||debouncedSearch)&&<Button variant="ghost" size="sm" onClick={()=>{setFilterCat('');setFilterType('');setSearch('');setDebouncedSearch('');}}><X size={14}/> Clear</Button>}
      </div>

      {isLoading ? <div className="space-y-1.5">{Array.from({length:10}).map((_,i)=><Skeleton.Row key={i}/>)}</div> : txns.length===0 ? <div className="text-center py-16 text-[var(--text-muted)]">No transactions found.</div> : (
        <div className="bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            {grouped.map(([month,rows])=>{const iAmt=rows.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);const eAmt=rows.filter(r=>r.type==='expense').reduce((s,r)=>s+Math.abs(r.amount),0);
              return (<div key={month}>
                <div className="flex items-center gap-3 px-4 py-2 bg-[var(--surface-2)]"><span className="text-xs font-medium text-[var(--text-muted)]">{month}</span><span className="text-xs text-[var(--text-subtle)]">{rows.length} entries</span><span className="flex-1"/><span className="text-xs tabular text-[var(--success)] font-medium">+{fmt(iAmt)}</span><span className="text-xs tabular text-[var(--danger)] font-medium">−{fmt(eAmt)}</span></div>
                <table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase tracking-wider"><th className="text-left p-3 font-medium w-10"><input type="checkbox"/></th><th className="text-left p-3 font-medium">Date</th><th className="text-left p-3 font-medium">Description</th><th className="text-left p-3 font-medium">Category</th><th className="text-right p-3 font-medium">Amount</th><th className="text-right p-3 font-medium w-16"/></tr></thead>
                <tbody>{rows.map((txn:Transaction)=>(<tr key={txn.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"><td className="p-3"><input type="checkbox" checked={selected.has(txn.id)} onChange={()=>setSelected(p=>{const s=new Set(p);s.has(txn.id)?s.delete(txn.id):s.add(txn.id);return s;})}/></td><td className="p-3 text-[var(--text-muted)] tabular text-xs">{txn.date}</td><td className="p-3 font-medium max-w-[280px] truncate">{txn.description}</td><td className="p-3">{txn.category?<Badge variant="neutral">{txn.category}</Badge>:<span className="text-xs text-[var(--text-subtle)]">—</span>}</td><td className={`p-3 text-right font-semibold tabular ${txn.type==='income'?'text-[var(--success)]':'text-[var(--danger)]'}`}>{txn.type==='expense'?'−':'+'}{fmt(Math.abs(txn.amount))}</td><td className="p-3"><div className="flex gap-1 justify-end"><button onClick={()=>{setEditTxn(txn);setEditForm({category:txn.category,notes:txn.notes});}} className="p-1.5 rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><Edit2 size={12}/></button><button onClick={async()=>{try{await deleteMut.mutateAsync(txn.id);showToast('Deleted','success');}catch(e:any){showToast(e.message,'error');}}} className="p-1.5 rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"><Trash2 size={12}/></button></div></td></tr>))}</tbody></table></div>);
            })}
          </div>
          {selected.size>0&&<div className="sticky bottom-0 flex items-center justify-between px-4 py-3 bg-[var(--surface)] border-t border-[var(--border)]"><span className="text-sm">{selected.size} selected</span><Button variant="danger" size="sm" onClick={async()=>{try{await bulkMut.mutateAsync(Array.from(selected));showToast(`Deleted ${selected.size}`,'success');setSelected(new Set());}catch(e:any){showToast(e.message,'error');}}}><Trash2 size={14}/> Delete</Button></div>}
        </div>
      )}

      {pages>1&&<div className="flex items-center justify-between mt-4"><span className="text-sm text-[var(--text-muted)]">Page {page} of {pages}</span><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Prev</Button><Button variant="secondary" size="sm" onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}>Next</Button></div></div>}

      {editTxn&&<Modal open onClose={()=>setEditTxn(null)} title="Edit Transaction" footer={<><Button variant="secondary" size="sm" onClick={()=>setEditTxn(null)}>Cancel</Button><Button variant="primary" size="sm" onClick={async()=>{try{await updateMut.mutateAsync({id:editTxn.id,data:editForm});showToast('Updated','success');setEditTxn(null);}catch(e:any){showToast(e.message,'error');}}}>Save</Button></>}><div className="space-y-3"><div><label className="text-sm font-medium text-[var(--text)] block mb-1">Category</label><Select value={editForm.category||''} onChange={e=>setEditForm(f=>({...f,category:e.target.value}))}><option value="">— Select —</option>{categories.map((c:string)=><option key={c} value={c}>{c}</option>)}</Select></div><div><label className="text-sm font-medium text-[var(--text)] block mb-1">Notes</label><Input value={editForm.notes||''} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div></div></Modal>}
    </div>
  );
}
