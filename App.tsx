import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Progression from './components/Progression';
import UploadSlides from './components/UploadSlides';
import ExamPrep from './components/ExamPrep';
import MyTimetables from './components/MyTimetables';
import Notes from './components/Notes';
// FIX: Added .tsx extension to component imports to resolve module errors.
import Profile from './components/Profile.tsx';
import NotificationSettingsComponent from './components/NotificationSettings';
import LanguageSettings from './components/Language';
import ThemeSettings from './components/Theme';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Feedback from './components/Feedback';
import Help from './components/Help';
import About from './components/About';
// FIX: Added .tsx extension to component imports to resolve module errors.
import Onboarding from './components/Onboarding.tsx';
import StudyTracker from './components/StudyTracker';
import FocusedStudyView from './components/FocusedStudyView';
import BreakView from './components/BreakView';
import ToastContainer from './components/ToastContainer';
import Library from './components/Library';
import Terms from './components/Terms';

import type { 
    UserDetails, 
    SmartPlan, 
    StoredPlan, 
    Note, 
    NotificationSettings,
    AppSettings,
    ActiveSession,
    TrackedSession,
    Toast,
    LearningHubState,
} from './types.ts';
import { ActivityType } from './types.ts';
import { useTheme } from './contexts/ThemeContext';
import { DAYS_OF_WEEK } from './constants.ts';

// This is the View type that other components are trying to import.
export type View =
  | 'dashboard'
  | 'progression'
  | 'uploadslides'
  | 'examprep'
  | 'mytimetables'
  | 'notes'
  | 'profile'
  | 'notification'
  | 'language'
  | 'theme'
  | 'settings'
  | 'report'
  | 'feedback'
  | 'help'
  | 'about'
  | 'library'
  | 'terms';

// Custom hook for using localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}

