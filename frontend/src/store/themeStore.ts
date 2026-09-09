import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (enabled: boolean) => void;
}

// Función auxiliar para aplicar o retirar la clase 'dark' en el documento raíz
const applyThemeClass = (isDark: boolean) => {
  if (typeof document !== 'undefined') {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

// Sincronización inmediata al evaluar el módulo para prevenir parpadeos visuales
(() => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('quantix-theme-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.isDarkMode) {
          applyThemeClass(true);
          return;
        }
      }
    } catch {
      // Ignorar errores de parsing
    }
    applyThemeClass(false);
  }
})();

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDarkMode: false,

      toggleDarkMode: () => {
        const nextMode = !get().isDarkMode;
        applyThemeClass(nextMode);
        set({ isDarkMode: nextMode });
      },

      setDarkMode: (enabled: boolean) => {
        applyThemeClass(enabled);
        set({ isDarkMode: enabled });
      },
    }),
    {
      name: 'quantix-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeClass(state.isDarkMode);
        }
      },
    }
  )
);
