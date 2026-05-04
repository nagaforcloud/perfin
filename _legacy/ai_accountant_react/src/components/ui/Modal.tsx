import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface Props { open: boolean; onClose: () => void; title?: string; size?: 'sm' | 'md' | 'lg'; children: ReactNode; footer?: ReactNode; }

export function Modal({ open, onClose, title, size = 'md', children, footer }: Props) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  const w: Record<string, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className={clsx('w-full bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-modal)]', w[size])} style={{ animation: 'modal-in 200ms ease-out' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          {title && <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>}
          <button onClick={onClose} className="ml-auto p-1.5 rounded-[var(--radius-full)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--border)]">{footer}</div>}
      </div>
    </div>
  );
}
