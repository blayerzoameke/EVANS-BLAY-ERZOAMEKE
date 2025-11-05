import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Dashboard from '../components/Dashboard';
import Profile from '../components/Profile';
import MyTimetables from '../components/MyTimetables';
import Progression from '../components/Progression';
import Notes from '../components/Notes';
import SignUp from '../components/SignUp';
import ToastContainer from '../components/ToastContainer';
import Settings from '../components/Settings';
import Reports from '../components/Reports';
import Feedback from '../components/Feedback';
import Help from '../components/Help';
import About from '../components/About';
import UploadSlides from '../components/UploadSlides';
import { ExamPrep } from '../components/ExamPrep';
import BreakView from '../components/BreakView';
import FocusedStudyView from '../components/FocusedStudyView';
import Library from '../components/Library';
import Terms from '../components/Terms';
import Tutorial from '../components/Tutorial';
import LanguageSettings from '../components/Language';
import ThemeSettings from '../components/Theme';
import NotificationSettingsComponent from '../components/NotificationSettings';
import { CloseIcon } from '../components/icons/CloseIcon';
import NotificationManager from '../components/NotificationManager';
import Welcome from '../components/Welcome';
import { getCurrentUser, logout, storageService } from './services/authService';

import type { UserDetails, SmartPlan, StoredPlan, Note, Toast, ActiveSession, LearningHubState, NotificationSettings, TrackedSession, GenerationState, QuizState, DashboardInputState, ExamPrepState, ProfileEditState, NotesViewState, ReportDraft, PlanSlot, View } from '../types';
import { QuizType, ActivityType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { timeToMinutes } from '../lib/utils';

// Notification Prompt Component
const NotificationPrompt: React.FC<{
    settings: NotificationSettings;
    setSettings: (settings: NotificationSettings) => void;
}> = ({ setSettings }) => {
    const { t } = useLanguage();

    const handleFirstTimeEnable = () => {
        if (typeof Notification === 'undefined') {
            alert('This browser does not support desktop notification');
            setSettings({ status: 'configured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
            return;
        }

        if (Notification.permission === 'denied') {
            alert(t('notifications.firstTime.denied'));
            setSettings({ status: 'configured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
            return;
        }
        
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                setSettings({ status: 'configured', enabled: true, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
                new Notification(t('notifications.firstTime.enabled'), {
                    body: t('notifications.firstTime.enabledBody')
                });
            } else {
                setSettings({ status: 'configured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
            }
        });
    };
    
    const handleDismiss = () => {
        setSettings({ status: 'configured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
    };

    return (
        <div className="bg-primary-dark text-white p-3 text-center z-50 shadow-md no-print animate-fade-in-down">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <p className="text-sm text-left">{t('notifications.firstTime.body')}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleFirstTimeEnable} className="px-3 py-1.5 text-sm font-semibold bg-white text-primary rounded-md hover:bg-gray-100 whitespace-nowrap">{t('notifications.firstTime.turnOn')}</button>
                    <button onClick={handleDismiss} className="text-sm font-medium hover:underline whitespace-nowrap">{t('notifications.firstTime.maybeLater')}</button>
                    <button onClick={handleDismiss} className="p-1 rounded-full hover:bg-white/20" aria-label={t('common.close')}>
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const defaultNotificationSettings: NotificationSettings = { status: 'unconfigured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true };
const defaultQuizState: QuizState = { quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null };

const App: React.FC = () => {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [smartPlan, setSmartPlan] = useState<SmartPlan | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<StoredPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [learningHubState, setLearningHubState] = useState<LearningHubState>({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [trackedData, setTrackedData] = useState<TrackedSession[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>({ isLoading: false, message: '', error: null, source: null });
  const [quizState, setQuizState] = useState<QuizState>(defaultQuizState);
  const [intendedStudyContext, setIntendedStudyContext] = useState<{ subject: string; fromSlot: PlanSlot } | null>(null);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState<string>('https://www.youtube.com/watch?v=tBxfJ36t9_A');
  const [welcomeComplete, setWelcomeComplete] = useState(() => storageService.loadItem<boolean>('welcomeComplete') || false);

  // Persistent component states
  const [dashboardInputs, setDashboardInputs] = useState<DashboardInputState>({ lectures: [], studyGoals: [], agendaItems: [], generalGoals: '', imageFile: null, imagePreview: null, step: 1, isManualPlan: false, isEditing: false });
  const [examPrepState, setExamPrepState] = useState<ExamPrepState>({ mode: 'quiz', topic: '', numQuestions: 5, quizType: QuizType.MCQ, uploadedFiles: [], focusArea: '', isVerifying: false, questionImage: null, questionText: '', solution: null, outputFormat: 'steps', programmingLanguage: 'python', graphInterval: '', graphYInterval: '' });
  const [profileEditState, setProfileEditState] = useState<ProfileEditState>({ isEditing: false, details: null });
  const [notesViewState, setNotesViewState] = useState<NotesViewState>({ currentNoteId: null, searchTerm: '' });
  const [reportDraft, setReportDraft] = useState<ReportDraft>({ category: 'bug', description: '', attachment: null, contactEmail: '', contactWhatsApp: '' });

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const newToast = { id: Date.now(), message, type };
    setToasts(prev => [...prev, newToast]);
  }, []);

  const persistAllState = useCallback(() => {
    if (!userDetails?.email) return;

    const allUsersData = storageService.loadItem<any>('usersData') || {};
    const currentUserData = {
        userDetails,
        smartPlan,
        savedTimetables,
        notes,
        notificationSettings,
        trackedData,
        quizState: {
            quiz: quizState.quiz,
            currentQuestionIndex: quizState.currentQuestionIndex,
            userAnswers: quizState.userAnswers,
        },
    };
    allUsersData[userDetails.email] = currentUserData;
    storageService.saveItem('usersData', allUsersData);

  }, [userDetails, smartPlan, savedTimetables, notes, notificationSettings, trackedData, quizState]);

    const loadUserData = useCallback((user: UserDetails) => {
        const allUsersData = storageService.loadItem<any>('usersData') || {};
        let userData = allUsersData[user.email];

        // Migration for users from before the multi-user storage system
        if (!userData) {
            console.log("Migrating legacy data for user:", user.email);
            userData = {};
            userData.smartPlan = storageService.loadItem('smartPlan');
            userData.savedTimetables = storageService.loadItem('savedTimetables');
            userData.notes = storageService.loadItem('notes');
            userData.trackedData = storageService.loadItem('trackedData');
            userData.notificationSettings = storageService.loadItem('notificationSettings');
            userData.quizProgress = storageService.loadItem('quizProgress');
            userData.userDetails = storageService.loadItem('userDetails');

            // Clean up old top-level keys after migration
            storageService.removeItem('smartPlan');
            storageService.removeItem('savedTimetables');
            storageService.removeItem('notes');
            storageService.removeItem('trackedData');
            storageService.removeItem('notificationSettings');
            storageService.removeItem('quizProgress');
            storageService.removeItem('userDetails');
        }

        setUserDetails(userData.userDetails || user);
        setSmartPlan(userData.smartPlan || null);
        setSavedTimetables(userData.savedTimetables || []);
        setNotes(userData.notes || []);
        setTrackedData(userData.trackedData || []);
        setNotificationSettings(userData.notificationSettings || defaultNotificationSettings);
        
        if (userData.quizState && userData.quizState.quiz?.length > 0) {
            setQuizState({ ...defaultQuizState, ...userData.quizState, feedback: null, summary: null });
        } else {
            setQuizState(defaultQuizState);
        }

        // Always load global (non-user-specific) settings
        const tutorialVideoUrlData = storageService.loadItem<string>('tutorialVideoUrl');
        if(tutorialVideoUrlData) setTutorialVideoUrl(tutorialVideoUrlData);

    }, []);

    useEffect(() => {
        const user = getCurrentUser();
        if (user) {
            loadUserData(user);
            setIsLoggedIn(true);
        }
    }, [loadUserData]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (isLoggedIn) {
        persistAllState();
        // Persist global settings separately
        storageService.saveItem('tutorialVideoUrl', tutorialVideoUrl);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [isLoggedIn, persistAllState, tutorialVideoUrl]);

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const handleWelcomeComplete = () => {
      setWelcomeComplete(true);
      storageService.saveItem('welcomeComplete', true);
  };

  const handleLogin = (user: UserDetails) => {
    loadUserData(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    persistAllState(); // Save final state before logging out
    logout();
    
    // Reset all application state
    setUserDetails(null);
    setIsLoggedIn(false);
    setSmartPlan(null);
    setSavedTimetables([]);
    setNotes([]);
    setActiveSession(null);
    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
    setNotificationSettings(defaultNotificationSettings);
    setTrackedData([]);
    setQuizState(defaultQuizState);
    setDashboardInputs({ lectures: [], studyGoals: [], agendaItems: [], generalGoals: '', imageFile: null, imagePreview: null, step: 1, isManualPlan: false, isEditing: false });
    setExamPrepState({ mode: 'quiz', topic: '', numQuestions: 5, quizType: QuizType.MCQ, uploadedFiles: [], focusArea: '', isVerifying: false, questionImage: null, questionText: '', solution: null, outputFormat: 'steps', programmingLanguage: 'python', graphInterval: '', graphYInterval: '' });
    setProfileEditState({ isEditing: false, details: null });
    setNotesViewState({ currentNoteId: null, searchTerm: '' });
    setReportDraft({ category: 'bug', description: '', attachment: null, contactEmail: '', contactWhatsApp: '' });

    addToast(t('auth.logoutSuccess'), 'info');
  };

  const handleBreakCompletion = (skipped: boolean) => {
    const breakSession = activeSession;
    if (!breakSession || breakSession.type !== 'break') {
        setActiveSession(null);
        setView('dashboard');
        return;
    }

    if (breakSession.postBreakView) {
        setActiveSession(null);
        setView(breakSession.postBreakView);
        return;
    }
    
    if (!smartPlan || !breakSession.day) {
        setActiveSession(null);
        setView('dashboard');
        return;
    }

    const dayPlan = smartPlan.find(d => d.day === breakSession.day);
    if (!dayPlan) {
        setActiveSession(null);
        setView('dashboard');
        return;
    }

    const sortedSlots = [...dayPlan.slots].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const breakIndex = sortedSlots.findIndex(s => s.startTime === breakSession.fromSlot.startTime && s.activity === breakSession.fromSlot.activity);
    
    if (breakIndex !== -1 && breakIndex + 1 < sortedSlots.length) {
        const nextSlot = sortedSlots[breakIndex + 1];

        if (nextSlot.type === ActivityType.STUDY) {
            const now = Date.now();
            const duration = timeToMinutes(nextSlot.endTime) - timeToMinutes(nextSlot.startTime);
            const nextNextSlot = breakIndex + 2 < sortedSlots.length ? sortedSlots[breakIndex + 2] : null;

            const newSession: ActiveSession = {
                startTime: now,
                endTime: now + duration * 60 * 1000,
                subject: nextSlot.activity,
                type: ActivityType.STUDY,
                fromSlot: nextSlot,
                nextSlot: nextNextSlot,
                durationMinutes: duration,
                day: breakSession.day,
            };
            setActiveSession(newSession);
            return;
        }
    }
    
    setActiveSession(null);
    setView('dashboard');
  };
  
  const learningHubFile = learningHubState.file;
  const isStudyMode = activeSession?.type === 'study';

  const renderView = () => {
    if (!userDetails) return null; // Should not happen if logged in
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
                  generationState={generationState}
                  setGenerationState={setGenerationState}
                  dashboardInputs={dashboardInputs}
                  setDashboardInputs={setDashboardInputs}
                  setView={setView}
                  setIntendedStudyContext={setIntendedStudyContext}
                  setLearningHubState={setLearningHubState}
               />;
      case 'profile':
        return <Profile 
                    userDetails={userDetails} 
                    setUserDetails={setUserDetails} 
                    addToast={addToast} 
                    profileEditState={profileEditState}
                    setProfileEditState={setProfileEditState}
                />;
      case 'mytimetables':
        return <MyTimetables savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} onLoadPlan={(plan) => { setSmartPlan(plan); setView('dashboard'); }} addToast={addToast} userDetails={userDetails} />;
      case 'progression':
        return <Progression plan={smartPlan} trackedData={trackedData} />;
      case 'notes':
        return <Notes 
                    notes={notes} 
                    setNotes={setNotes} 
                    notesViewState={notesViewState}
                    setNotesViewState={setNotesViewState}
                />;
      case 'uploadslides':
        return <UploadSlides
                  smartPlan={smartPlan}
                  setSmartPlan={setSmartPlan as (plan: SmartPlan) => void}
                  activeSession={activeSession}
                  setActiveSession={setActiveSession}
                  setView={setView}
                  addToast={addToast}
                  learningHubState={learningHubState}
                  setLearningHubState={setLearningHubState}
                  notes={notes}
                  setNotes={setNotes}
                  intendedStudyContext={intendedStudyContext}
                  setIntendedStudyContext={setIntendedStudyContext}
                />;
      case 'examprep':
        return <ExamPrep 
                    addToast={addToast} 
                    setView={setView}
                    generationState={generationState}
                    setGenerationState={setGenerationState}
                    quizState={quizState}
                    setQuizState={setQuizState}
                    notes={notes}
                    setNotes={setNotes}
                    examPrepState={examPrepState}
                    setExamPrepState={setExamPrepState}
                />;
      case 'language':
        return <LanguageSettings />;
      case 'theme':
        return <ThemeSettings />;
      case 'notification':
        return <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />;
      case 'settings':
        // FIX: Pass the 'handleLogout' function to the Settings component as a required prop.
        return <Settings addToast={addToast} handleLogout={handleLogout} />;
      case 'report':
        return <Reports 
                    userDetails={userDetails} 
                    reportDraft={reportDraft}
                    setReportDraft={setReportDraft}
                    addToast={addToast}
                />;
// FIX: The Feedback component was being passed incorrect props. It should receive `userDetails` and `addToast`. The logic for calculating total users and materials is handled within the component itself from local storage.
      case 'feedback': {
        return <Feedback 
                    userDetails={userDetails} 
                    addToast={addToast} 
                />;
      }
      case 'help':
        return <Help setView={setView} />;
      case 'about':
        return <About setView={setView} />;
      case 'library':
        return <Library />;
      case 'terms':
        return <Terms />;
      case 'tutorial':
        return <Tutorial
                    addToast={addToast}
                    tutorialVideoUrl={tutorialVideoUrl}
                    setTutorialVideoUrl={setTutorialVideoUrl}
                />;
      default:
        return <div>{t('common.notFound')}</div>;
    }
  };

  if (!isLoggedIn) {
    if (!welcomeComplete) {
        return <Welcome onProceed={handleWelcomeComplete} />;
    }
    return <SignUp onLogin={handleLogin} />;
  }
  
  if (isStudyMode) {
     return <FocusedStudyView 
                session={activeSession!} 
                setSession={setActiveSession}
                learningHubFile={learningHubFile} 
                addToast={addToast}
                trackedData={trackedData}
                setTrackedData={setTrackedData}
                setView={setView}
                setLearningHubState={setLearningHubState}
            />;
  }
  
  const showNotifPrompt = notificationSettings.status === 'unconfigured' && typeof Notification !== 'undefined' && Notification.permission === 'default';

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <NotificationManager plan={smartPlan} settings={notificationSettings} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Sidebar view={view} setView={setView} isOpen={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {showNotifPrompt && <NotificationPrompt settings={notificationSettings} setSettings={setNotificationSettings} />}
        <Header 
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
            userDetails={userDetails} 
            setView={setView} 
            addToast={addToast}
            handleLogout={handleLogout}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
       {activeSession?.type === 'break' && <BreakView session={activeSession} onEnd={handleBreakCompletion} />}
    </div>
  );
};

export default App;