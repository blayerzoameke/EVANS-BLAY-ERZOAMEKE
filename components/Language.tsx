import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supportedLanguages } from '../lib/i18n';
import type { Language } from '../lib/i18n';
import ConfirmationModal from './ConfirmationModal';

const LanguageSettings: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const [pendingLanguage, setPendingLanguage] = useState<{ code: Language; name: string } | null>(null);

    const handleLanguageChangeRequest = (lang: { code: Language; name: string }) => {
        if (lang.code !== language) {
            setPendingLanguage(lang);
        }
    };

    const handleConfirmLanguageChange = () => {
        if (pendingLanguage) {
            setLanguage(pendingLanguage.code);
            setPendingLanguage(null);
        }
    };

    return (
        <>
            <div className="max-w-2xl mx-auto">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">{t('preferences.language.title')}</h2>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700">
                    <div className="space-y-2">
                        {supportedLanguages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChangeRequest(lang)}
                                className={`w-full text-left p-3 rounded-md transition-colors ${
                                    language === lang.code
                                        ? 'bg-primary text-primary-text font-bold'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {pendingLanguage && (
                <ConfirmationModal
                    isOpen={!!pendingLanguage}
                    onClose={() => setPendingLanguage(null)}
                    onConfirm={handleConfirmLanguageChange}
                    title={t('confirmation.changeLanguage.title')}
                    message={t('confirmation.changeLanguage.message', { languageName: pendingLanguage.name })}
                    confirmText={t('confirmation.changeLanguage.confirm')}
                />
            )}
        </>
    );
};

export default LanguageSettings;