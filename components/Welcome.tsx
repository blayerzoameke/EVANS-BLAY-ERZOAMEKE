import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon';

interface WelcomeProps {
    onProceed: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onProceed }) => {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 text-center animate-fade-in-down">
            <div className="w-full max-w-md">
                <LogoIcon className="w-24 h-24 mx-auto text-primary mb-4" />
                <h1 className="text-5xl font-bold text-gray-800 dark:text-white">EduBlay</h1>
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mt-6">{t('welcome.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    {t('welcome.description')}
                </p>
                <button 
                    onClick={onProceed} 
                    className="w-full py-3 mt-8 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark transition-colors"
                >
                    {t('welcome.button')}
                </button>
            </div>
        </div>
    );
};

export default Welcome;