const App: React.FC = () => {
    const [view, setView] = useLocalStorage<View>('view', 'dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [userDetails, setUserDetails] = useLocalStorage<UserDetails | null>('userDetails', null);
    const [smartPlan, setSmartPlan] = useLocalStorage<SmartPlan | null>('smartPlan', null);
    const [savedTimetables, setSavedTimetables] = useLocalStorage<StoredPlan[]>('savedTimetables', []);
    const [notes, setNotes] = useLocalStorage<Note[]>('notes', []);
    const [notificationSettings, setNotificationSettings] = useLocalStorage<NotificationSettings>('notificationSettings', { status: 'unconfigured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
    const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('appSettings', {});
    const [activeSession, setActiveSession] = useLocalStorage<ActiveSession | null>('activeSession', null);
    const [trackedData, setTrackedData] = useLocalStorage<TrackedSession[]>('trackedData', []);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [learningHubState, setLearningHubState] = useLocalStorage<LearningHubState>('learningHubState', { file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] });
    
    const { theme } = useTheme(); // To force re-render on theme change for any components that need it

    const sentRemindersRef = useRef<{ date: string; reminders: Set<string> }>({
        date: new Date().toISOString().split('T')[0],
        reminders: new Set<string>(),
    });

    const addToast = useCallback((message: string, type: Toast['type']) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };
    
    const timeToMinutes = useCallback((time: string): number => {
      if (!time || !time.includes(':')) return 0;
      try {
          const timeParts = time.split(' ');
          const [hourStr, minuteStr] = timeParts[0].split(':');
          let hours = parseInt(hourStr, 10);
          const minutes = parseInt(minuteStr, 10);

          if (timeParts.length > 1 && timeParts[1].toUpperCase() === 'PM' && hours !== 12) {
              hours += 12;
          }
          if (timeParts.length > 1 && timeParts[1].toUpperCase() === 'AM' && hours === 12) {
              hours = 0; // Midnight case
          }
          return hours * 60 + minutes;
      } catch {
          return 0;
      }
    }, []);

    const handleSessionCompleted = (session: ActiveSession, durationMinutes: number) => {
        if (session.type === 'study' && !session.isUntracked) {
             const newTrackedSession: TrackedSession = {
                subject: session.subject,
                durationMinutes,
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            };
            setTrackedData([...trackedData, newTrackedSession]);
        }

        if (session.nextSlot) {
            const now = Date.now();
            const duration = timeToMinutes(session.nextSlot.endTime) - timeToMinutes(session.nextSlot.startTime);
            const endTime = now + (duration * 60 * 1000);
            
            setActiveSession({
                startTime: now,
                endTime: endTime,
                subject: session.nextSlot.activity,
                type: session.nextSlot.type === ActivityType.BREAK ? 'break' : 'study',
                fromSlot: session.nextSlot,
                nextSlot: null, // Don't chain beyond one break
                isLearningHubSession: session.isLearningHubSession,
                originalStudySubject: session.subject, // Pass original study subject
            });
        } else if (session.type === 'break' && session.isLearningHubSession) {
            const now = Date.now();
            setActiveSession({
                startTime: now,
                subject: session.originalStudySubject || 'Study Material',
                type: 'postBreakView',
                fromSlot: session.fromSlot,
                nextSlot: null,
                isLearningHubSession: true,
            });
        } else {
            setActiveSession(null);
        }
    };
    
    useEffect(() => {
        // This effect handles scheduled notifications for session reminders
        if (!smartPlan || !notificationSettings.enabled || !notificationSettings.reminders) return;

        const checkSchedule = () => {
             if (Notification.permission !== 'granted') {
                return; // Can't send notifications if permission is not granted
            }

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            // Reset the set of sent reminders if the day has changed
            if (sentRemindersRef.current.date !== todayStr) {
                sentRemindersRef.current = { date: todayStr, reminders: new Set<string>() };
            }
            
            // Monday is 0 in our DAYS_OF_WEEK array, but 1 in getDay(), Sunday is 6 and 0 respectively
            const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
            const currentDayOfWeek = DAYS_OF_WEEK[dayIndex];
            
            const todayPlan = smartPlan.find(dayPlan => dayPlan.day === currentDayOfWeek);
            if (!todayPlan) return;
            
            const reminderMinutes = notificationSettings.reminderTime;

            todayPlan.slots.forEach(slot => {
                // Only send reminders for study sessions and lectures
                if (slot.type !== ActivityType.STUDY && slot.type !== ActivityType.LECTURE) {
                    return;
                }

                const slotTimeInMinutes = timeToMinutes(slot.startTime);
                // A basic check to avoid acting on a failed parse from timeToMinutes
                if (slotTimeInMinutes === 0 && !slot.startTime.startsWith("12:00 AM")) return;

                const slotStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(slotTimeInMinutes / 60), slotTimeInMinutes % 60);
                
                // Calculate the exact time the reminder should be sent
                const reminderTime = new Date(slotStartDate.getTime() - reminderMinutes * 60 * 1000);
                
                // A unique ID for this specific reminder on this day to prevent duplicates
                const reminderId = `${todayPlan.day}-${slot.startTime}-${slot.activity}`;
                
                // Check if the current time matches the reminder time (to the minute)
                // and if we haven't already sent this reminder today
                if (
                    now.getHours() === reminderTime.getHours() &&
                    now.getMinutes() === reminderTime.getMinutes() &&
                    !sentRemindersRef.current.reminders.has(reminderId)
                ) {
                    const title = slot.type === ActivityType.STUDY ? `Upcoming Study Session` : `Upcoming Lecture`;
                    const body = `'${slot.activity}' starts in ${reminderMinutes} minutes.`;

                    new Notification(title, { body });
                    
                    // Mark this reminder as sent for today
                    sentRemindersRef.current.reminders.add(reminderId);
                }
            });
        };

        const interval = setInterval(checkSchedule, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [smartPlan, notificationSettings, timeToMinutes]);

    const handleOnboardingComplete = (details: UserDetails) => {
        setUserDetails(details);
        addToast('Profile saved! Welcome to EduBlay.', 'success');
    };
    
    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <Dashboard 
                    setSmartPlan={setSmartPlan} 
                    smartPlan={smartPlan} 
                    userDetails={userDetails!} 
                    setUserDetails={setUserDetails} 
                    savedTimetables={savedTimetables} 
                    setSavedTimetables={setSavedTimetables} 
                    addToast={addToast}
                    setActiveSession={setActiveSession}
                    trackedData={trackedData}
                    setTrackedData={setTrackedData}
                />;
            case 'progression':
                return <Progression plan={smartPlan} trackedData={trackedData} />;
            case 'uploadslides':
                return <UploadSlides smartPlan={smartPlan} setSmartPlan={setSmartPlan} activeSession={activeSession} setActiveSession={setActiveSession} setView={setView} addToast={addToast} learningHubState={learningHubState} setLearningHubState={setLearningHubState} notes={notes} setNotes={setNotes} showTitle={true} />;
            case 'examprep':
                return <ExamPrep addToast={addToast} setView={setView} />;
            case 'mytimetables':
                return <MyTimetables savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} onLoadPlan={(plan) => { setSmartPlan(plan); setView('dashboard'); }} />;
            case 'notes':
                return <Notes notes={notes} setNotes={setNotes} />;
            case 'profile':
                return <Profile userDetails={userDetails} setUserDetails={setUserDetails} addToast={addToast} />;
            case 'notification':
                return <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />;
            case 'language':
                return <LanguageSettings />;
            case 'theme':
                return <ThemeSettings />;
            case 'settings':
                return <Settings notificationSettings={notificationSettings} setNotificationSettings={setNotificationSettings} />;
            case 'report':
                return <Reports userDetails={userDetails} />;
            case 'feedback':
                return <Feedback />;
            case 'help':
                return <Help setView={setView} />;
            case 'about':
                return <About />;
            case 'library':
                return <Library />;
            case 'terms':
                return <Terms />;
            default:
                return <div>Not implemented</div>;
        }
    };

    const renderContent = () => {
        if (!userDetails) {
            return <Onboarding onComplete={handleOnboardingComplete} addToast={addToast} />;
        }
        
        if (activeSession?.isLearningHubSession) {
            return <FocusedStudyView session={activeSession} learningHubFile={learningHubState.file} onExit={() => setActiveSession(null)} addToast={addToast} />;
        }
        
        if (activeSession?.type === 'break' && activeSession.fromSlot.link) {
            return <BreakView session={activeSession} />;
        }

        return (
            <div className={`flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 theme-${theme}`}>
                <Sidebar view={view} setView={setView} isOpen={isSidebarOpen} setOpen={setSidebarOpen} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} userDetails={userDetails} setView={setView} addToast={addToast} />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
                        {renderView()}
                    </main>
                </div>
            </div>
        );
    };

    return (
        <>
            {renderContent()}
            {activeSession && (activeSession.type === 'study' || activeSession.type === 'break') && <StudyTracker activeSession={activeSession} setActiveSession={setActiveSession} onSessionCompleted={handleSessionCompleted} notificationSettings={notificationSettings} />}
            <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </>
    );
};

export default App;
