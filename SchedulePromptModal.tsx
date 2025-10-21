
import React from 'react';
import { useLanguage } from './contexts/LanguageContext.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import type { PlanSlot } from './types.ts';
import { timeToMinutes } from './lib/utils.ts';

interface SchedulePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onReject: () => void;
    sessionInfo: {
        slot: PlanSlot;
        nextSlot: PlanSlot | null;
    };
}

const SchedulePromptModal: React.FC<SchedulePromptModalProps> = ({ isOpen, onClose, onConfirm, onReject, sessionInfo }) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    const { slot, nextSlot } = sessionInfo;
    const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    const durationText = duration >= 60 
        ? `${(duration / 60).toFixed(1)} ${t('common.hours')}` 
        : `${duration} ${t('common.minutes')}`;

    const isNextBreak = nextSlot?.type === 'break';
    
    // FIX: Use i18n function instead of hardcoded strings
    const message = t('schedulePrompt.message', {
        course: slot.activity,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: durationText
    }) + (isNextBreak && nextSlot ? t('schedulePrompt.breakInfo', { startTime: nextSlot.startTime, endTime: nextSlot.endTime }) : '');

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
                    <p className="text-gray-600 dark:text-gray-400">
                        {message}
                    </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                     <button
                        onClick={onConfirm}
                        className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-blue-700 text-white hover:bg-blue-800"
                    >
                        {t('schedulePrompt.confirmButton', { course: slot.activity })}
                    </button>
                    <button
                        onClick={onReject}
                        className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        {t('schedulePrompt.rejectButton')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SchedulePromptModal;