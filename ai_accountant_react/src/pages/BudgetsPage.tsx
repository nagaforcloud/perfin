import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Budgets, Transactions } from '@/api/client';
import { useAppStore } from '@/store/useAppStore';

function fmt(n:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);}

export function BudgetsPage() {
  const{selectedAccount,showToast}=useAppStore();const qc=useQueryClient();const[showModal,setShowModal]=useState(false);const[form,setForm]=useState({category:'',amount:''});
  const{data:budgets=[],isLoading}=useQuery({queryKey:['budgets',selectedAccount],queryFn:()=>Budgets.list(selectedAccount||undefined)});
  const{data:categories=[]}=useQuery({queryKey:['categories'],queryFn:Transactions.categories});
  const{data:status=[]}=useQuery<Array<{category:string;budget:number;spent:number}>>({queryKey:['budgets','status',selectedAccount],queryFn:async()=>(await fetch(`/api/budgets/status${selectedAccount?`?account=${encodeURIComponent(selectedAccount)}`:''}`)).json()});
  const createMut=useMutation({mutationFn:Budgets.create,onSuccess:()=>{qc.invalidateQueries({queryKey:['budgets']});showToast('Budget set','success');setShowModal(false);},onError:(e:Error)=>showToast(e.message,'error')});
  const deleteMut=useMutation({mutationFn:Budgets.delete,onSuccess:()=>{qc.invalidateQueries({queryKey:['budgets']});showToast('Removed','success');},onError:(e:Error)=>showToast(e.message,'error')});
  const statusMap=new Map(status.map(s=>[s.category,s]));

  return(<div>
    <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-semibold">{budgets.length} budgets</h2><Button variant="primary" size="sm" onClick={()=>setShowModal(true)}><Plus size={14}/> New</Button></div>
    {isLoading?<div className="space-y-4">{Array.from({length:3}).map((_,i)=><Skeleton.Card key={i}/>)}</div>:budgets.length===0?<div className="text-center py-16 text-[var(--text-muted)]">No budgets set.</div>:(
      <Card><div className="space-y-4">{budgets.map((b:any)=>{const st=statusMap.get(b.category);const spent=st?.spent??0;const pct=Math.min((spent/b.amount)*100,100);const over=spent>b.amount;const fill=over?'var(--danger)':pct>80?'var(--warning)':'var(--primary)';
        return(<div key={b.id} className="pb-4 border-b border-[var(--border)] last:border-0 last:pb-0"><div className="flex items-center justify-between mb-2"><div><span className="text-sm font-medium">{b.category}</span><span className="text-xs text-[var(--text-muted)] ml-2">{b.period}</span></div><div className="flex items-center gap-3"><span className="text-sm tabular font-medium">{fmt(spent)}<span className="text-[var(--text-muted)]"> / {fmt(b.amount)}</span></span><button onClick={()=>deleteMut.mutate(b.id)} className="p-1 rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"><Trash2 size={14}/></button></div></div>
        <div className="h-2.5 bg-[var(--surface-2)] rounded-[var(--radius-full)] overflow-hidden"><div className="h-full rounded-[var(--radius-full)] transition-all duration-500" style={{width:`${pct}%`,background:fill}}/></div>
        <div className="mt-1">{over&&<Badge variant="expense">Over by {fmt(spent-b.amount)}</Badge>}{pct>80&&!over&&<Badge variant="warning">{pct.toFixed(0)}% used</Badge>}{pct<=80&&<span className="text-xs text-[var(--text-muted)]">{pct.toFixed(0)}% of budget</span>}</div></div>);
      })}</div></Card>)}
    {showModal&&<Modal open onClose={()=>setShowModal(false)} title="New Budget" footer={<><Button variant="secondary" size="sm" onClick={()=>setShowModal(false)}>Cancel</Button><Button variant="primary" size="sm" onClick={()=>{if(!form.category||!form.amount)return showToast('Fill all fields','error');createMut.mutate({category:form.category,amount:parseFloat(form.amount)});}}>Set</Button></>}><div className="space-y-3"><Field label="Category"><Select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}><option value="">— Select —</option>{categories.filter((c:string)=>c!=='Income'&&c!=='Needs Review').map((c:string)=><option key={c} value={c}>{c}</option>)}</Select></Field><Field label="Monthly amount"><Input type="number" placeholder="e.g. 5000" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></Field></div></Modal>}
  </div>);
}
