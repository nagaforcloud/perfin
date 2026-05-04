import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { useAuthStore } from '@/store/useAuthStore';

export function LoginPage() {
  const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[loading,setLoading]=useState(false);
  const navigate=useNavigate();const setAuth=useAuthStore(s=>s.setAuth);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setLoading(true);
    try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Login failed');setAuth(d.token,d.user);navigate('/');}
    catch(err:any){setError(err.message);}finally{setLoading(false);}};

  return(<div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
    <div className="w-full max-w-sm bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-card)] p-6">
      <div className="text-center mb-6"><div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold mx-auto mb-3">P</div><h1 className="text-2xl font-semibold">Welcome back</h1><p className="text-sm text-[var(--text-muted)] mt-1">Sign in to PerFin</p></div>
      {error&&<div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--danger-soft)] text-[var(--danger)] text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4"><Field label="Email"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></Field><Field label="Password"><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></Field><Button variant="primary" className="w-full" disabled={loading}>{loading?'Signing in...':'Sign in'}</Button></form>
      <p className="text-center text-sm text-[var(--text-muted)] mt-4">No account? <Link to="/register" className="text-[var(--primary)] hover:underline font-medium">Create one</Link></p>
    </div></div>);
}
