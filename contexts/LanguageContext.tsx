import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
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
    // FIX: Removed unnecessary `as any` type assertion.
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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