import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { ActiveSession, UploadedFile, Toast, TrackedSession, LearningHubState, PlanSlot, View } from '../types.ts';
import { ActivityType } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { ExitIcon } from './icons/ExitIcon.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { ClockIcon } from './icons/ClockIcon.tsx';
import { BookIcon } from './icons/BookIcon.tsx';
import { CoffeeIcon } from './icons/CoffeeIcon.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import UploadSlides from './UploadSlides.tsx';
import SessionCompleteModal from './SessionCompleteModal.tsx';
import BreakView from './BreakView.tsx';
import { timeToMinutes } from '../lib/utils.ts';

interface FocusedStudyViewProps {
    session: ActiveSession;
    setSession: (session: ActiveSession | null) => void;
    learningHubFile: UploadedFile | null;
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    trackedData: TrackedSession[];
    setTrackedData: (data: TrackedSession[]) => void;
    setView: (view: View) => void;
    setLearningHubState: React.Dispatch<React.SetStateAction<LearningHubState>>;
}


const FocusedStudyView: React.FC<FocusedStudyViewProps> = ({ session, setSession, learningHubFile, addToast, trackedData, setTrackedData, setView, setLearningHubState }) => {
    const { t } = useLanguage();
    
    const totalDurationSeconds = useMemo(() => {
        const duration = session.endTime - session.startTime;
        return duration > 0 ? Math.round(duration / 1000) : 0;
    }, [session.startTime, session.endTime]);
    
    const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.round((session.endTime - Date.now()) / 1000)));
    const [isPaused, setIsPaused] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [isBreakActive, setIsBreakActive] = useState(false);
    const [breakTriggered, setBreakTriggered] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [sessionCompletedNaturally, setSessionCompletedNaturally] = useState(false);
    
    const pauseStartTimeRef = useRef<number>(0);

    const playRingtone = useCallback(() => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!audioContext) return;
        
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.frequency.value = 880; 
        gain1.gain.setValueAtTime(0, audioContext.currentTime);
        gain1.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.4);

        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1318.51; 
        gain2.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
        gain2.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.11);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc2.start(audioContext.currentTime + 0.1);
        osc2.stop(audioContext.currentTime + 0.5);
    }, []);

    useEffect(() => {
        playRingtone();
    }, [playRingtone]);

    const handleSessionEnd = useCallback((isEarlyTermination = false) => {
        if (isComplete) return; 
        setIsComplete(true);
        setSessionCompletedNaturally(!isEarlyTermination);
        playRingtone();

        if (!session.isUntracked) {
            const timeStudiedMs = isEarlyTermination ? (totalDurationSeconds - timeLeft) * 1000 : totalDurationSeconds * 1000;
            const durationMinutes = Math.round(timeStudiedMs / (1000 * 60));

            if (durationMinutes > 0) {
                const newLog: TrackedSession = {
                    subject: session.subject,
                    durationMinutes,
                    date: new Date().toISOString().split('T')[0],
                };
                setTrackedData([...(trackedData || []), newLog]);
            }
        }
    }, [isComplete, playRingtone, session, totalDurationSeconds, timeLeft, trackedData, setTrackedData]);

    const handleStartNextBreakEarly = () => {
        if (!session.nextSlot || session.nextSlot.type !== 'break') {
            addToast("No break scheduled next.", "info");
            return;
        }

        if (!session.isUntracked) {
            const timeStudiedMs = (totalDurationSeconds - timeLeft) * 1000;
            const durationMinutes = Math.round(timeStudiedMs / (1000 * 60));

            if (durationMinutes > 0) {
                const newLog: TrackedSession = {
                    subject: session.subject,
                    durationMinutes,
                    date: new Date().toISOString().split('T')[0],
                };
                setTrackedData([...(trackedData || []), newLog]);
                addToast(`Logged ${durationMinutes} minutes for ${session.subject}.`, 'success');
            }
        }

        const breakSlot = session.nextSlot;
        const breakDurationMinutes = breakSlot.durationMinutes || (timeToMinutes(breakSlot.endTime) - timeToMinutes(breakSlot.startTime));
        
        if (breakDurationMinutes <= 0) {
            addToast("Scheduled break has no duration.", "warning");
            setSession(null);
            return;
        }

        const now = Date.now();
        const breakSession: ActiveSession = {
            startTime: now,
            endTime: now + breakDurationMinutes * 60 * 1000,
            subject: breakSlot.activity,
            type: 'break',
            fromSlot: breakSlot,
            nextSlot: null,
            isUntracked: session.isUntracked,
            postBreakView: learningHubFile ? 'uploadslides' : undefined,
        };
        
        setSession(breakSession);
    };
    
    const handleStartScheduledBreak = () => {
        if (session.nextSlot && session.nextSlot.type === 'break') {
            const breakSlot = session.nextSlot;
            const breakDurationMinutes = breakSlot.durationMinutes || (timeToMinutes(breakSlot.endTime) - timeToMinutes(breakSlot.startTime));
            
            if (breakDurationMinutes <= 0) {
                addToast("Scheduled break has no duration.", "warning");
                setSession(null);
                return;
            }

            const now = Date.now();
            const breakSession: ActiveSession = {
                startTime: now,
                endTime: now + breakDurationMinutes * 60 * 1000,
                subject: breakSlot.activity,
                type: 'break',
                fromSlot: breakSlot,
                nextSlot: null,
                isUntracked: session.isUntracked,
                postBreakView: learningHubFile ? 'uploadslides' : undefined,
            };
            
            setSession(breakSession);
        }
    };

    const handleBreakEnd = useCallback((skipped?: boolean) => {
        if (skipped && session.breakPlacement === 'during' && session.nextSlot?.type === 'break' && session.breakStartsAt) {
            const breakDurationMs = (session.nextSlot.durationMinutes || 0) * 60 * 1000;
            if (breakDurationMs > 0) {
                const breakTimeUsedMs = Date.now() - session.breakStartsAt;
                const timeSavedMs = Math.max(0, breakDurationMs - breakTimeUsedMs);
                setSession({
                    ...session,
                    endTime: session.endTime - timeSavedMs
                });
            }
        }
        setIsBreakActive(false);
        playRingtone();
    }, [playRingtone, session, setSession]);


    useEffect(() => {
        if (isPaused || isComplete || isBreakActive) return;

        const timerId = setInterval(() => {
            const remaining = Math.round((session.endTime - Date.now()) / 1000);
            
            if (remaining <= 0) {
                clearInterval(timerId);
                handleSessionEnd(false);
                return;
            }
            setTimeLeft(remaining);

            if (session.breakPlacement === 'during' && session.breakStartsAt && !breakTriggered && Date.now() >= session.breakStartsAt) {
                setBreakTriggered(true);
                setIsBreakActive(true);
                playRingtone();
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [session.endTime, session.breakStartsAt, isPaused, isComplete, isBreakActive, breakTriggered, handleSessionEnd, playRingtone]);

    const togglePause = useCallback(() => {
        setIsPaused(prev => {
            if (!prev) {
                pauseStartTimeRef.current = Date.now();
                addToast(t('toasts.sessionPaused'), 'info');
            } else {
                const pausedDuration = Date.now() - pauseStartTimeRef.current;
                setSession({ 
                    ...session, 
                    endTime: session.endTime + pausedDuration,
                    breakStartsAt: session.breakStartsAt ? session.breakStartsAt + pausedDuration : undefined
                });
                addToast(t('toasts.sessionResumed'), 'success');
            }
            return !prev;
        });
    }, [addToast, t, session, setSession]);

    const breakSessionForView = useMemo((): ActiveSession | null => {
        if ((isBreakActive || (isComplete && session.breakPlacement === 'after')) && session.nextSlot?.type === 'break') {
            const durationMs = (session.nextSlot.durationMinutes || 10) * 60 * 1000;
            return {
                startTime: Date.now(),
                endTime: Date.now() + durationMs,
                subject: session.nextSlot.activity,
                type: 'break',
                fromSlot: session.nextSlot,
                nextSlot: null,
            };
        }
        return null;
    }, [isBreakActive, isComplete, session.breakPlacement, session.nextSlot]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const studyProgress = totalDurationSeconds > 0 ? ((totalDurationSeconds - timeLeft) / totalDurationSeconds) * 100 : 0;
    
    const dummySetState = () => {};
    const dummyLearningHubState: LearningHubState = {
        file: learningHubFile,
        analysisMode: 'none',
        analysisResults: { summarize: null, explain: null, read: null },
        chatHistory: [],
        isProcessing: false,
    };

    const handleNavigate = (target: 'dashboard' | 'uploadslides') => {
        setIsComplete(false);
        if (target === 'dashboard' && !session.isUntracked) {
             setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
        }
        setSession(null);
        setView(target);
    };

    if (isComplete) {
        return <SessionCompleteModal 
                    isOpen={isComplete} 
                    onNavigate={handleNavigate}
                    session={session} 
                    wasTracked={!session.isUntracked} 
                    onStartBreak={session.breakPlacement === 'after' && session.nextSlot?.type === 'break' ? handleStartScheduledBreak : undefined} 
               />;
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
                                    {session.subject} • {session.isUntracked ? t('focusedStudy.untracked') : t('focusedStudy.scheduled')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <div className="flex items-center gap-2 text-2xl font-bold text-primary dark:text-primary-light">
                                    <ClockIcon className="w-6 h-6" />
                                    {formatTime(timeLeft)}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {studyProgress.toFixed(0)}{t('focusedStudy.complete')}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={togglePause} disabled={isBreakActive} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isPaused ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200'} disabled:opacity-50`}>
                                    {isPaused ? <><PlayIcon className="w-4 h-4" />{t('focusedStudy.resume')}</> : <><PauseIcon className="w-4 h-4" />{t('focusedStudy.pause')}</>}
                                </button>
                                {session.breakPlacement === 'during' && session.nextSlot?.type === 'break' && (
                                    <button
                                        onClick={handleStartNextBreakEarly}
                                        disabled={isBreakActive}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 disabled:opacity-50"
                                        title={`Start your '${session.nextSlot.activity}' break now`}
                                    >
                                        <CoffeeIcon className="w-4 h-4" /> Start Break
                                    </button>
                                )}
                                <button onClick={() => setShowExitConfirm(true)} className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all">
                                    <ExitIcon className="w-4 h-4" />
                                    {t('focusedStudy.exit')}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2">
                        <div className="bg-primary h-2 transition-all duration-300" style={{ width: `${studyProgress}%` }} />
                    </div>
                </header>

                <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-800 p-4">
                     {isPaused ? (
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
                    ) : learningHubFile ? (
                        <UploadSlides
                            smartPlan={null}
                            setSmartPlan={dummySetState as any}
                            activeSession={session}
                            setActiveSession={setSession}
                            setView={setView}
                            addToast={addToast}
                            learningHubState={dummyLearningHubState}
                            setLearningHubState={setLearningHubState}
                            notes={[]}
                            setNotes={dummySetState as any}
                            showTitle={false}
                            isStudyModeView={true}
                            intendedStudyContext={null}
                            setIntendedStudyContext={dummySetState as any}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-center text-gray-500 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                            <div className="p-8">
                                <BookIcon className="w-20 h-20 mx-auto text-gray-400 dark:text-gray-500 mb-6" />
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                    {t('focusedStudy.focusMode.title')}
                                </h3>
                                <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                                    {session.subject}
                                </p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-12 italic">
                                    "{t('focusedStudy.focusMode.quote')}"
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {isBreakActive && breakSessionForView && (
                <BreakView session={breakSessionForView} onEnd={handleBreakEnd} />
            )}

            <ConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={() => { handleSessionEnd(true); }}
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