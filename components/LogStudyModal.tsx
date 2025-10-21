import React from 'react';
import type { PlanSlot } from '../types.ts';
import { DayOfWeek } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface LogStudyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartSession: (slot: PlanSlot) => void;
    onUploadSlides: (slot: PlanSlot) => void;
    slot: PlanSlot | null;
    day: DayOfWeek | null;
    nextSlot: PlanSlot | null;
}

const LogStudyModal: React.FC<LogStudyModalProps> = ({ isOpen, onClose, onStartSession, onUploadSlides, slot }) => {
    const { t } = useLanguage();
    
    if (!isOpen || !slot) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 no-print" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {t('logStudyModal.title', { subject: slot.activity })}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => onStartSession(slot)}
                        className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                    >
                        {t('logStudyModal.startStudies')}
                    </button>
                    <button
                        onClick={() => onUploadSlides(slot)}
                        className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {t('logStudyModal.uploadAndStudy')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogStudyModal;