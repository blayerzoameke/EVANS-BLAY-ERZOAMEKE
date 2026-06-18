
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface UntrackedStudySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (config: { studyDuration: number; breakDuration: number; breakActivity: string; breakLink: string }) => void;
}

const UntrackedStudySetupModal: React.FC<UntrackedStudySetupModalProps> = ({ isOpen, onClose, onStart }) => {
    const { t } = useLanguage();
    const [studyDuration, setStudyDuration] = useState(60);
    const [breakDuration, setBreakDuration] = useState(5);
    const [breakActivity, setBreakActivity] = useState('');
    const [breakLink, setBreakLink] = useState('');

    if (!isOpen) {
        return null;
    }
    
    const handleStart = () => {
        onStart({
            studyDuration,
            breakDuration,
            breakActivity,
            breakLink,
        });
    };

    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('untrackedStudyModal.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    <div>
                        <label htmlFor="study-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('untrackedStudyModal.duration')}</label>
                        <input type="number" id="study-duration" value={studyDuration} onChange={e => setStudyDuration(parseInt(e.target.value, 10))} className={`${inputClasses} mt-1`} min="1" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('untrackedStudyModal.durationSuggestion')}</p>
                    </div>

                    <div>
                        <label htmlFor="break-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('untrackedStudyModal.breakDuration')}</label>
                        <select id="break-duration" value={breakDuration} onChange={e => setBreakDuration(parseInt(e.target.value, 10))} className={`${inputClasses} mt-1`}>
                            <option value={0}>{t('sessionCustomization.breakDuration.none')}</option>
                            <option value={5}>{t('sessionCustomization.breakDuration.5')}</option>
                            <option value={10}>{t('sessionCustomization.breakDuration.10')}</option>
                            <option value={15}>{t('sessionCustomization.breakDuration.15')}</option>
                        </select>
                    </div>

                    {breakDuration > 0 && (
                        <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                            <div>
                                <label htmlFor="break-activity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.breakActivity')}</label>
                                <input type="text" id="break-activity" value={breakActivity} onChange={e => setBreakActivity(e.target.value)} placeholder={t('sessionCustomization.breakActivityPlaceholder')} className={`${inputClasses} mt-1`} />
                            </div>
                            <div>
                                <label htmlFor="break-link" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.breakLink')}</label>
                                <input type="url" id="break-link" value={breakLink} onChange={e => setBreakLink(e.target.value)} placeholder={t('sessionCustomization.breakLinkPlaceholder')} className={`${inputClasses} mt-1`} />
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    <button
                        onClick={handleStart}
                        className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                    >
                        {t('untrackedStudyModal.start')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UntrackedStudySetupModal;
