import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolved: "light",
      setTheme: (theme) => { set({ theme }); applyTheme(theme, set); },
      initialize: () => applyTheme(get().theme, set),
    }),
    { name: "perfin-theme" }
  )
);

function applyTheme(theme: Theme, set: (s: Partial<ThemeState>) => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const resolved = theme === "system" ? (mql.matches ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = resolved;
  set({ resolved });
}

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") useThemeStore.getState().setTheme("system");
  });
}
