
import React, { useState, useEffect } from 'react';
import type { ActiveSession, Toast } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { StopIcon } from './icons/StopIcon';
import SessionCompleteModal from './SessionCompleteModal.tsx';
import { TrackedSession } from '../types.ts';

interface StudyTrackerProps {
  session: ActiveSession;
  setSession: (session: ActiveSession | null) => void;
  addToast: (message: string, type: Toast['type']) => void;
  trackedData: TrackedSession[];
  setTrackedData: (data: TrackedSession[]) => void;
}

const StudyTracker: React.FC<StudyTrackerProps> = ({ session, setSession, addToast, trackedData, setTrackedData }) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(Math.round((session.endTime - Date.now()) / 1000));
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [pauseTime, setPauseTime] = useState(0);

  useEffect(() => {
    if (isPaused || isComplete) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSessionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isComplete, session.endTime]);
  
  const handleSessionEnd = () => {
    setIsComplete(true);
    if (!session.isUntracked) {
      const durationMinutes = Math.round((session.endTime - session.startTime) / (1000 * 60));
      const newLog: TrackedSession = {
        subject: session.subject,
        durationMinutes,
        date: new Date().toISOString().split('T')[0],
      };
      setTrackedData([...(trackedData || []), newLog]);
    }
    
    // Auto transition to break if one is scheduled
    if (session.nextSlot && session.nextSlot.type === 'break') {
        const breakDurationMs = (new Date(`1970-01-01T${session.nextSlot.endTime}`).getTime() - new Date(`1970-01-01T${session.nextSlot.startTime}`).getTime());
        const newBreakSession: ActiveSession = {
            startTime: Date.now(),
            endTime: Date.now() + breakDurationMs,
            subject: session.nextSlot.activity,
            type: 'break',
            fromSlot: session.nextSlot,
            nextSlot: null,
        };
        setSession(newBreakSession);
    }
  };

  const handlePauseToggle = () => {
    setIsPaused(prev => {
      if (!prev) { // Pausing
        setPauseTime(Date.now());
      } else { // Resuming
        const newEndTime = session.endTime + (Date.now() - pauseTime);
        setSession({ ...session, endTime: newEndTime });
      }
      return !prev;
    });
  };

  const handleStop = () => {
    if (window.confirm("Are you sure you want to end this session early?")) {
        handleSessionEnd();
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((session.endTime - session.startTime - timeLeft * 1000) / (session.endTime - session.startTime)) * 100;

  const handleModalClose = (target: 'dashboard' | 'hub') => {
      setIsComplete(false);
      setSession(null);
      // setView is not available here, but App.tsx will handle the view change.
  }

  if (isComplete) {
      return <SessionCompleteModal isOpen={isComplete} onClose={handleModalClose} session={session} wasTracked={!session.isUntracked} />;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-2xl rounded-xl w-80 p-4 border dark:border-gray-700 z-50 no-print">
      <h3 className="font-bold text-lg">{t('studytracker.title')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{session.subject}</p>

      <div className="text-center my-4">
        <span className="text-5xl font-mono font-bold">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
      </div>
      
      <div className="flex justify-center items-center gap-4">
        <button onClick={handlePauseToggle} className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500" title={isPaused ? "Resume" : "Pause"}>
            {isPaused ? <PlayIcon className="w-6 h-6" /> : <PauseIcon className="w-6 h-6" />}
        </button>
        <button onClick={handleStop} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600" title="Stop Session">
            <StopIcon className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
};

export default StudyTracker;