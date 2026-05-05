import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', '2': 'var(--surface-2)', '3': 'var(--surface-3)' },
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        text: { DEFAULT: 'var(--text)', muted: 'var(--text-muted)', subtle: 'var(--text-subtle)' },
        accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)', hover: 'var(--accent-hover)' },
        positive: { DEFAULT: 'var(--positive)', soft: 'var(--positive-soft)' },
        negative: { DEFAULT: 'var(--negative)', soft: 'var(--negative-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', ring: 'var(--ring)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
};

export default preset;
