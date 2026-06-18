import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { Theme } from '../types.ts';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ── Helper: resolve actual dark/light from theme setting ─────────────────
function resolveIsDark(t: Theme): boolean {
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// ── Helper: apply dark class + Safari repaint fix ────────────────────────
function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Safari iOS repaint fix — forces Safari to re-evaluate CSS classes
  const body = document.body;
  body.style.display = 'none';
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void body.offsetHeight; // trigger reflow
  body.style.display = '';

  // Update meta theme-color so the browser chrome matches
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#0f172a' : '#1d4ed8');
  }
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Read saved theme synchronously on first render
    try {
      return (localStorage.getItem('theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });

  // ── Apply theme whenever it changes ─────────────────────────────────
  useEffect(() => {
    applyTheme(resolveIsDark(theme));
  }, [theme]);

  // ── Listen for OS-level dark/light changes when theme === 'system' ───
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      localStorage.setItem('theme', newTheme);
    } catch {}
    // Apply immediately — don't wait for useEffect re-run
    applyTheme(resolveIsDark(newTheme));
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};