import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ActiveSession, UploadedFile, Toast, TrackedSession } from '../types.ts';
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
import { CoffeeIcon } from './icons/CoffeeIcon.tsx';

interface FocusedStudyViewProps {
    session: ActiveSession;
    setSession: (session: ActiveSession | null) => void;
    learningHubFile: UploadedFile | null;
    onExit: () => void;
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    trackedData: TrackedSession[];
    setTrackedData: (data: TrackedSession[]) => void;
}

const FocusedStudyView: React.FC<FocusedStudyViewProps> = ({ session, setSession, learningHubFile, onExit, addToast, trackedData, setTrackedData }) => {
    const { t } = useLanguage();
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isStudyPaused, setIsStudyPaused] = useState(false);
    const [isBreakTime, setIsBreakTime] = useState(false);
    const [breakTimeRemaining, setBreakTimeRemaining] = useState(0);
    const [studyProgress, setStudyProgress] = useState(0);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [pauseTime, setPauseTime] = useState(0);
    const [currentBreakDuration, setCurrentBreakDuration] = useState(5);
    
    const timerRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAAAAQABAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBg==');
        playNotificationSound();
    }, []);

    const totalStudySeconds = useMemo(() => (session.durationMinutes || 0) * 60, [session.durationMinutes]);

    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (isStudyPaused) return;

        timerRef.current = setInterval(() => {
            const now = Date.now();
            
            if (isBreakTime) {
                setBreakTimeRemaining(prev => {
                    if (prev <= 1) {
                        endBreak();
                        return 0;
                    }
                    return prev - 1;
                });
            } else { // Is Study Time
                if (session.breakPlacement === 'during' && session.breakStartsAt && now >= session.breakStartsAt) {
                    startScheduledBreak();
                    return;
                }

                const timeUntilEnd = Math.max(0, Math.round((session.endTime - now) / 1000));
                
                let studyTimeRemaining = timeUntilEnd;
                if (session.breakPlacement === 'during' && session.nextSlot?.durationMinutes) {
                    if (now < (session.breakStartsAt || Infinity)) {
                        studyTimeRemaining -= session.nextSlot.durationMinutes * 60;
                    }
                }
                setTimeRemaining(Math.max(0, studyTimeRemaining));

                if (totalStudySeconds > 0) {
                    const studyTimeElapsed = totalStudySeconds - studyTimeRemaining;
                    setStudyProgress(Math.min(100, (studyTimeElapsed / totalStudySeconds) * 100));
                } else {
                    const totalSessionDuration = (session.endTime - session.startTime) / 1000;
                    if(totalSessionDuration > 0) {
                        const timeElapsed = totalSessionDuration - timeUntilEnd;
                        setStudyProgress(Math.min(100, (timeElapsed/totalSessionDuration) * 100));
                    } else {
                        setStudyProgress(timeUntilEnd <= 0 ? 100 : 0);
                    }
                }

                if (timeUntilEnd <= 0) {
                    handleSessionComplete();
                } else if (!session.nextSlot && totalStudySeconds > 0) {
                    const studyTimeElapsed = totalStudySeconds - studyTimeRemaining;
                    if (studyTimeElapsed > 0 && Math.round(studyTimeElapsed) % (25 * 60) === 0 && !isBreakTime) {
                        startPomodoroBreak();
                    }
                }
            }
        }, 1000) as unknown as number;

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isStudyPaused, isBreakTime, session, totalStudySeconds]);

    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
        }
    };

    const startPomodoroBreak = () => {
        setIsBreakTime(true);
        setCurrentBreakDuration(5);
        setBreakTimeRemaining(5 * 60);
        playNotificationSound();
        addToast(t('toasts.breakStarted', { duration: 5 }), 'info');
    };
    
    const startScheduledBreak = () => {
        if (!session.nextSlot || !session.nextSlot.durationMinutes) return;
        setIsBreakTime(true);
        setCurrentBreakDuration(session.nextSlot.durationMinutes);
        setBreakTimeRemaining(session.nextSlot.durationMinutes * 60);
        playNotificationSound();
        addToast(t('toasts.breakStarted', { duration: session.nextSlot.durationMinutes }), 'info');
        setSession({ ...session, breakStartsAt: undefined });
    };

    const endBreak = (skipped = false) => {
        setIsBreakTime(false);
        setBreakTimeRemaining(0);
        if (!skipped) {
            playNotificationSound();
            addToast(t('toasts.breakOver'), 'success');
        }
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
            if (!prev) { 
                if(timerRef.current) clearInterval(timerRef.current);
                setPauseTime(Date.now());
            } else { 
                const pausedDuration = Date.now() - pauseTime;
                setSession({ 
                    ...session, 
                    endTime: session.endTime + pausedDuration,
                    breakStartsAt: session.breakStartsAt ? session.breakStartsAt + pausedDuration : undefined
                });
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
        const breakDurationMs = (session.nextSlot?.durationMinutes || 0) * 60 * 1000;
        if (breakDurationMs <= 0) return;
        
        const newBreakSession: ActiveSession = {
            startTime: Date.now(),
            endTime: Date.now() + breakDurationMs,
            subject: session.nextSlot?.activity || 'Break',
            type: ActivityType.BREAK,
            fromSlot: session.nextSlot!,
            nextSlot: null,
        };
        onExit();
        setSession(newBreakSession);
    };


    if (sessionComplete) {
        return <SessionCompleteModal 
            isOpen={sessionComplete}
            onNavigate={() => onExit()}
            onStartBreak={session.breakPlacement === 'after' && session.nextSlot?.type === 'break' ? handleStartBreakFromModal : undefined}
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
                                        {(studyProgress || 0).toFixed(0)}{t('focusedStudy.complete')}
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
                        <div className="bg-primary h-2 transition-all duration-300" style={{ width: `${studyProgress || 0}%` }} />
                    </div>
                </header>

                {isBreakTime && (
                    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
                        <CoffeeIcon className="w-24 h-24 text-gray-300" />
                        <h3 className="text-5xl font-bold text-orange-400 mt-4 mb-2">{t('breakview.title')}</h3>
                        <p className="text-xl text-gray-300 mb-6">{t('focusedStudy.break.recharge', { duration: currentBreakDuration })}</p>
                        <div className="text-6xl font-bold text-orange-400 mb-8">{formatTime(breakTimeRemaining)}</div>
                        <button onClick={() => endBreak(true)} className="px-6 py-2 bg-gray-600/50 rounded-full hover:bg-gray-500/50 transition-colors">{t('breakview.skip')}</button>
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
