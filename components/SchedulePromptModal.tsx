import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface SchedulePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateSchedule: () => void;
    onContinue: () => void;
}

const SchedulePromptModal: React.FC<SchedulePromptModalProps> = ({ isOpen, onClose, onCreateSchedule, onContinue }) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('schedulePrompt.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">{t('schedulePrompt.body')}</p>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 text-amber-800 dark:text-amber-200 text-sm">
                         <p>{t('schedulePrompt.warning')}</p>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                     <button
                        onClick={onCreateSchedule}
                        className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-blue-700 text-white hover:bg-blue-800"
                    >
                        {t('schedulePrompt.createButton')}
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        {t('schedulePrompt.continueButton')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SchedulePromptModal;