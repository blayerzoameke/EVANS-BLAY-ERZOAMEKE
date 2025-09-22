import React from 'react';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import type { Theme } from '../types.ts';
import { TranslationKey } from '../lib/i18n.ts';
import { useColorTheme, ColorTheme } from '../contexts/ColorThemeContext.tsx';

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

    // Add color theme options
    const colorThemes: { value: ColorTheme, name: string, previewClass: string }[] = [
        { 
            value: 'blue', 
            name: 'Ocean Blue',
            previewClass: 'bg-sky-500'
        },
        { 
            value: 'purple', 
            name: 'Royal Purple',
            previewClass: 'bg-purple-500'
        },
        { 
            value: 'green', 
            name: 'Forest Green',
            previewClass: 'bg-emerald-500'
        },
        { 
            value: 'orange', 
            name: 'Sunset Orange',
            previewClass: 'bg-orange-500'
        },
        { 
            value: 'pink', 
            name: 'Cherry Blossom',
            previewClass: 'bg-pink-500'
        },
        { 
            value: 'emerald', 
            name: 'Emerald Dream',
            previewClass: 'bg-emerald-600'
        }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-3">
                    {t('theme.title')}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-lg">{t('theme.subtitle')}</p>
            </div>

            {/* Theme Mode Selection */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Display Mode</h3>
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

            {/* Color Theme Selection */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Color Themes</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Choose your preferred color scheme for the app interface</p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {colorThemes.map(({ value, name, previewClass }) => (
                        <button
                            key={value}
                            onClick={() => setColorTheme(value)}
                            className={`group rounded-xl transition-all duration-300 transform hover:scale-105 p-2 border-2 ${colorTheme === value ? 'border-primary' : 'border-transparent'}`}
                        >
                            <div className={`h-16 w-full rounded-lg ${previewClass} group-hover:opacity-90`}></div>
                            <div className="p-2">
                                <p className="text-sm font-semibold text-gray-800 dark:text-white text-center">
                                    {name}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Theme Preview */}
            <div className="bg-primary rounded-2xl shadow-xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-6 drop-shadow-lg">Theme Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sample Cards */}
                    <div className="space-y-4">
                        <div className="bg-lecture p-4 rounded-xl shadow-lg">
                            <h4 className="font-bold text-white mb-2">Sample Lecture</h4>
                            <p className="text-white/80 text-sm">Mathematics - 08:00 AM</p>
                            <span className="inline-block px-2 py-1 bg-white/20 rounded-full text-xs mt-2">LECTURE</span>
                        </div>
                        <div className="bg-study p-4 rounded-xl shadow-lg">
                            <h4 className="font-bold text-white mb-2">Study Session</h4>
                            <p className="text-white/80 text-sm">Physics - 10:00 AM</p>
                            <span className="inline-block px-2 py-1 bg-white/20 rounded-full text-xs mt-2">STUDY</span>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-break p-4 rounded-xl shadow-lg">
                            <h4 className="font-bold text-white mb-2">Break Time</h4>
                            <p className="text-white/80 text-sm">Coffee Break - 15 mins</p>
                            <span className="inline-block px-2 py-1 bg-white/20 rounded-full text-xs mt-2">BREAK</span>
                        </div>
                        <div className="bg-agenda p-4 rounded-xl shadow-lg">
                            <h4 className="font-bold text-white mb-2">Morning Routine</h4>
                            <p className="text-white/80 text-sm">Breakfast - 07:30 AM</p>
                            <span className="inline-block px-2 py-1 bg-white/20 rounded-full text-xs mt-2">AGENDA</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reset to Default */}
            <div className="text-center">
                <button 
                    onClick={() => { setTheme('system'); setColorTheme('blue'); }}
                    className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                    Reset to Default
                </button>
            </div>
        </div>
    );
};

export default ThemeSettings;