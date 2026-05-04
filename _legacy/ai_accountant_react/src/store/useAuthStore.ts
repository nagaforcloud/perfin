import { create } from 'zustand';

export interface AuthUser {
  id: number;
  email: string;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// Persist token in localStorage
const savedToken = localStorage.getItem('perfin_token');
const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem('perfin_user') || 'null'); }
  catch { return null; }
})();

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: savedToken,
  user: savedUser,
  setAuth: (token, user) => {
    localStorage.setItem('perfin_token', token);
    localStorage.setItem('perfin_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('perfin_token');
    localStorage.removeItem('perfin_user');
    set({ token: null, user: null });
  },
  isAuthenticated: () => !!get().token,
}));
