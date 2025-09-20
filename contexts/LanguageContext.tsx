import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// FIX: Added .ts extension to import path.
import { Language, translations, getTranslator, supportedLanguages, TranslationKey } from '../lib/i18n.ts';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, replacements?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const rtlLanguages = ['ar'];

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('language');
    const browserLang = navigator.language.split('-')[0];
    const defaultLang = savedLang || browserLang;
    
    if (supportedLanguages.some(l => l.code === defaultLang)) {
      // FIX: Cast defaultLang to Language type to satisfy the state setter's type requirement.
      setLanguageState(defaultLang as Language);
    } else {
      setLanguageState('en');
    }
  }, []);
  
  // Effect to handle document directionality for RTL languages
  useEffect(() => {
    if (rtlLanguages.includes(language)) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [language]);
  
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  const t = getTranslator(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: t as any }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
