// A simple i18n implementation for demonstration purposes.
// In a real-world app, you would use a library like i18next or react-intl.

export const translations = {
  en: {
    dashboard: 'Dashboard',
    progression: 'Progression',
    welcome: 'Welcome to your Smart Plan',
  },
  es: {
    dashboard: 'Tablero',
    progression: 'Progresión',
    welcome: 'Bienvenido a tu Plan Inteligente',
  },
  fr: {
    dashboard: 'Tableau de bord',
    progression: 'Progression',
    welcome: 'Bienvenue dans votre Plan Intelligent',
  },
};

export type Language = keyof typeof translations;

export const getTranslator = (lang: Language) => (key: keyof typeof translations['en']) => {
  return translations[lang][key] || translations['en'][key];
};
