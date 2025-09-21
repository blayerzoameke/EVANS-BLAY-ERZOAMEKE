import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';

export type ColorTheme = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'emerald';

interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export const ColorThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('blue');

  useEffect(() => {
    const savedTheme = localStorage.getItem('colorTheme') as ColorTheme | null;
    if (savedTheme) {
      setColorThemeState(savedTheme);
    }
  }, []);

  const setColorTheme = useCallback((newTheme: ColorTheme) => {
    setColorThemeState(newTheme);
    localStorage.setItem('colorTheme', newTheme);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
};

export const useColorTheme = (): ColorThemeContextType => {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used within a ColorThemeProvider');
  }
  return context;
};