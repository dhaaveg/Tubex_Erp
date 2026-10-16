'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'eot_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always default to 'dark' as the primary enterprise industrial theme
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Synchronize DOM elements (html classList, data-theme, and style.colorScheme)
  const applyThemeToDom = useCallback((targetTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(targetTheme);
    root.setAttribute('data-theme', targetTheme);
    root.style.colorScheme = targetTheme;
  }, []);

  // Initial read from localStorage on mount (anti-flicker backup to inline head script)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        applyThemeToDom(stored);
      } else {
        // Fallback default is dark
        setThemeState('dark');
        applyThemeToDom('dark');
      }
    } catch {
      // In case localStorage is blocked by privacy mode
      setThemeState('dark');
      applyThemeToDom('dark');
    } finally {
      setMounted(true);
    }
  }, [applyThemeToDom]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Unable to persist theme to localStorage', e);
    }
  }, [applyThemeToDom]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyThemeToDom(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        console.warn('Unable to persist theme to localStorage', e);
      }
      return next;
    });
  }, [applyThemeToDom]);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
