import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import type { ActiveSession } from '../types.ts';

interface SessionCompleteModalProps {
    isOpen: boolean;
    onNavigate: (target: 'dashboard' | 'uploadslides') => void;
    onStartBreak?: () => void;
    session: ActiveSession;
    wasTracked: boolean;
}

const SessionCompleteModal: React.FC<SessionCompleteModalProps> = ({ isOpen, onNavigate, onStartBreak, session, wasTracked }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    const duration = Math.round((session.endTime - session.startTime) / (1000 * 60));
    const nextActivity = session.nextSlot?.activity;
    const isNextBreak = session.nextSlot?.type === 'break';
    const breakDuration = isNextBreak ? Math.round((new Date(`1970-01-01T${session.nextSlot!.endTime}`).getTime() - new Date(`1970-01-01T${session.nextSlot!.startTime}`).getTime()) / (1000*60)) : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[110] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md text-center p-8">
                <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">{t('sessionComplete.title')}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{t('sessionComplete.body', { subject: session.subject, duration })}</p>
                {wasTracked && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('sessionComplete.log')}</p>}
                
                {nextActivity && (
                     <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg mb-6">
                        <p className="text-sm font-semibold">{t('sessionComplete.next')}</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{nextActivity}</p>
                        {isNextBreak && <p className="text-xs">{t('sessionComplete.nextBreak', { duration: breakDuration })}</p>}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                    {isNextBreak && onStartBreak ? (
                        <button onClick={onStartBreak} className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                            {t('sessionComplete.startBreak')}
                        </button>
                    ) : (
                        <>
                            <button onClick={() => onNavigate('uploadslides')} className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                                {t('sessionComplete.backToHub')}
                            </button>
                            <button onClick={() => onNavigate('dashboard')} className="flex-1 px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800">
                                {t('sessionComplete.backToDash')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SessionCompleteModal;