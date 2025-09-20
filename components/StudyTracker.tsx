import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIX: Added .ts extension to import path.
import type { TrackedSession, ActiveSession, NotificationSettings } from '../types.ts';
// FIX: Added .ts extension to import path.
import { ActivityType } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';

interface StudyTrackerProps {
    activeSession: ActiveSession;
    setActiveSession: (session: ActiveSession | null) => void;
    onSessionCompleted: (session: ActiveSession, durationMinutes: number) => void;
    notificationSettings: NotificationSettings;
}

const StudyTracker: React.FC<StudyTrackerProps> = ({ activeSession, setActiveSession, onSessionCompleted, notificationSettings }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showInactivePrompt, setShowInactivePrompt] = useState(false);
    const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
    const [totalPausedTime, setTotalPausedTime] = useState(0); // Track total pause duration in ms
    const { t } = useLanguage();
    const notifiedSessionStartRef = useRef<number | null>(null);
    
    // Set timer when session changes
    useEffect(() => {
        const now = Date.now();
        if (activeSession.endTime > now) {
            const remaining = Math.round((activeSession.endTime - now) / 1000);
            setTimeLeft(remaining);
        } else {
             setTimeLeft(0);
        }
        // Reset pause state for new session
        setIsPaused(false);
        setPauseStartTime(null);
        setTotalPausedTime(0);
        
        // Send notification for the start of a new session.
        if (
            notificationSettings.enabled &&
            notificationSettings.sessionStart &&
            notifiedSessionStartRef.current !== activeSession.startTime
        ) {
            const title = activeSession.type === 'study' 
                ? t('notifications.sessionStartAlert.study.title') 
                : t('notifications.sessionStartAlert.break.title');
            
            const body = t('notifications.sessionStartAlert.body', { subject: activeSession.subject });

            new Notification(title, { body });
            notifiedSessionStartRef.current = activeSession.startTime;
        }

    }, [activeSession, notificationSettings, t]);

    // Main timer countdown logic
    useEffect(() => {
        if (isPaused || timeLeft <= 0) return;
        const interval = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [timeLeft, isPaused]);
    
    // Session end logic
    const endSession = useCallback((completed: boolean) => {
        if (completed) {
            const totalDurationWithPauses = activeSession.endTime - activeSession.startTime;
            const actualSessionDuration = totalDurationWithPauses - totalPausedTime;
            const durationMinutes = Math.round(actualSessionDuration / 60000);

            if (activeSession.type === 'study' && notificationSettings.enabled && notificationSettings.breakStartEnd) {
                 new Notification(t('studytracker.complete.study'), { body: t('studytracker.complete.studyBody') });
            } else if (activeSession.type === 'break' && notificationSettings.enabled && notificationSettings.breakStartEnd) {
                 new Notification(t('studytracker.complete.break'), { body: t('studytracker.complete.breakBody') });
            }
            
            onSessionCompleted(activeSession, Math.max(0, durationMinutes));

        } else {
             // If ended manually, just stop the session without tracking or transitioning.
            setActiveSession(null);
        }
    }, [activeSession, onSessionCompleted, setActiveSession, notificationSettings, t, totalPausedTime]);

    useEffect(() => {
        if (timeLeft <= 0 && activeSession.endTime <= Date.now()) {
            endSession(true);
        }
    }, [timeLeft, endSession, activeSession]);

    const resumeSession = () => {
        if (pauseStartTime) {
            const pauseDuration = Date.now() - pauseStartTime;
            setTotalPausedTime(prev => prev + pauseDuration);
            
            // Extend session end time by the pause duration
            const newEndTime = activeSession.endTime + pauseDuration;
            setActiveSession({ ...activeSession, endTime: newEndTime });

            setPauseStartTime(null);
        }
        setIsPaused(false);
    };

    const handleTogglePause = () => {
        if (isPaused) { // Resuming
            resumeSession();
        } else { // Pausing
            setPauseStartTime(Date.now());
            setIsPaused(true);
        }
    };

    // Inactivity prompt logic
    useEffect(() => {
        // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
        let inactivityTimer: ReturnType<typeof setTimeout>;
        if (activeSession.type === 'study' && !isPaused) {
            inactivityTimer = setTimeout(() => {
                setPauseStartTime(Date.now());
                setIsPaused(true);
                setShowInactivePrompt(true);
            }, 5 * 60 * 1000); // 5 minutes
        }
        return () => clearTimeout(inactivityTimer);
    }, [activeSession, isPaused]);
    
    const handleContinueStudying = () => {
        setShowInactivePrompt(false);
        resumeSession();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    const totalDuration = (activeSession.endTime - activeSession.startTime - totalPausedTime) / 1000;
    const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) : 0;
    
    return (
        <>
            <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-2xl rounded-lg w-80 p-4 z-50 border dark:border-gray-700 no-print">
                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path className="stroke-current text-gray-200 dark:text-gray-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="2"></path>
                            <path className="stroke-current text-blue-700 transform -rotate-90 origin-center"
                                strokeDasharray={`${progress * 100}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" strokeWidth="2.5" strokeLinecap="round"></path>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold">{formatTime(timeLeft)}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="font-bold capitalize">
                            {activeSession.type === 'study' ? t('studytracker.study') : t('studytracker.break')}: {activeSession.subject}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                           <button onClick={handleTogglePause} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-md">{isPaused ? t('studytracker.resume') : t('studytracker.pause')}</button>
                           <button onClick={() => endSession(false)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md">{t('common.end')}</button>
                        </div>
                    </div>
                </div>
            </div>
            {showInactivePrompt && (
                 <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 no-print">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg text-center">
                        <h3 className="text-xl font-bold mb-2">{t('studytracker.inactive.title')}</h3>
                        <p className="mb-4 text-gray-600 dark:text-gray-400">{t('studytracker.inactive.body')}</p>
                        <button onClick={handleContinueStudying} className="px-6 py-2 bg-blue-700 text-white rounded-md">{t('studytracker.inactive.confirm')}</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default StudyTracker;