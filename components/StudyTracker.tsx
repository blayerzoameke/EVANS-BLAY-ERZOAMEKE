import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ActiveSession, Toast, TrackedSession } from '../types.ts';
import type { View } from '../App.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { StopIcon } from './icons/StopIcon.tsx';
import SessionCompleteModal from './SessionCompleteModal.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';
import { DraggableIcon } from './icons/DraggableIcon.tsx';

interface StudyTrackerProps {
  session: ActiveSession;
  setSession: (session: ActiveSession | null) => void;
  addToast: (message: string, type: Toast['type']) => void;
  trackedData: TrackedSession[];
  setTrackedData: (data: TrackedSession[]) => void;
  setView: (view: View) => void;
}

const StudyTracker: React.FC<StudyTrackerProps> = ({ session, setSession, addToast, trackedData, setTrackedData, setView }) => {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(Math.round((session.endTime - Date.now()) / 1000));
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [pauseTime, setPauseTime] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [sessionCompletedNaturally, setSessionCompletedNaturally] = useState(false);

  // For dragging functionality
  const trackerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    if (trackerRef.current) {
        trackerRef.current.style.cursor = 'grabbing';
    }
    e.preventDefault();
  }, []);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        setPosition(prevPos => ({
            x: prevPos.x + dx,
            y: prevPos.y + dy,
        }));

        dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (trackerRef.current) {
            trackerRef.current.style.cursor = 'default';
        }
    };

    if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
}, [isDragging]);


  const handleSessionEnd = (isEarlyTermination = false) => {
    setIsComplete(true);
    setSessionCompletedNaturally(!isEarlyTermination);

    if (!session.isUntracked) {
      const totalDurationMs = session.endTime - session.startTime;
      const remainingTimeMs = isEarlyTermination ? timeLeft * 1000 : 0;
      const durationStudiedMs = totalDurationMs - remainingTimeMs;

      const durationMinutes = Math.round(durationStudiedMs / (1000 * 60));

      if (durationMinutes > 0) {
        const newLog: TrackedSession = {
          subject: session.subject,
          durationMinutes,
          date: new Date().toISOString().split('T')[0],
        };
        setTrackedData([...(trackedData || []), newLog]);
      }
    }
  };
  
  useEffect(() => {
    if (isPaused || isComplete) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSessionEnd(false); // Natural completion
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isComplete, session.endTime]);
  
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
    setShowStopConfirm(true);
  };
  
  const confirmStop = () => {
      setShowStopConfirm(false);
      handleSessionEnd(true); // Early termination
  };
  
  const handleStartBreak = () => {
    setIsComplete(false);
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

  const handleNavigate = (target: 'dashboard' | 'uploadslides') => {
    setIsComplete(false);
    setSession(null);
    setView(target);
  };


  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((session.endTime - session.startTime - timeLeft * 1000) / (session.endTime - session.startTime)) * 100;


  if (isComplete) {
      return <SessionCompleteModal 
                isOpen={isComplete} 
                onNavigate={handleNavigate}
                onStartBreak={sessionCompletedNaturally && session.nextSlot?.type === 'break' ? handleStartBreak : undefined}
                session={session} 
                wasTracked={!session.isUntracked} 
              />;
  }

  return (
    <>
        <div 
          ref={trackerRef}
          className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-2xl rounded-xl w-72 p-3 border dark:border-gray-700 z-50 no-print"
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
          <div onMouseDown={handleMouseDown} className="cursor-grab relative pb-2">
              <h3 className="font-bold text-base pr-6">{t('studytracker.title')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 pr-6 truncate">{session.subject}</p>
              <div className="absolute top-0 right-0 text-gray-400 p-1">
                 <DraggableIcon className="w-5 h-5" />
              </div>
          </div>


          <div className="text-center my-2">
            <span className="text-4xl font-mono font-bold">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
          
          <div className="flex justify-center items-center gap-4">
            <button onClick={handlePauseToggle} className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500" title={isPaused ? t('studytracker.resume' as any) : t('studytracker.pause' as any)}>
                {isPaused ? <PlayIcon className="w-6 h-6" /> : <PauseIcon className="w-6 h-6" />}
            </button>
            <button onClick={handleStop} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600" title={t('studytracker.stop' as any)}>
                <StopIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <ConfirmationModal
            isOpen={showStopConfirm}
            onClose={() => setShowStopConfirm(false)}
            onConfirm={confirmStop}
            title={t('confirmation.endSession.title')}
            message={t('confirmation.endSession.message')}
            confirmText={t('confirmation.endSession.confirm')}
            confirmColor="red"
        />
    </>
  );
};

export default StudyTracker;