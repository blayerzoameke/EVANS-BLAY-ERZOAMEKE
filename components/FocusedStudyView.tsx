

import React, { useState, useEffect, useRef } from 'react';
import type { ActiveSession, UploadedFile, Toast, TrackedSession, LearningHubState, View } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { ExitIcon } from './icons/ExitIcon.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { ClockIcon } from './icons/ClockIcon.tsx';
import { BookIcon } from './icons/BookIcon.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import FileViewer from './FileViewer.tsx';
import { ActivityType } from '../types.ts';
import SessionCompleteModal from './SessionCompleteModal.tsx';

interface FocusedStudyViewProps {
    session: ActiveSession;
    setSession: (session: ActiveSession | null) => void;
    learningHubFile: UploadedFile | null;
    onExit: () => void;
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onStartBreak: (breakSession: ActiveSession) => void;
    trackedData: TrackedSession[];
    setTrackedData: (data: TrackedSession[]) => void;
}

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    try {
        const timeLower = time.toLowerCase().replace(/\s/g, '');
        const isPM = timeLower.includes('pm');
        const isAM = timeLower.includes('am');

        const timeOnly = timeLower.replace('am', '').replace('pm', '');
        
        let [hourStr, minuteStr] = timeOnly.split(':');
        
        if (!minuteStr) minuteStr = '0';

        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr, 10);

        if (isNaN(hours) || isNaN(minutes)) {
            console.warn(`Could not parse time: ${time}`);
            return 0;
        }
        
        if (isPM && hours !== 12) {
            hours += 12;
        }
        if (isAM && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    } catch (e) {
        console.error("Failed to parse time string:", time, e);
        return 0;
    }
};


