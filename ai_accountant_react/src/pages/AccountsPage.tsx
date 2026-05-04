import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAccounts, useCreateAccount, useDeleteAccount } from '@/hooks/useAccounts';
import { useAppStore } from '@/store/useAppStore';

function fmt(n:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);}

export function AccountsPage() {
  const{showToast}=useAppStore();const{data:accounts=[],isLoading}=useAccounts();const createMut=useCreateAccount();const deleteMut=useDeleteAccount();
  const[showModal,setShowModal]=useState(false);const[form,setForm]=useState({name:'',bank:'',account_type:'checking',currency:'INR',color:'#0071E3'});

  return(<div>
    <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-semibold">{accounts.length} accounts</h2><Button variant="primary" size="sm" onClick={()=>setShowModal(true)}><Plus size={14}/> Add</Button></div>
    {isLoading?<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><Skeleton.Card key={i}/>)}</div>:(
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((a:any)=>(<Card key={a.name}><div className="flex items-start justify-between mb-4"><div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{background:a.color||'#0071E3'}}>{(a.name||'A')[0].toUpperCase()}</div><button onClick={async()=>{try{await deleteMut.mutateAsync(a.name);showToast('Deleted','success');}catch(e:any){showToast(e.message,'error');}}} className="p-1.5 rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"><Trash2 size={14}/></button></div><h3 className="text-lg font-semibold mb-1">{a.name}</h3><p className="text-sm text-[var(--text-muted)] mb-4">{a.bank||a.account_type} · {a.currency}</p><div className="flex gap-4 pt-3 border-t border-[var(--border)] text-sm"><div><span className="text-[var(--text-muted)]">Txns</span><span className="font-medium ml-1">{a.transaction_count||0}</span></div>{a.total_income!==undefined&&<div><span className="text-[var(--text-muted)]">In</span><span className="text-[var(--success)] font-medium ml-1 tabular">{fmt(a.total_income)}</span></div>}{a.total_expenses!==undefined&&<div><span className="text-[var(--text-muted)]">Out</span><span className="text-[var(--danger)] font-medium ml-1 tabular">{fmt(a.total_expenses)}</span></div>}</div></Card>))}
        <button onClick={()=>setShowModal(true)} className="h-full min-h-[170px] border-2 border-dashed border-[var(--border)] rounded-[var(--radius-xl)] flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"><Plus size={24}/><span className="text-sm font-medium">Add account</span></button>
      </div>)}
    {showModal&&<Modal open onClose={()=>setShowModal(false)} title="New Account" footer={<><Button variant="secondary" size="sm" onClick={()=>setShowModal(false)}>Cancel</Button><Button variant="primary" size="sm" onClick={async()=>{if(!form.name)return showToast('Name required','error');try{await createMut.mutateAsync(form);showToast('Created','success');setShowModal(false);setForm({name:'',bank:'',account_type:'checking',currency:'INR',color:'#0071E3'});}catch(e:any){showToast(e.message,'error');}}}>Create</Button></>}><div className="space-y-3"><Field label="Name *"><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></Field><Field label="Bank"><Input value={form.bank} onChange={e=>setForm(f=>({...f,bank:e.target.value}))}/></Field><Field label="Type"><Select value={form.account_type} onChange={e=>setForm(f=>({...f,account_type:e.target.value}))}><option value="checking">Checking</option><option value="savings">Savings</option><option value="credit">Credit</option><option value="investment">Investment</option></Select></Field></div></Modal>}
  </div>);
}
