import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Theme } from '../types';
import { TranslationKey } from '../lib/i18n';
import { useColorTheme, ColorTheme } from '../contexts/ColorThemeContext';

const ThemeSettings: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    const { colorTheme, setColorTheme } = useColorTheme();

    const options: { value: Theme, labelKey: TranslationKey, descKey?: TranslationKey, gradient: string, icon: string }[] = [
        { 
            value: 'light', 
            labelKey: 'theme.light',
            gradient: 'bg-gradient-to-br from-yellow-100 to-sky-200',
            icon: '☀️'
        },
        { 
            value: 'dark', 
            labelKey: 'theme.dark',
            gradient: 'bg-gradient-to-br from-gray-700 to-gray-900',
            icon: '🌙'
        },
        { 
            value: 'system', 
            labelKey: 'theme.system', 
            descKey: 'theme.system.desc',
            gradient: 'bg-gradient-to-br from-blue-500 to-purple-600',
            icon: '🖥️'
        },
    ];

    const colorThemes: { value: ColorTheme, nameKey: TranslationKey, previewClass: string }[] = [
        { 
            value: 'blue', 
            nameKey: 'theme.colors.blue',
            previewClass: 'bg-sky-500'
        },
        { 
            value: 'purple', 
            nameKey: 'theme.colors.purple',
            previewClass: 'bg-purple-500'
        },
        { 
            value: 'green', 
            nameKey: 'theme.colors.green',
            previewClass: 'bg-emerald-500'
        },
        { 
            value: 'orange', 
            nameKey: 'theme.colors.orange',
            previewClass: 'bg-orange-500'
        },
        { 
            value: 'pink', 
            nameKey: 'theme.colors.pink',
            previewClass: 'bg-pink-500'
        },
        { 
            value: 'emerald', 
            nameKey: 'theme.colors.emerald',
            previewClass: 'bg-emerald-600'
        }
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">{t('preferences.theme.title')}</h2>
            </div>
            <div className="space-y-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{t('theme.displayMode')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {options.map(({ value, labelKey, descKey, gradient, icon }) => (
                            <button
                                key={value}
                                onClick={() => setTheme(value)}
                                className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 transform hover:scale-105 ${
                                    theme === value
                                        ? 'ring-4 ring-primary shadow-2xl'
                                        : 'hover:shadow-xl'
                                }`}
                            >
                                <div className={`absolute inset-0 ${gradient}`}></div>
                                <div className="relative z-10 text-center">
                                    <div className="text-4xl mb-3">{icon}</div>
                                    <p className={`font-bold text-lg drop-shadow-lg mb-2 ${value === 'light' ? 'text-gray-800' : 'text-white'}`}>
                                        {t(labelKey)}
                                    </p>
                                    {descKey && (
                                        <p className="text-sm text-white/80">
                                            {t(descKey)}
                                        </p>
                                    )}
                                    {theme === value && (
                                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                                            <span className="text-primary font-bold text-lg">✓</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{t('theme.colorThemes')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">{t('theme.colorThemes.desc')}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {colorThemes.map(({ value, nameKey, previewClass }) => (
                            <button
                                key={value}
                                onClick={() => setColorTheme(value)}
                                className={`group rounded-xl transition-all duration-300 transform hover:scale-105 p-2 border-2 ${colorTheme === value ? 'border-primary' : 'border-transparent'}`}
                            >
                                <div className={`h-16 w-full rounded-lg ${previewClass} group-hover:opacity-90`}></div>
                                <div className="p-2">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-white text-center">
                                        {t(nameKey)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeSettings;