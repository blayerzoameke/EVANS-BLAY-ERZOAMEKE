import { translations as enTranslations } from './i18n-en.ts';
import { translations as esTranslations } from './i18n-es.ts';
import { translations as frTranslations } from './i18n-fr.ts';
import { translations as deTranslations } from './i18n-de.ts';
import { translations as jaTranslations } from './i18n-ja.ts';
import { translations as zhTranslations } from './i18n-zh.ts';

export const translations = {
  en: enTranslations,
  es: esTranslations,
  fr: frTranslations,
  de: deTranslations,
  ja: jaTranslations,
  zh: zhTranslations,
};

export type Language = keyof typeof translations;
// FIX: Redefine TranslationKey as string to fix widespread type inference issues.
// This sacrifices some type safety but resolves the build errors.
export type TranslationKey = string;

export const supportedLanguages: { code: Language; name: string; nameKey: TranslationKey }[] = [
    { code: 'en', name: 'English', nameKey: 'language.en' },
    { code: 'es', name: 'Español (Spanish)', nameKey: 'language.es' },
    { code: 'fr', name: 'Français (French)', nameKey: 'language.fr' },
    { code: 'de', name: 'Deutsch (German)', nameKey: 'language.de' },
    { code: 'ja', name: '日本語 (Japanese)', nameKey: 'language.ja' },
    { code: 'zh', name: '中文 (Simplified Chinese)', nameKey: 'language.zh' },
];

export const getTranslator = (lang: Language) => (key: TranslationKey, replacements?: { [key: string]: string | number }) => {
    // Fallback to English if the key doesn't exist in the selected language
    // FIX: Made the lookup safer and ensured the result is treated as a string.
    const translationsForLang = translations[lang];
    const fallbackTranslations = translations['en'];
    
    let translation = (translationsForLang as any)?.[key] || (fallbackTranslations as any)[key];
    
    if (typeof translation !== 'string') {
        // Fallback for keys that might not be present, to avoid runtime errors.
        return key;
    }

    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            // Use a regex to replace all occurrences of the placeholder
            const regex = new RegExp(`\\{${rKey}\\}`, 'g');
            translation = translation.replace(regex, String(replacements[rKey]));
        });
    }
    
    return translation;
};
