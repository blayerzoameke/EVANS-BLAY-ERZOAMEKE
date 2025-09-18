import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
// FIX: Added .ts extension to import path.
import { supportedLanguages } from '../lib/i18n.ts';
// FIX: Added .ts extension to import path.
import type { Language } from '../types.ts';

const LanguageSettings: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const [browserLangInfo, setBrowserLangInfo] = useState<{ code: string, name: string } | null>(null);
    const [showConfirmation, setShowConfirmation] = useState<Language | null>(null);

    useEffect(() => {
        const detectedLangCode = navigator.language.split('-')[0];
        const detectedLang = supportedLanguages.find(l => l.code === detectedLangCode);
        if (detectedLang) {
            setBrowserLangInfo({ code: detectedLang.code, name: detectedLang.name });
        }
    }, []);

    const handleLanguageSelect = (langCode: Language) => {
        if (langCode !== language) {
            setShowConfirmation(langCode);
        }
    };

    const handleConfirm = () => {
        if (showConfirmation) {
            setLanguage(showConfirmation);
        }
        setShowConfirmation(null);
    };

    const getLanguageName = (code: string) => {
        return supportedLanguages.find(l => l.code === code)?.name || code;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('language.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('language.subtitle')}</p>
            </div>
            
            {browserLangInfo && language !== browserLangInfo.code && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <p>{t('language.detected', { language: browserLangInfo.name })}</p>
                        <p>{t('language.suggest', { language: browserLangInfo.name })}</p>
                    </div>
                    <button 
                        onClick={() => setLanguage(browserLangInfo.code)} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold whitespace-nowrap"
                    >
                        {t('language.switch')}
                    </button>
                </div>
            )}

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">{t('language.select')}</h3>
                <div className="space-y-2">
                    {supportedLanguages.map(({ code, name }) => (
                        <button
                            key={code}
                            onClick={() => handleLanguageSelect(code)}
                            className={`w-full text-left p-3 rounded-md transition-colors ${
                                language === code
                                    ? 'bg-teal-600 text-white font-bold'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            {showConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                        <h3 className="text-xl font-bold mb-2">{t('language.confirm.title')}</h3>
                        <p className="mb-4">{t('language.confirm.body', { language: getLanguageName(showConfirmation) })}</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setShowConfirmation(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
                            <button onClick={handleConfirm} className="px-4 py-2 bg-teal-600 text-white rounded-md">{t('language.confirm.confirm')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanguageSettings;