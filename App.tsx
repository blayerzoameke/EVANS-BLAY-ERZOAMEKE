
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Progression from './components/Progression';
import MyTimetables from './components/MyTimetables';
import ExamPrep from './components/ExamPrep';
import Notes from './components/Notes';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Help from './components/Help';
import About from './components/About';
import Feedback from './components/Feedback';
import Reports from './components/Reports';
import Language from './components/Language';
import NotificationSettings from './components/NotificationSettings';
import StudyTracker from './components/StudyTracker';
// FIX: Aliased NotificationSettings type to NotificationSettingsType to avoid conflict with the component name.
import type { SmartPlan, TrackedSession, UserDetails, StoredPlan, Note, NotificationSettings as NotificationSettingsType, ActiveSession, PlanSlot } from './types';
import { DayOfWeek, ActivityType } from './types';
import { DAYS_OF_WEEK } from './constants';

export type View = 
  'dashboard' | 'progression' | 'mytimetables' | 'examprep' | 'notes' | 
  'profile' | 'settings' | 'help' | 'about' | 'feedback' | 'notification' | 
  'report' | 'language' | 'theme' | 'terms' | 'library';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // App State
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [smartPlan, setSmartPlan] = useState<SmartPlan | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<StoredPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [trackedData, setTrackedData] = useState<TrackedSession[]>([]);

  // Notification & Session State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsType>({ status: 'unconfigured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [showSessionStartModal, setShowSessionStartModal] = useState<PlanSlot | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);


  // Load all data from localStorage on initial render
  useEffect(() => {
    const loadState = <T,>(key: string, setter: React.Dispatch<React.SetStateAction<T>>): void => {
      try {
        const savedValue = localStorage.getItem(key);
        if (savedValue) {
          setter(JSON.parse(savedValue));
        }
      } catch (error) {
        console.error(`Failed to load '${key}' from localStorage`, error);
      }
    };
    loadState('userDetails', setUserDetails);
    loadState('smartPlan', setSmartPlan);
    loadState('savedTimetables', setSavedTimetables);
    loadState('notes', setNotes);
    loadState('trackedData', setTrackedData);
    loadState('notificationSettings', setNotificationSettings);
  }, []);

  // Save data to localStorage whenever it changes
  const saveState = useCallback(<T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save '${key}' to localStorage`, error);
    }
  }, []);

  useEffect(() => { if (userDetails) saveState('userDetails', userDetails) }, [userDetails, saveState]);
  useEffect(() => { if (smartPlan) saveState('smartPlan', smartPlan) }, [smartPlan, saveState]);
  useEffect(() => { saveState('savedTimetables', savedTimetables) }, [savedTimetables, saveState]);
  useEffect(() => { saveState('notes', notes) }, [notes, saveState]);
  useEffect(() => { saveState('trackedData', trackedData) }, [trackedData, saveState]);
  useEffect(() => { saveState('notificationSettings', notificationSettings) }, [notificationSettings, saveState]);

  // Notification Scheduling Logic
  useEffect(() => {
    const checkSchedule = () => {
      if (!smartPlan || !notificationSettings.enabled || document.hidden || activeSession || showSessionStartModal) return;

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
      
      if (snoozeUntil && now.getTime() < snoozeUntil) return;

      const todayPlan = smartPlan.find(p => p.day === currentDay);
      if (!todayPlan) return;

      const timeToMinutes = (time: string): number => {
          const [timePart, period] = time.split(' ');
          let [hours, minutes] = timePart.split(':').map(Number);
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours * 60 + minutes;
      };

      for (const slot of todayPlan.slots) {
        if (slot.type === ActivityType.STUDY) {
          const startTime = timeToMinutes(slot.startTime);
          const reminderTime = startTime - notificationSettings.reminderTime;
          
          // Session start alert
          if (notificationSettings.sessionStart && currentTime === startTime) {
             setShowSessionStartModal(slot);
             return;
          }
          // Pre-session reminder
          if (notificationSettings.reminders && currentTime === reminderTime) {
            new Notification(`${notificationSettings.reminderTime} minute reminder`, {
              body: `Your study session for "${slot.activity}" is about to start.`,
            });
            return;
          }
        }
      }
    };

    const interval = setInterval(checkSchedule, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [smartPlan, notificationSettings, activeSession, showSessionStartModal, snoozeUntil]);

  const handleStartSession = (slot: PlanSlot) => {
    const now = Date.now();
    const timeToMinutes = (time: string): number => {
      const [timePart, period] = time.split(' ');
      let [hours, minutes] = timePart.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    const endTimeMinutes = timeToMinutes(slot.endTime);
    const date = new Date();
    date.setHours(Math.floor(endTimeMinutes / 60));
    date.setMinutes(endTimeMinutes % 60);

    setActiveSession({
      type: 'study',
      subject: slot.activity,
      startTime: now,
      endTime: date.getTime(),
      fromSlot: slot
    });
    setShowSessionStartModal(null);
  };
  
  const handleSnooze = () => {
      setSnoozeUntil(Date.now() + 5 * 60 * 1000); // Snooze for 5 minutes
      setShowSessionStartModal(null);
  };

  const handleSessionTracked = (session: TrackedSession) => {
    setTrackedData(prev => [...prev, session]);
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard 
          setSmartPlan={setSmartPlan} 
          smartPlan={smartPlan} 
          userDetails={userDetails}
          setUserDetails={setUserDetails} 
          savedTimetables={savedTimetables}
          setSavedTimetables={setSavedTimetables}
        />;
      case 'progression':
        return <Progression plan={smartPlan} trackedData={trackedData} />;
      case 'mytimetables':
        return <MyTimetables 
          savedTimetables={savedTimetables}
          setSavedTimetables={setSavedTimetables}
          onLoadPlan={(plan) => setSmartPlan(plan)} 
        />;
      case 'examprep':
        return <ExamPrep />;
      case 'notes':
        return <Notes notes={notes} setNotes={setNotes} />;
      case 'profile':
        return <Profile userDetails={userDetails} setUserDetails={setUserDetails} />;
      case 'notification':
        return <NotificationSettings settings={notificationSettings} setSettings={setNotificationSettings} />;
      case 'report':
          return <Reports userDetails={userDetails} />;
      // Placeholders for other views
      case 'language': return <Language />;
      case 'settings': return <Settings />;
      case 'help': return <Help />;
      case 'about': return <About />;
      case 'feedback': return <Feedback />;
      default:
        return <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md"><h2 className="text-2xl font-bold">Coming Soon</h2><p>This feature is under construction.</p></div>
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
      <Sidebar view={view} setView={setView} isOpen={isSidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
        {activeSession && (
            <StudyTracker 
                activeSession={activeSession}
                setActiveSession={setActiveSession}
                onSessionTracked={handleSessionTracked}
                notificationSettings={notificationSettings}
            />
        )}
        {showSessionStartModal && (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                    <h3 className="text-xl font-bold mb-2">Time to study!</h3>
                    <p className="mb-4">Your scheduled session for "{showSessionStartModal.activity}" is starting now.</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setShowSessionStartModal(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Dismiss</button>
                        <button onClick={handleSnooze} className="px-4 py-2 bg-yellow-500 text-white rounded-md">Snooze (5 min)</button>
                        <button onClick={() => handleStartSession(showSessionStartModal)} className="px-4 py-2 bg-green-600 text-white rounded-md">Track My Studies</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;
