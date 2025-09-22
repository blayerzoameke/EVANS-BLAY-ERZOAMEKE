


import React, { useState, useEffect } from 'react';
import type { PlanSlot } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { CloseIcon } from './icons/CloseIcon';

interface StudyModeSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (breakConfig: { breakActivity: string; breakLink: string }) => void;
    studySlot: PlanSlot;
    breakSlot: PlanSlot | null;
}

const StudyModeSetupModal: React.FC<StudyModeSetupModalProps> = ({ isOpen, onClose, onStart, studySlot, breakSlot }) => {
    const { t } = useLanguage();
    const [breakActivity, setBreakActivity] = useState(breakSlot?.activity || '');
    const [breakLink, setBreakLink] = useState(breakSlot?.link || '');

    useEffect(() => {
        setBreakActivity(breakSlot?.activity || '');
        setBreakLink(breakSlot?.link || '');
    }, [breakSlot]);

    if (!isOpen) {
        return null;
    }
    
    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('studyModal.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('studyModal.sessionInfo')}</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-500">{studySlot.activity}</p>
                        <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-300">
                            <span>{t('studyModal.startTime')}: <strong>{studySlot.startTime}</strong></span>
                            <span>{t('studyModal.endTime')}: <strong>{studySlot.endTime}</strong></span>
                        </div>
                    </div>

                    {breakSlot ? (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('studyModal.breakSetup')}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Your break is from {breakSlot.startTime} to {breakSlot.endTime}.</p>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="break-activity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('studyModal.breakActivity')}</label>
                                    <input type="text" id="break-activity" value={breakActivity} onChange={e => setBreakActivity(e.target.value)} className={`${inputClasses} mt-1`} />
                                </div>
                                <div>
                                    <label htmlFor="break-link" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('studyModal.breakLink')}</label>
                                    <input type="text" id="break-link" value={breakLink} onChange={e => setBreakLink(e.target.value)} className={`${inputClasses} mt-1`} />
                                </div>
                            </div>
                        </div>
                    ) : (
                         <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t('uploadslides.noBreakSlot')}</p>
                    )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    <button
                        onClick={() => onStart({ breakActivity, breakLink })}
                        className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                    >
                        {t('studyModal.startStudying')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudyModeSetupModal;