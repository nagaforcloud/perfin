import { create } from 'zustand';

interface AppStore {
  // Filters
  selectedAccount: string;
  setSelectedAccount: (account: string) => void;

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAccount: '',
  setSelectedAccount: (account) => set({ selectedAccount: account }),

  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3500);
  },
  clearToast: () => set({ toast: null }),
}));
