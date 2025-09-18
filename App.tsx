import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Progression from './components/Progression';
import ExamPrep from './components/ExamPrep';
import MyTimetables from './components/MyTimetables';
import Notes from './components/Notes';
import Profile from './components/Profile';
import NotificationSettingsComponent from './components/NotificationSettings';
import Reports from './components/Reports';
import LanguageSettings from './components/Language';
import ThemeSettings from './components/Theme';
import Library from './components/Library.tsx';
import Terms from './components/Terms.tsx';
import Settings from './components/Settings.tsx';
import Feedback from './components/Feedback.tsx';
import Help from './components/Help.tsx';
import About from './components/About';
import StudyTracker from './components/StudyTracker';
import UploadSlides from './components/UploadSlides.tsx';
import BreakView from './components/BreakView.tsx';
import FocusedStudyView from './components/FocusedStudyView.tsx';
import ToastContainer from './components/ToastContainer.tsx';


import type { UserDetails, SmartPlan, StoredPlan, Note, NotificationSettings, ActiveSession, TrackedSession, AppSettings, Toast } from './types.ts';
import { ActivityType } from './types.ts';

export type View = 'dashboard' | 'progression' | 'uploadslides' | 'examprep' | 'mytimetables' | 'notes' | 'profile' | 'notification' | 'report' | 'language' | 'theme' | 'library' | 'terms' | 'settings' | 'feedback' | 'help' | 'about';

