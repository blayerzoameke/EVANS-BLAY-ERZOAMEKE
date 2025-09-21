

// FIX: Added .ts extension to all translation module imports to resolve module not found errors.
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
// This ensures that any key used must exist in the English translation object.
export type TranslationKey = keyof typeof translations['en'];

export const supportedLanguages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español (Spanish)' },
    { code: 'fr', name: 'Français (French)' },
    { code: 'de', name: 'Deutsch (German)' },
    { code: 'ja', name: '日本語 (Japanese)' },
    { code: 'zh', name: '中文 (Simplified Chinese)' },
];

export const getTranslator = (lang: Language) => (key: TranslationKey, replacements?: { [key: string]: string | number }) => {
    // Fallback to English if the key doesn't exist in the selected language
    // @ts-ignore
    let translation = (translations[lang] as any)?.[key] || translations['en'][key];
    
    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            // Use a regex to replace all occurrences of the placeholder
            const regex = new RegExp(`\\{${rKey}\\}`, 'g');
            translation = translation.replace(regex, String(replacements[rKey]));
        });
    }
    
    return translation;
};