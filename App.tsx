



import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
// FIX: Add .tsx extension to Profile component import.
import Profile from './components/Profile.tsx';
import MyTimetables from './components/MyTimetables.tsx';
import Progression from './components/Progression.tsx';
import Notes from './components/Notes.tsx';
// FIX: Add .tsx extension to Onboarding component import.
import Onboarding from './components/Onboarding.tsx';
import ToastContainer from './components/ToastContainer.tsx';
import LanguageSettings from './components/Language.tsx';
import ThemeSettings from './components/Theme.tsx';
import NotificationSettingsComponent from './components/NotificationSettings.tsx';
import Settings from './components/Settings.tsx';
import Reports from './components/Reports.tsx';
import Feedback from './components/Feedback.tsx';
import Help from './components/Help.tsx';
import About from './components/About.tsx';
import UploadSlides from './components/UploadSlides.tsx';
import ExamPrep from './components/ExamPrep.tsx';
import StudyTracker from './components/StudyTracker.tsx';
import BreakView from './components/BreakView.tsx';
import FocusedStudyView from './components/FocusedStudyView.tsx';
import Library from './components/Library.tsx';
import Terms from './components/Terms.tsx';

import type { UserDetails, SmartPlan, StoredPlan, Note, Toast, ActiveSession, LearningHubState, NotificationSettings, TrackedSession } from './types.ts';
import { EducationalLevel } from './types.ts';

export type View =
  | 'dashboard'
  | 'profile'
  | 'mytimetables'
  | 'progression'
  | 'notes'
  | 'uploadslides'
  | 'examprep'
  | 'language'
  | 'theme'
  | 'notification'
  | 'settings'
  | 'report'
  | 'feedback'
  | 'help'
  | 'about'
  | 'library'
  | 'terms';

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [smartPlan, setSmartPlan] = useState<SmartPlan | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<StoredPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [learningHubState, setLearningHubState] = useState<LearningHubState>({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({ status: 'unconfigured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
  const [trackedData, setTrackedData] = useState<TrackedSession[]>([]);

  useEffect(() => {
    const loadData = () => {
      try {
        const savedUserDetails = localStorage.getItem('userDetails');
        if (savedUserDetails) setUserDetails(JSON.parse(savedUserDetails));

        const savedPlans = localStorage.getItem('savedTimetables');
        if (savedPlans) setSavedTimetables(JSON.parse(savedPlans));

        const savedNotes = localStorage.getItem('notes');
        if (savedNotes) setNotes(JSON.parse(savedNotes));
        
        const savedSmartPlan = localStorage.getItem('smartPlan');
        if (savedSmartPlan) setSmartPlan(JSON.parse(savedSmartPlan));
        
        const savedNotifSettings = localStorage.getItem('notificationSettings');
        if (savedNotifSettings) setNotificationSettings(JSON.parse(savedNotifSettings));
        
        const savedTrackedData = localStorage.getItem('trackedData');
        if (savedTrackedData) setTrackedData(JSON.parse(savedTrackedData));

      } catch (error) {
        console.error("Failed to load data from localStorage", error);
        addToast("Could not load saved data.", "error");
      }
    };
    loadData();
  }, []);

  const persistState = <T,>(key: string, state: T) => {
    try {
      if (state !== null && state !== undefined) {
        localStorage.setItem(key, JSON.stringify(state));
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Failed to persist state for key "${key}"`, error);
    }
  };

  useEffect(() => persistState('userDetails', userDetails), [userDetails]);
  useEffect(() => persistState('savedTimetables', savedTimetables), [savedTimetables]);
  useEffect(() => persistState('notes', notes), [notes]);
  useEffect(() => persistState('smartPlan', smartPlan), [smartPlan]);
  useEffect(() => persistState('notificationSettings', notificationSettings), [notificationSettings]);
  useEffect(() => persistState('trackedData', trackedData), [trackedData]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const newToast = { id: Date.now(), message, type };
    setToasts(prev => [...prev, newToast]);
  }, []);

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const handleOnboardingComplete = (details: UserDetails) => {
    setUserDetails(details);
  };
  
  const learningHubFile = learningHubState.file;
  const isStudyMode = activeSession?.type === 'study' && learningHubFile;

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
                  addToast={addToast}
                  setActiveSession={setActiveSession}
                  trackedData={trackedData}
                  setTrackedData={setTrackedData}
               />;
      case 'profile':
        return <Profile userDetails={userDetails} setUserDetails={setUserDetails} addToast={addToast} />;
      case 'mytimetables':
// FIX: Passed `addToast` prop to MyTimetables component.
        return <MyTimetables savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} onLoadPlan={(plan) => { setSmartPlan(plan); setView('dashboard'); }} addToast={addToast} />;
      case 'progression':
        return <Progression plan={smartPlan} trackedData={trackedData} />;
      case 'notes':
        return <Notes notes={notes} setNotes={setNotes} />;
      case 'uploadslides':
        return <UploadSlides
                  smartPlan={smartPlan}
                  activeSession={activeSession}
                  setActiveSession={setActiveSession}
                  setView={setView}
                  addToast={addToast}
                  learningHubState={learningHubState}
                  setLearningHubState={setLearningHubState}
                  notes={notes}
                  setNotes={setNotes}
                />;
      case 'examprep':
        return <ExamPrep addToast={addToast} setView={setView} />;
      case 'language':
        return <LanguageSettings />;
      case 'theme':
        return <ThemeSettings />;
      case 'notification':
        return <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />;
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
        return <div>Not Found</div>;
    }
  };

  if (!userDetails) {
    return <Onboarding onComplete={handleOnboardingComplete} addToast={addToast} />;
  }
  
  if (isStudyMode) {
     return <FocusedStudyView session={activeSession} learningHubFile={learningHubFile} onExit={() => setActiveSession(null)} addToast={addToast} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Sidebar view={view} setView={setView} isOpen={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} userDetails={userDetails} setView={setView} addToast={addToast} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          {renderView()}
{/* FIX: Passed missing `trackedData` and `setTrackedData` props to StudyTracker. */}
          {activeSession?.type === 'study' && <StudyTracker session={activeSession} setSession={setActiveSession} addToast={addToast} trackedData={trackedData} setTrackedData={setTrackedData} />}
        </main>
      </div>
       {activeSession?.type === 'break' && <BreakView session={activeSession} />}
    </div>
  );
};

export default App;