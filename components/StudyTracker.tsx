import React, { useState, useEffect, useCallback } from 'react';
import type { TrackedSession, ActiveSession, NotificationSettings } from '../types';
import { ActivityType } from '../types';

interface StudyTrackerProps {
    activeSession: ActiveSession;
    setActiveSession: (session: ActiveSession | null) => void;
    onSessionTracked: (session: TrackedSession) => void;
    notificationSettings: NotificationSettings;
}

const StudyTracker: React.FC<StudyTrackerProps> = ({ activeSession, setActiveSession, onSessionTracked, notificationSettings }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showInactivePrompt, setShowInactivePrompt] = useState(false);
    
    // Set timer when session changes
    useEffect(() => {
        const remaining = Math.round((activeSession.endTime - Date.now()) / 1000);
        setTimeLeft(remaining > 0 ? remaining : 0);
        setIsPaused(false);
    }, [activeSession]);

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
        if (completed && activeSession.type === 'study') {
            const durationMinutes = Math.round((Date.now() - activeSession.startTime) / 60000);
            onSessionTracked({
                subject: activeSession.subject,
                durationMinutes: durationMinutes,
                date: new Date().toISOString().split('T')[0]
            });
            
             if (notificationSettings.enabled && notificationSettings.breakStartEnd) {
                new Notification("Study session complete!", { body: "Time to take a well-deserved break." });
            }

            // Transition to break if there is one
            const nextBreakSlot = { activity: 'Break', startTime: '', endTime: '', type: ActivityType.BREAK }; // Simplified
            setActiveSession({
                type: 'break',
                subject: 'Break',
                startTime: Date.now(),
                endTime: Date.now() + 10 * 60 * 1000, // Default 10 min break
                fromSlot: nextBreakSlot,
            });

        } else {
             if (activeSession.type === 'break' && notificationSettings.enabled && notificationSettings.breakStartEnd) {
                new Notification("Break's over!", { body: "Time to get back to studying." });
            }
            setActiveSession(null);
        }
    }, [activeSession, onSessionTracked, setActiveSession, notificationSettings]);

    useEffect(() => {
        if (timeLeft <= 0) {
            endSession(true);
        }
    }, [timeLeft, endSession]);

    // Inactivity prompt logic
    useEffect(() => {
        let inactivityTimer: NodeJS.Timeout;
        if (activeSession.type === 'study' && !isPaused) {
            inactivityTimer = setTimeout(() => {
                setIsPaused(true);
                setShowInactivePrompt(true);
            }, 5 * 60 * 1000); // 5 minutes
        }
        return () => clearTimeout(inactivityTimer);
    }, [activeSession, isPaused]);
    
    const handleContinueStudying = () => {
        setShowInactivePrompt(false);
        setIsPaused(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    const totalDuration = (activeSession.endTime - activeSession.startTime) / 1000;
    const progress = (totalDuration - timeLeft) / totalDuration;
    
    return (
        <>
            <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-2xl rounded-lg w-80 p-4 z-50 border dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path className="stroke-current text-gray-200 dark:text-gray-600" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="2"></path>
                            <path className="stroke-current text-indigo-600 transform -rotate-90 origin-center"
                                strokeDasharray={`${progress * 100}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none" strokeWidth="2.5" strokeLinecap="round"></path>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold">{formatTime(timeLeft)}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="font-bold capitalize">{activeSession.type}: {activeSession.subject}</p>
                        <div className="flex items-center gap-2 mt-2">
                           <button onClick={() => setIsPaused(!isPaused)} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-md">{isPaused ? 'Resume' : 'Pause'}</button>
                           <button onClick={() => endSession(false)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md">End</button>
                        </div>
                    </div>
                </div>
            </div>
            {showInactivePrompt && (
                 <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg text-center">
                        <h3 className="text-xl font-bold mb-2">Are you still studying?</h3>
                        <p className="mb-4 text-gray-600 dark:text-gray-400">We've paused the timer for you.</p>
                        <button onClick={handleContinueStudying} className="px-6 py-2 bg-indigo-600 text-white rounded-md">Yes, I'm here</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default StudyTracker;