const App: React.FC = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [view, setView] = useState<View>('dashboard');

    // App-wide state with persistence to localStorage
    const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
        const [state, setState] = useState<T>(() => {
            try {
                const storedValue = localStorage.getItem(key);
                return storedValue ? JSON.parse(storedValue) : defaultValue;
            } catch (error)
{
                console.error(`Error reading localStorage key "${key}":`, error);
                return defaultValue;
            }
        });

        useEffect(() => {
            try {
                localStorage.setItem(key, JSON.stringify(state));
            } catch (error) {
                console.error(`Error setting localStorage key "${key}":`, error);
            }
        }, [key, state]);

        return [state, setState];
    };

    const [userDetails, setUserDetails] = usePersistentState<UserDetails | null>('userDetails', null);
    const [smartPlan, setSmartPlan] = usePersistentState<SmartPlan | null>('smartPlan', null);
    const [savedTimetables, setSavedTimetables] = usePersistentState<StoredPlan[]>('savedTimetables', []);
    const [notes, setNotes] = usePersistentState<Note[]>('notes', []);
    const [notificationSettings, setNotificationSettings] = usePersistentState<NotificationSettings>('notificationSettings', {
        status: 'unconfigured',
        enabled: false,
        reminders: true,
        reminderTime: 10,
        sessionStart: true,
        breakStartEnd: true,
    });
    const [activeSession, setActiveSession] = usePersistentState<ActiveSession | null>('activeSession', null);
    const [trackedData, setTrackedData] = usePersistentState<TrackedSession[]>('trackedData', []);
    const [appSettings, setAppSettings] = usePersistentState<AppSettings>('appSettings', { printButtonEnabled: true });
    const [isStudyMode, setIsStudyMode] = usePersistentState<boolean>('isStudyMode', false);
    const [alerts, setAlerts] = useState<{ id: number, message: string, type: 'start' | 'reminder' }[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const newToast: Toast = { id: Date.now(), message, type };
        setToasts(prevToasts => [newToast, ...prevToasts]);
    }, []);

    const dismissToast = (id: number) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    };
    
    // Warn user before closing the tab
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (activeSession) { // Only prompt if a session is active
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [activeSession]);
    
    const timeToMinutes = (time: string): number => {
        const [timePart, ampm] = time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const handleSessionCompleted = (completedSession: ActiveSession, durationMinutes: number) => {
        if (completedSession.type === 'study') {
             setTrackedData(prev => [...prev, {
                subject: completedSession.subject,
                durationMinutes,
                date: new Date().toISOString().split('T')[0]
            }]);
        }
        
        if (completedSession.isUntracked) {
            setActiveSession(null);
            setIsStudyMode(false);
            return;
        }
        
        // Find next slot and start it
        if (!smartPlan) {
            setActiveSession(null);
            setIsStudyMode(false);
            return;
        }
        
        const now = new Date();
        const currentDayName = now.toLocaleString('en-US', { weekday: 'long' });
        const todayPlan = smartPlan.find(p => p.day === currentDayName);
        if (!todayPlan) {
            setActiveSession(null);
            setIsStudyMode(false);
            return;
        }
        
        const completedSlotIndex = todayPlan.slots.findIndex(slot => 
            slot.activity === completedSession.fromSlot.activity && slot.startTime === completedSession.fromSlot.startTime
        );
        
        const nextSlot = todayPlan.slots[completedSlotIndex + 1];

        if (nextSlot) {
            const nextSlotStartMinutes = timeToMinutes(nextSlot.startTime);
            const nextSlotEndMinutes = timeToMinutes(nextSlot.endTime);
            
            const startTime = new Date();
            startTime.setHours(Math.floor(nextSlotStartMinutes / 60), nextSlotStartMinutes % 60, 0, 0);
            
            const endTime = new Date();
            endTime.setHours(Math.floor(nextSlotEndMinutes / 60), nextSlotEndMinutes % 60, 0, 0);

            setActiveSession({
                type: nextSlot.type === ActivityType.BREAK ? 'break' : 'study',
                subject: nextSlot.activity,
                startTime: startTime.getTime(),
                endTime: endTime.getTime(),
                fromSlot: nextSlot,
                studyModeFile: completedSession.studyModeFile, // Persist study context across breaks
            });

        } else {
            setActiveSession(null); // No more slots for the day
            setIsStudyMode(false);
        }
    };

    // Effect to schedule notifications when plan or settings change
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        
        if (smartPlan && notificationSettings.enabled) {
            const now = new Date();
            const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
            
            const todayPlan = smartPlan.find(p => p.day === currentDay);
            if (!todayPlan) return;

            todayPlan.slots.forEach(slot => {
                if (slot.type === ActivityType.STUDY) {
                    const startTime = new Date();
                    const slotStartMinutes = timeToMinutes(slot.startTime);
                    startTime.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);

                    const timeUntilStart = startTime.getTime() - now.getTime();

                    // Session start notification
                    if (notificationSettings.sessionStart && timeUntilStart > 0) {
                        const timer = setTimeout(() => {
                            setAlerts(prev => [...prev, { id: Date.now(), message: `Time for your "${slot.activity}" session!`, type: 'start' }]);
                        }, timeUntilStart);
                        timers.push(timer);
                    }
                    
                    // Reminder notification
                    if (notificationSettings.reminders && timeUntilStart > notificationSettings.reminderTime * 60000) {
                        const timeUntilReminder = timeUntilStart - (notificationSettings.reminderTime * 60000);
                         const timer = setTimeout(() => {
                            setAlerts(prev => [...prev, { id: Date.now(), message: `Reminder: "${slot.activity}" starts in ${notificationSettings.reminderTime} minutes.`, type: 'reminder' }]);
                        }, timeUntilReminder);
                        timers.push(timer);
                    }
                }
            });
        }
        
        return () => {
            timers.forEach(clearTimeout);
        };
    }, [smartPlan, notificationSettings]);

    const handleStartTracking = () => {
        // Logic to find current slot and start tracking it
        const now = new Date();
        const currentDay = now.toLocaleString('en-US', { weekday: 'long' });
        const todayPlan = smartPlan?.find(p => p.day === currentDay);
        if (!todayPlan) return;
        
        const slotStartMinutes = timeToMinutes(todayPlan.slots[0].startTime); // Simplified
        const startTime = new Date();
        startTime.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);
        const endTime = new Date(startTime.getTime() + 60 * 60000); // Assume 1 hour

        setActiveSession({
            type: 'study',
            subject: todayPlan.slots[0].activity,
            startTime: startTime.getTime(),
            endTime: endTime.getTime(),
            fromSlot: todayPlan.slots[0],
        });
        setAlerts([]); // Close alert
    };
    
    const handleExitStudyMode = () => {
        setIsStudyMode(false);
        setActiveSession(null);
    };

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
                            appSettings={appSettings}
                            addToast={addToast}
                        />;
            case 'progression':
                return <Progression plan={smartPlan} trackedData={trackedData} />;
            case 'uploadslides':
                 return <UploadSlides 
                            userDetails={userDetails} 
                            notes={notes} 
                            setNotes={setNotes}
                            smartPlan={smartPlan}
                            setSmartPlan={setSmartPlan}
                            activeSession={activeSession}
                            setActiveSession={setActiveSession}
                            setIsStudyMode={setIsStudyMode}
                            setView={setView}
                            addToast={addToast}
                        />;
            case 'examprep':
                return <ExamPrep setView={setView} />;
            case 'mytimetables':
                return <MyTimetables savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} onLoadPlan={(plan) => { setSmartPlan(plan); setView('dashboard'); }} />;
            case 'notes':
                return <Notes notes={notes} setNotes={setNotes} />;
            case 'profile':
                return <Profile 
                            userDetails={userDetails} 
                            setUserDetails={setUserDetails}
                            addToast={addToast}
                        />;
            case 'notification':
                return <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />;
            case 'report':
                return <Reports userDetails={userDetails} />;
            case 'language':
                return <LanguageSettings />;
            case 'theme':
                return <ThemeSettings />;
            case 'library':
                return <Library />;
            case 'terms':
                return <Terms />;
            case 'settings':
                return <Settings 
                            notificationSettings={notificationSettings}
                            setNotificationSettings={setNotificationSettings}
                            appSettings={appSettings}
                            setAppSettings={setAppSettings}
                        />;
            case 'feedback':
                return <Feedback />;
            case 'help':
                return <Help setView={setView} />;
            case 'about':
                return <About />;
            default:
                return <Dashboard 
                            setSmartPlan={setSmartPlan} 
                            smartPlan={smartPlan}
                            userDetails={userDetails}
                            setUserDetails={setUserDetails}
                            savedTimetables={savedTimetables}
                            setSavedTimetables={setSavedTimetables}
                            appSettings={appSettings}
                            addToast={addToast}
                        />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-50">
             <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            {isStudyMode && activeSession?.studyModeFile ? (
                <FocusedStudyView
                    activeSession={activeSession}
                    onExit={handleExitStudyMode}
                />
            ) : (
                <>
                    <Sidebar view={view} setView={setView} isOpen={isSidebarOpen} setOpen={setSidebarOpen} />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} userDetails={userDetails} setView={setView} />
                        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
                            {renderView()}
                        </main>
                    </div>
                </>
            )}
            
            {activeSession && activeSession.type === 'break' && activeSession.fromSlot.link && (
                <BreakView session={activeSession} />
            )}

            {activeSession && <StudyTracker activeSession={activeSession} setActiveSession={setActiveSession} onSessionCompleted={handleSessionCompleted} notificationSettings={notificationSettings} />}
             {alerts.length > 0 && (
                <div className="fixed bottom-24 right-4 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg z-50 no-print border dark:border-slate-700">
                    <p className="text-slate-800 dark:text-slate-100">{alerts[0].message}</p>
                    {alerts[0].type === 'start' && <button onClick={handleStartTracking} className="mt-2 px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800">Track My Studies</button>}
                    <button onClick={() => setAlerts(prev => prev.slice(1))} className="mt-2 ml-2 px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-md">Dismiss</button>
                </div>
            )}
        </div>
    );
};

export default App;