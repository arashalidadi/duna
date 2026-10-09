'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
export type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, updateTheme] = useState<Theme>('system');
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('duna-theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') updateTheme(stored);
    } catch {
      /* Private browsing still supports in-memory preferences. */
    }
    setInitialized(true);
  }, []);
  useEffect(() => {
    if (!initialized) return; // Keep the prepaint preference until storage has been read.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, initialized]);
  const setTheme = useCallback((value: Theme) => {
    updateTheme(value);
    try {
      localStorage.setItem('duna-theme', value);
    } catch {
      /* optional persistence */
    }
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
