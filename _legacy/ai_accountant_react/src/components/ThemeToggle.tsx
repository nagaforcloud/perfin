import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const next: Record<string, { next: 'light' | 'dark' | 'system'; icon: typeof Sun }> = {
    light: { next: 'dark', icon: Moon },
    dark: { next: 'system', icon: Monitor },
    system: { next: 'light', icon: Sun },
  };
  const { next: n, icon: Icon } = next[theme];
  return (
    <button onClick={() => setTheme(n)} className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors" title={`Theme: ${theme} → ${n}`}>
      <Icon size={18} />
    </button>
  );
}
