import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Upload, BarChart3, CreditCard, Target, LogOut, Menu, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAccounts } from '@/hooks/useAccounts';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: Target },
];

function pageTitle(p: string) { return NAV.find(n => n.to === p || (n.to !== '/' && p.startsWith(n.to)))?.label ?? 'Dashboard'; }

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={clsx(
        'h-screen bg-[var(--surface)] border-r border-[var(--border)] flex flex-col shrink-0 z-50 transition-all duration-200',
        collapsed ? 'w-[56px]' : 'w-[220px]',
        'fixed inset-y-0 left-0 md:relative',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="h-[52px] px-4 flex items-center border-b border-[var(--border)] shrink-0">
          {!collapsed && <><div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white flex items-center justify-center text-xs font-bold mr-2.5">P</div><span className="font-semibold text-sm">PerFin</span></>}
          {collapsed && <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white flex items-center justify-center text-xs font-bold mx-auto">P</div>}
        </div>

        {!collapsed && <div className="px-3 pt-3 pb-2"><AccountSelect /></div>}

        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => clsx('flex items-center gap-3 h-9 rounded-[var(--radius-md)] text-sm font-medium transition-colors', collapsed ? 'justify-center px-0' : 'px-3',
                isActive ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]')}
              title={collapsed ? label : undefined}>
              <Icon size={collapsed ? 20 : 16} strokeWidth={1.8} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className={clsx('border-t border-[var(--border)]', collapsed ? 'p-2' : 'p-3')}>
          {collapsed ? <div className="flex flex-col items-center gap-2"><ThemeToggle /></div> : <UserSection />}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={pageTitle(pathname)} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 md:px-6 md:py-6 max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Topbar({ title, collapsed, onToggleCollapse, onMenu }: { title: string; collapsed: boolean; onToggleCollapse: () => void; onMenu: () => void }) {
  return (
    <header className="h-[52px] px-4 flex items-center border-b border-[var(--border)] bg-[var(--bg)] shrink-0 gap-3">
      <button className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] md:hidden" onClick={onMenu}><Menu size={18} /></button>
      <button className="p-1.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hidden md:flex" onClick={onToggleCollapse}><ChevronLeft size={16} className={clsx('transition-transform', collapsed && 'rotate-180')} /></button>
      <h1 className="text-base font-semibold text-[var(--text)] flex-1">{title}</h1>
      <ThemeToggle />
    </header>
  );
}

function AccountSelect() {
  const { data: accounts = [] } = useAccounts();
  const { selectedAccount, setSelectedAccount } = useAppStore();
  return (
    <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
      className="w-full h-8 px-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border-0 text-xs text-[var(--text)] cursor-pointer outline-none focus:shadow-[var(--ring-focus)]">
      <option value="">All accounts</option>
      {accounts.map((a: any) => <option key={a.name} value={a.name}>{a.name}</option>)}
    </select>
  );
}

function UserSection() {
  const { user, logout } = useAuthStore();
  if (!user) return <NavLink to="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Sign in</NavLink>;
  return <div className="flex items-center justify-between"><span className="text-xs text-[var(--text-muted)] truncate flex-1">{user.email}</span><button onClick={() => logout()} className="p-1.5 rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><LogOut size={14} /></button></div>;
}
