import { useEffect } from 'react';
import { Check, X, Info } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

/** Editorial "wire-dispatch" toast — ink slab, no rounded corners. */
export function Toast() {
  const { toast, clearToast } = useAppStore();

  useEffect(() => {
    if (toast) {
      const t = setTimeout(clearToast, 3500);
      return () => clearTimeout(t);
    }
  }, [toast, clearToast]);

  if (!toast) return null;

  const configs = {
    success: { icon: Check, tint: '#2A5A3E', label: 'POSTED' },
    error:   { icon: X,     tint: '#7A1E1E', label: 'ERRATA' },
    info:    { icon: Info,  tint: '#2B3458', label: 'DISPATCH' },
  } as const;
  const cfg = configs[toast.type];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-stretch gap-0 max-w-md rise rise-1',
      )}
      style={{
        background: '#F2E9D8',
        border: '1px solid #1A1814',
        boxShadow: '4px 4px 0 0 #1A1814',
      }}
    >
      <div
        className="flex items-center justify-center px-3"
        style={{ background: cfg.tint, color: '#F2E9D8' }}
      >
        <Icon size={15} strokeWidth={2.2} />
      </div>
      <div className="flex-1 px-4 py-2.5">
        <div className="kicker" style={{ color: cfg.tint, fontSize: 9 }}>{cfg.label}</div>
        <div style={{ color: '#1A1814', fontSize: 13, fontWeight: 500 }}>{toast.message}</div>
      </div>
      <button
        onClick={clearToast}
        className="px-2.5 hover:bg-[#1A1814] hover:text-[#F2E9D8] transition-colors"
        style={{ color: '#7A6B58', borderLeft: '1px solid #1A1814' }}
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}
