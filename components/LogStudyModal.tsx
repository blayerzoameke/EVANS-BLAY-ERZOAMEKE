import React, { useState, useEffect } from 'react';
// FIX: Changed DayOfWeek to a value import to allow access to enum members.
import type { PlanSlot } from '../types.ts';
import { DayOfWeek } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';

interface LogStudyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartSession: (slot: PlanSlot) => void;
    onLogTime: (subject: string, duration: number, date: string) => void;
    slot: PlanSlot | null;
    day: DayOfWeek | null;
}

const LogStudyModal: React.FC<LogStudyModalProps> = ({ isOpen, onClose, onStartSession, onLogTime, slot, day }) => {
    const { t } = useLanguage();
    const [isLogging, setIsLogging] = useState(false);
    const [duration, setDuration] = useState(60);
    const [studyDate, setStudyDate] = useState('');

    useEffect(() => {
        if (isOpen && day) {
            const today = new Date();
            const todayDayIndex = today.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6
            const dayOfWeekMap: { [key in DayOfWeek]: number } = {
                [DayOfWeek.Sunday]: 0,
                [DayOfWeek.Monday]: 1,
                [DayOfWeek.Tuesday]: 2,
                [DayOfWeek.Wednesday]: 3,
                [DayOfWeek.Thursday]: 4,
                [DayOfWeek.Friday]: 5,
                [DayOfWeek.Saturday]: 6,
            };
            const targetDayIndex = dayOfWeekMap[day];
            const dayDifference = todayDayIndex - targetDayIndex;
            const targetDate = new Date();
            targetDate.setDate(today.getDate() - dayDifference);
            setStudyDate(targetDate.toISOString().split('T')[0]); // YYYY-MM-DD format
        } else {
            // Reset when closing
            setIsLogging(false);
            setDuration(60);
        }
    }, [isOpen, day]);
    
    if (!isOpen || !slot) return null;

    const handleSaveLog = () => {
        if (duration > 0 && slot) {
            onLogTime(slot.activity, duration, studyDate);
            onClose();
        }
    };
    
    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 no-print" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {isLogging
                            ? t('logStudyModal.logTitle', { subject: slot.activity })
                            : t('logStudyModal.title', { subject: slot.activity })
                        }
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    {!isLogging ? (
                        <div className="space-y-3">
                            <button
                                onClick={() => onStartSession(slot)}
                                className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                            >
                                {t('logStudyModal.startSession')}
                            </button>
                            <button
                                onClick={() => setIsLogging(true)}
                                className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700"
                            >
                                {t('logStudyModal.logTime')}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('logStudyModal.duration')}</label>
                                <input
                                    id="duration"
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                                    className={`${inputClasses} mt-1`}
                                    min="1"
                                />
                            </div>
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('logStudyModal.date')}</label>
                                <input
                                    id="date"
                                    type="date"
                                    value={studyDate}
                                    onChange={(e) => setStudyDate(e.target.value)}
                                    className={`${inputClasses} mt-1`}
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <button onClick={() => setIsLogging(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                                    <ArrowLeftIcon className="w-4 h-4" /> {t('common.previous')}
                                </button>
                                <button
                                    onClick={handleSaveLog}
                                    className="px-6 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                                >
                                    {t('logStudyModal.saveLog')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogStudyModal;