const FocusedStudyView: React.FC<FocusedStudyViewProps> = ({ session, setSession, learningHubFile, onExit, addToast, onStartBreak, trackedData, setTrackedData }) => {
    const { t } = useLanguage();
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const totalDurationSeconds = session.durationMinutes ? session.durationMinutes * 60 : (session.endTime - session.startTime) / 1000;
    
    const [timeRemaining, setTimeRemaining] = useState(Math.max(0, Math.round((session.endTime - Date.now()) / 1000)));
    const [isStudyPaused, setIsStudyPaused] = useState(false);
    const [isBreakTime, setIsBreakTime] = useState(false);
    const [breakTimeRemaining, setBreakTimeRemaining] = useState(0);
    const [studyProgress, setStudyProgress] = useState(0);
    const [showBreakActivity, setShowBreakActivity] = useState(false);
    const [breakVideoUrl, setBreakVideoUrl] = useState('');
    const [sessionComplete, setSessionComplete] = useState(false);
    const [pauseTime, setPauseTime] = useState(0);
    
    const timerRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAAAAQABAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBg==');
        playNotificationSound();
    }, []);

    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (isStudyPaused) return;

        timerRef.current = setInterval(() => {
            if (isBreakTime) {
                setBreakTimeRemaining(prev => {
                    if (prev <= 1) {
                        endBreak();
                        return 0;
                    }
                    return prev - 1;
                });
            } else { // Is Study Time
                const newTimeRemaining = Math.max(0, Math.round((session.endTime - Date.now()) / 1000));
                setTimeRemaining(newTimeRemaining);
                
                const elapsed = totalDurationSeconds - newTimeRemaining;
                setStudyProgress((elapsed / totalDurationSeconds) * 100);

                if (newTimeRemaining <= 0) {
                    handleSessionComplete();
                } else if (elapsed > 0 && Math.round(elapsed) % (25 * 60) === 0 && !isBreakTime) {
                    startPomodoroBreak();
                }
            }
        }, 1000) as unknown as number;

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isStudyPaused, isBreakTime, totalDurationSeconds, session.endTime]);

    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
        }
    };

    const startPomodoroBreak = () => {
        setIsBreakTime(true);
        setBreakTimeRemaining(5 * 60); // 5 minute break
        setShowBreakActivity(true);
        playNotificationSound();
        addToast(t('toasts.breakStarted'), 'info');
    };

    const endBreak = () => {
        setIsBreakTime(false);
        setBreakTimeRemaining(0);
        setShowBreakActivity(false);
        playNotificationSound();
        addToast(t('toasts.breakOver'), 'success');
    };

    const handleSessionComplete = () => {
        if(timerRef.current) clearInterval(timerRef.current);
        playNotificationSound();
        addToast(t('toasts.sessionComplete', { subject: session.subject }), 'success');
        setSessionComplete(true);

        if (!session.isUntracked) {
            const durationMinutes = session.durationMinutes || Math.round((session.endTime - session.startTime) / (1000 * 60));
            if (durationMinutes > 0) {
                const newLog: TrackedSession = {
                    subject: session.subject,
                    durationMinutes: durationMinutes,
                    date: new Date().toISOString().split('T')[0],
                };
                setTrackedData([...(trackedData || []), newLog]);
            }
        }
    };

    const togglePause = () => {
        setIsStudyPaused(prev => {
            if (!prev) { // Pausing
                if(timerRef.current) clearInterval(timerRef.current);
                setPauseTime(Date.now());
            } else { // Resuming
                const pausedDuration = Date.now() - pauseTime;
                setSession({ ...session, endTime: session.endTime + pausedDuration });
            }
            return !prev;
        });
        addToast(isStudyPaused ? t('toasts.sessionResumed') : t('toasts.sessionPaused'), 'info');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartBreakFromModal = () => {
        if (session.nextSlot?.type === 'break') {
            const nextBreakSlot = session.nextSlot;
            const breakDurationMs = nextBreakSlot.durationMinutes
                ? nextBreakSlot.durationMinutes * 60 * 1000
                : (timeToMinutes(nextBreakSlot.endTime) - timeToMinutes(nextBreakSlot.startTime)) * 60 * 1000;
            
            if (breakDurationMs > 0) {
                const newBreakSession: ActiveSession = {
                    startTime: Date.now(),
                    endTime: Date.now() + breakDurationMs,
                    subject: nextBreakSlot.activity,
                    type: ActivityType.BREAK,
                    fromSlot: nextBreakSlot,
                    nextSlot: null,
                };
                onStartBreak(newBreakSession);
            } else {
                addToast("Could not start break: invalid duration.", "error");
            }
        }
    };


    if (sessionComplete) {
        return <SessionCompleteModal 
            isOpen={sessionComplete}
            onNavigate={() => onExit()}
            onStartBreak={session.nextSlot?.type === 'break' ? handleStartBreakFromModal : undefined}
            session={session}
            wasTracked={!session.isUntracked}
        />
    }

    return (
        <>
            <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col">
                <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-lg">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            <BookIcon className="w-8 h-8 text-primary dark:text-primary-light" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                    {t('focusedStudy.title')}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {session.subject}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {isBreakTime ? (
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                        {t('focusedStudy.breakTime')}
                                    </div>
                                    <div className="text-lg text-orange-500 dark:text-orange-300">
                                        {formatTime(breakTimeRemaining)}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="flex items-center gap-2 text-2xl font-bold text-primary dark:text-primary-light">
                                        <ClockIcon className="w-6 h-6" />
                                        {formatTime(timeRemaining)}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {studyProgress.toFixed(0)}{t('focusedStudy.complete')}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <button onClick={togglePause} disabled={isBreakTime} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isStudyPaused ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200'} ${isBreakTime ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isStudyPaused ? <><PlayIcon className="w-4 h-4" />{t('focusedStudy.resume')}</> : <><PauseIcon className="w-4 h-4" />{t('focusedStudy.pause')}</>}
                                </button>

                                <button onClick={() => setShowExitConfirm(true)} className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all">
                                    <ExitIcon className="w-4 h-4" />{t('focusedStudy.exit')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2">
                        <div className="bg-primary h-2 transition-all duration-300" style={{ width: `${studyProgress}%` }} />
                    </div>
                </header>

                {showBreakActivity && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="text-6xl mb-4">☕</div>
                                <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">{t('focusedStudy.breakTime')}</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">Take a 5-minute break to recharge</p>
                                <div className="text-3xl font-bold text-orange-500">{formatTime(breakTimeRemaining)}</div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">{t('focusedStudy.break.watch')}</label>
                                    <input type="url" value={breakVideoUrl} onChange={(e) => setBreakVideoUrl(e.target.value)} placeholder={t('focusedStudy.break.placeholder')} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center"><div className="font-medium text-blue-600 dark:text-blue-400">{t('focusedStudy.break.stretch')}</div></div>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center"><div className="font-medium text-green-600 dark:text-green-400">{t('focusedStudy.break.hydrate')}</div></div>
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center"><div className="font-medium text-purple-600 dark:text-purple-400">{t('focusedStudy.break.air')}</div></div>
                                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center"><div className="font-medium text-orange-600 dark:text-orange-400">{t('focusedStudy.break.snack')}</div></div>
                                </div>
                                <button onClick={endBreak} className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all">{t('focusedStudy.resumeStudying')}</button>
                            </div>
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-800">
                    {isStudyPaused ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-6xl mb-4">⏸️</div>
                                <h3 className="text-2xl font-bold text-gray-600 dark:text-gray-400 mb-2">{t('focusedStudy.paused.title')}</h3>
                                <p className="text-gray-500 dark:text-gray-500 mb-6">{t('focusedStudy.paused.body')}</p>
                                <button onClick={togglePause} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all mx-auto">
                                    <PlayIcon className="w-5 h-5" />
                                    {t('focusedStudy.paused.button')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full w-full p-4">
                           <FileViewer file={learningHubFile} />
                        </div>
                    )}
                </main>
            </div>

            <ConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={onExit}
                title={t('confirmation.exitStudy.title')}
                message={t('confirmation.exitStudy.message', { subject: session.subject })}
                confirmText={t('confirmation.exitStudy.confirm')}
                cancelText={t('confirmation.exitStudy.cancel')}
                confirmColor="red"
            />
        </>
    );
};

export default FocusedStudyView;