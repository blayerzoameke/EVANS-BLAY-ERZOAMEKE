

import React, { useState, useEffect, useRef } from 'react';
import type { ActiveSession, Toast, LearningHubState, UploadedFile } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { ExitIcon } from './icons/ExitIcon';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { ClockIcon } from './icons/ClockIcon';
import { BookIcon } from './icons/BookIcon';
import UploadSlides from './UploadSlides.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface FocusedStudyViewProps {
    session: ActiveSession;
    learningHubFile: UploadedFile | null;
    onExit: () => void;
    addToast: (message: string, type: Toast['type']) => void;
}

const FocusedStudyView: React.FC<FocusedStudyViewProps> = ({ session, learningHubFile, onExit, addToast }) => {
    const { t } = useLanguage();
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const totalDurationSeconds = session.durationMinutes ? session.durationMinutes * 60 : (session.endTime - session.startTime) / 1000;
    const initialTimeRemaining = Math.max(0, Math.round((session.endTime - Date.now()) / 1000));

    const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining);
    const [isStudyPaused, setIsStudyPaused] = useState(false);
    const [isBreakTime, setIsBreakTime] = useState(false);
    const [breakTimeRemaining, setBreakTimeRemaining] = useState(0);
    const [studyProgress, setStudyProgress] = useState(0);
    const [showBreakActivity, setShowBreakActivity] = useState(false);
    const [breakVideoUrl, setBreakVideoUrl] = useState('');
    
    // FIX: Changed NodeJS.Timeout to number for browser compatibility.
    const timerRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio notification
    useEffect(() => {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBjiS2fDKeywFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaBg==');
        playNotificationSound();
    }, []);

    // Timer logic
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (isStudyPaused) return;

        if (isBreakTime) {
            // FIX: Cast setInterval return value to 'any' to satisfy browser and Node type differences.
            timerRef.current = setInterval(() => {
                setBreakTimeRemaining(prev => {
                    if (prev <= 1) {
                        endBreak();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000) as any;
        } else { // Is Study Time
             // FIX: Cast setInterval return value to 'any' to satisfy browser and Node type differences.
             timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        handleSessionComplete();
                        return 0;
                    }
                     const elapsed = totalDurationSeconds - prev + 1;
                    setStudyProgress((elapsed / totalDurationSeconds) * 100);
                    
                    // Pomodoro-style break check (25 min study, 5 min break)
                    if (elapsed > 0 && elapsed % (25 * 60) === 0) {
                        startBreak();
                    }

                    return prev - 1;
                });
            }, 1000) as any;
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isStudyPaused, isBreakTime, totalDurationSeconds]);

    const startBreak = () => {
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
        // TODO: Automatically log session data
        onExit();
    };

    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
        }
    };

    const togglePause = () => {
        setIsStudyPaused(prev => !prev);
        addToast(isStudyPaused ? t('toasts.sessionResumed') : t('toasts.sessionPaused'), 'info');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // FIX: Added dummy function and props for UploadSlides component.
    const dummySetState = () => {};
    const dummyLearningHubState: LearningHubState = {
        file: learningHubFile,
        analysisMode: 'none',
        analysisResults: { summarize: null, explain: null, read: null },
        chatHistory: [],
        isProcessing: false,
    };

    return (
        <>
            <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex flex-col">
                {/* Enhanced Header with Timer */}
                <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-lg">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            <BookIcon className="w-8 h-8 text-primary dark:text-primary-light" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                    {t('focusedStudy.title')}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {session.subject} • {session.isUntracked ? t('focusedStudy.untracked') : t('focusedStudy.scheduled')}
                                </p>
                            </div>
                        </div>

                        {/* Timer Display */}
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

                            {/* Controls */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={togglePause}
                                    disabled={isBreakTime}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                        isStudyPaused 
                                            ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200'
                                            : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200'
                                    } ${isBreakTime ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isStudyPaused ? (
                                        <>
                                            <PlayIcon className="w-4 h-4" />
                                            {t('focusedStudy.resume')}
                                        </>
                                    ) : (
                                        <>
                                            <PauseIcon className="w-4 h-4" />
                                            {t('focusedStudy.pause')}
                                        </>
                                    )}
                                </button>

                                <button 
                                    onClick={() => setShowExitConfirm(true)}
                                    className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all"
                                >
                                    <ExitIcon className="w-4 h-4" />
                                    {t('focusedStudy.exit')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2">
                        <div 
                            className="bg-primary h-2 transition-all duration-300"
                            style={{ width: `${studyProgress}%` }}
                        />
                    </div>
                </header>

                {/* Break Activity Overlay */}
                {showBreakActivity && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="text-6xl mb-4">☕</div>
                                <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                                    {t('focusedStudy.breakTime')}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Take a 5-minute break to recharge
                                </p>
                                <div className="text-3xl font-bold text-orange-500">
                                    {formatTime(breakTimeRemaining)}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        {t('focusedStudy.break.watch')}
                                    </label>
                                    <input
                                        type="url"
                                        value={breakVideoUrl}
                                        onChange={(e) => setBreakVideoUrl(e.target.value)}
                                        placeholder={t('focusedStudy.break.placeholder')}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    />
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

                {/* Main Study Content */}
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
                            <UploadSlides
                                smartPlan={null}
                                setSmartPlan={dummySetState as any}
                                activeSession={session}
                                setActiveSession={dummySetState as any}
                                setView={dummySetState as any}
                                addToast={addToast}
                                learningHubState={dummyLearningHubState}
                                setLearningHubState={dummySetState as any}
                                notes={[]}
                                setNotes={dummySetState as any}
                                showTitle={false}
                                isStudyModeView={true}
                                intendedStudyContext={null}
                                setIntendedStudyContext={dummySetState as any}
                            />
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
