import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
// FIX: Added .ts extension to import path.
import type { Theme } from '../types.ts';

const ThemeSettings: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();

    // FIX: Added .ts extension to import path for type definition.
    const options: { value: Theme, labelKey: keyof typeof import('../lib/i18n.ts').translations['en'], descKey?: keyof typeof import('../lib/i18n.ts').translations['en'] }[] = [
        { value: 'light', labelKey: 'theme.light' },
        { value: 'dark', labelKey: 'theme.dark' },
        { value: 'system', labelKey: 'theme.system', descKey: 'theme.system.desc' },
    ];

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('theme.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('theme.subtitle')}</p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                {options.map(({ value, labelKey, descKey }) => (
                    <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                            theme === value
                                ? 'border-blue-700 bg-blue-50 dark:bg-blue-900/30'
                                : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
                        }`}
                    >
                        <p className={`font-semibold ${theme === value ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                            {t(labelKey)}
                        </p>
                        {descKey && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t(descKey)}
                            </p>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ThemeSettings;