
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
// FIX: Added .tsx extension to import path.
import type { View } from '../App.tsx';

interface HelpProps {
    setView: (view: View) => void;
}

const AccordionItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b dark:border-gray-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left py-4 px-2"
            >
                <span className="font-semibold text-gray-800 dark:text-gray-200">{title}</span>
                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="pb-4 px-2 text-gray-600 dark:text-gray-400 prose dark:prose-invert max-w-none">
                    {children}
                </div>
            )}
        </div>
    );
};


const Help: React.FC<HelpProps> = ({ setView }) => {
    const { t } = useLanguage();

    const faqKeys = ['1', '2', '3', '4', '5', '6'];

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('help.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('help.subtitle')}</p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                 <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">{t('help.faq')}</h3>
                 <div>
                    {faqKeys.map((key) => (
                        <AccordionItem key={key} title={t(`help.faq.q${key}` as any)}>
                            <p dangerouslySetInnerHTML={{ __html: t(`help.faq.a${key}` as any) }} />
                        </AccordionItem>
                    ))}
                 </div>
            </div>

            <div className="text-center">
                 <p className="text-gray-600 dark:text-gray-400">{t('help.stillNeedHelp')}</p>
                 <button onClick={() => setView('report')} className="mt-2 font-semibold text-blue-700 dark:text-blue-500 hover:underline">
                     {t('help.contactSupport')}
                 </button>
            </div>
        </div>
    );
};

export default Help;
