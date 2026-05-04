import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { useAuthStore } from '@/store/useAuthStore';

export function RegisterPage() {
  const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');const[error,setError]=useState('');const[loading,setLoading]=useState(false);
  const navigate=useNavigate();const setAuth=useAuthStore(s=>s.setAuth);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match');return;}if(password.length<6){setError('Password must be 6+ chars');return;}setLoading(true);
    try{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Registration failed');setAuth(d.token,d.user);navigate('/');}
    catch(err:any){setError(err.message);}finally{setLoading(false);}};

  return(<div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
    <div className="w-full max-w-sm bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-card)] p-6">
      <div className="text-center mb-6"><div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold mx-auto mb-3">P</div><h1 className="text-2xl font-semibold">Create account</h1><p className="text-sm text-[var(--text-muted)] mt-1">Start tracking your finances</p></div>
      {error&&<div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--danger-soft)] text-[var(--danger)] text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4"><Field label="Email"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></Field><Field label="Password"><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/></Field><Field label="Confirm password"><Input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></Field><Button variant="primary" className="w-full" disabled={loading}>{loading?'Creating...':'Create account'}</Button></form>
      <p className="text-center text-sm text-[var(--text-muted)] mt-4">Already have one? <Link to="/login" className="text-[var(--primary)] hover:underline font-medium">Sign in</Link></p>
    </div></div>);
}
