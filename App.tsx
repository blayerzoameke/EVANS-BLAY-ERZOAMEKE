import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import Profile from './components/Profile.tsx';
import MyTimetables from './components/MyTimetables.tsx';
import Progression from './components/Progression.tsx';
import Notes from './components/Notes.tsx';
import Onboarding from './components/Onboarding.tsx';
import ToastContainer from './components/ToastContainer.tsx';
import Settings from './components/Settings.tsx';
import Reports from './components/Reports.tsx';
import Feedback from './components/Feedback.tsx';
import Help from './components/Help.tsx';
import About from './components/About.tsx';
import UploadSlides from './components/UploadSlides.tsx';
import ExamPrep from './components/ExamPrep.tsx';
import BreakView from './components/BreakView.tsx';
import FocusedStudyView from './components/FocusedStudyView.tsx';
import Library from './components/Library.tsx';
import Terms from './components/Terms.tsx';
import Tutorial from './components/Tutorial.tsx';
import Preferences from './components/Preferences.tsx';
import { CloseIcon } from './components/icons/CloseIcon.tsx';
import NotificationManager from './components/NotificationManager.tsx';

import type { UserDetails, SmartPlan, StoredPlan, Note, Toast, ActiveSession, LearningHubState, NotificationSettings, TrackedSession, GenerationState, QuizState, DashboardInputState, ExamPrepState, ProfileEditState, NotesViewState, ReportDraft, FeedbackDraft, PlanSlot, View } from './types.ts';
import { QuizType, ActivityType } from './types.ts';
import { useLanguage } from './contexts/LanguageContext.tsx';
import { timeToMinutes } from './lib/utils.ts';

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

const App: React.FC = () => {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [smartPlan, setSmartPlan] = useState<SmartPlan | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<StoredPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [learningHubState, setLearningHubState] = useState<LearningHubState>({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({ status: 'unconfigured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
  const [trackedData, setTrackedData] = useState<TrackedSession[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>({ isLoading: false, message: '', error: null, source: null });
  const [quizState, setQuizState] = useState<QuizState>({ quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });
  const [intendedStudyContext, setIntendedStudyContext] = useState<{ subject: string; fromSlot: PlanSlot } | null>(null);
  const [tutorialImages, setTutorialImages] = useState<Record<string, string>>({});
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState<string>('https://www.youtube.com/watch?v=tBxfJ36t9_A');

  // Persistent component states
  const [dashboardInputs, setDashboardInputs] = useState<DashboardInputState>({ lectures: [], studyGoals: [], agendaItems: [], generalGoals: '', imageFile: null, imagePreview: null, step: 1, isManualPlan: false, isEditing: false });
  const [examPrepState, setExamPrepState] = useState<ExamPrepState>({ mode: 'quiz', topic: '', numQuestions: 5, quizType: QuizType.MCQ, uploadedFiles: [], focusArea: '', isVerifying: false, questionImage: null, questionText: '', solution: null, outputFormat: 'steps', programmingLanguage: 'python', graphInterval: '' });
  const [profileEditState, setProfileEditState] = useState<ProfileEditState>({ isEditing: false, details: null });
  const [notesViewState, setNotesViewState] = useState<NotesViewState>({ currentNoteId: null, searchTerm: '' });
  const [reportDraft, setReportDraft] = useState<ReportDraft>({ category: 'bug', description: '', attachment: null, contactEmail: '', contactWhatsApp: '' });
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft>({ rating: 0, category: 'compliment', comments: '', canUseAsTestimonial: false });


  useEffect(() => {
    const loadData = () => {
      try {
        const savedOnboarding = localStorage.getItem('hasCompletedOnboarding');
        const savedUserDetails = localStorage.getItem('userDetails');

        if (savedOnboarding === 'true' && savedUserDetails) {
            const parsedDetails = JSON.parse(savedUserDetails);
            if (parsedDetails && parsedDetails.name) {
                setUserDetails(parsedDetails);
                setHasCompletedOnboarding(true);
                setReportDraft(prev => ({...prev, contactEmail: parsedDetails.email || ''}));
            }
        }

        const savedPlans = localStorage.getItem('savedTimetables');
        if (savedPlans) setSavedTimetables(JSON.parse(savedPlans));

        const savedNotes = localStorage.getItem('notes');
        if (savedNotes) setNotes(JSON.parse(savedNotes));
        
        const savedSmartPlan = localStorage.getItem('smartPlan');
        if (savedSmartPlan) setSmartPlan(JSON.parse(savedSmartPlan));
        
        const savedNotifSettings = localStorage.getItem('notificationSettings');
        if (savedNotifSettings) {
            setNotificationSettings(JSON.parse(savedNotifSettings));
        } else if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
            // If no settings are saved, but browser permission is already granted or denied,
            // we can consider it 'configured'.
            setNotificationSettings(prev => ({
                ...prev,
                status: 'configured',
                enabled: Notification.permission === 'granted'
            }));
        }
        
        const savedTrackedData = localStorage.getItem('trackedData');
        if (savedTrackedData) setTrackedData(JSON.parse(savedTrackedData));

        const savedQuizProgress = localStorage.getItem('quizProgress');
        if (savedQuizProgress) {
            const parsedProgress = JSON.parse(savedQuizProgress);
            if (parsedProgress && parsedProgress.quiz && parsedProgress.quiz.length > 0) {
                setQuizState({
                    quiz: parsedProgress.quiz,
                    currentQuestionIndex: parsedProgress.currentQuestionIndex,
                    userAnswers: parsedProgress.userAnswers,
                    feedback: null,
                    summary: null,
                });
            }
        }
        
        const savedTutorialImages = localStorage.getItem('tutorialImages');
        if (savedTutorialImages) setTutorialImages(JSON.parse(savedTutorialImages));

        const savedVideoUrl = localStorage.getItem('tutorialVideoUrl');
        if (savedVideoUrl) setTutorialVideoUrl(savedVideoUrl);

      } catch (error) {
        console.error("Failed to load data from localStorage", error);
        addToast(t('toasts.loadError'), "error");
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
  useEffect(() => persistState('hasCompletedOnboarding', hasCompletedOnboarding), [hasCompletedOnboarding]);
  useEffect(() => persistState('savedTimetables', savedTimetables), [savedTimetables]);
  useEffect(() => persistState('notes', notes), [notes]);
  useEffect(() => persistState('smartPlan', smartPlan), [smartPlan]);
  useEffect(() => persistState('notificationSettings', notificationSettings), [notificationSettings]);
  useEffect(() => persistState('trackedData', trackedData), [trackedData]);
  useEffect(() => persistState('tutorialImages', tutorialImages), [tutorialImages]);
  useEffect(() => persistState('tutorialVideoUrl', tutorialVideoUrl), [tutorialVideoUrl]);

  useEffect(() => {
    // Only save if there's an active quiz that is not yet completed
    if (quizState.quiz.length > 0 && !quizState.summary) {
        const progressToSave = {
            quiz: quizState.quiz,
            currentQuestionIndex: quizState.currentQuestionIndex,
            userAnswers: quizState.userAnswers,
        };
        persistState('quizProgress', progressToSave);
    } else {
        // If the quiz is finished or empty, ensure any saved progress is cleared
        localStorage.removeItem('quizProgress');
    }
  }, [quizState]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const newToast = { id: Date.now(), message, type };
    setToasts(prev => [...prev, newToast]);
  }, []);

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const handleOnboardingComplete = (details: UserDetails) => {
    setUserDetails(details);
    setHasCompletedOnboarding(true);
    setReportDraft(prev => ({...prev, contactEmail: details.email || ''}));
  };

  const handleBreakCompletion = (skipped: boolean) => {
    const breakSession = activeSession;
    if (!breakSession || breakSession.type !== 'break') {
        setActiveSession(null);
        setView('dashboard');
        return;
    }

    // If a post-break view is specified, navigate there. This is for returning to Learning Hub.
    if (breakSession.postBreakView) {
        setActiveSession(null);
        setView(breakSession.postBreakView);
        // We don't clear learningHubState here, so the user returns to their document.
        return;
    }
    
    // Original logic for scheduled breaks from the timetable.
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
        return <MyTimetables savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} onLoadPlan={(plan) => { setSmartPlan(plan); setView('dashboard'); }} addToast={addToast} />;
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
      case 'preferences':
        return <Preferences notificationSettings={notificationSettings} setNotificationSettings={setNotificationSettings} />;
      case 'settings':
        return <Settings notificationSettings={notificationSettings} setNotificationSettings={setNotificationSettings} />;
      case 'report':
        return <Reports 
                    userDetails={userDetails} 
                    reportDraft={reportDraft}
                    setReportDraft={setReportDraft}
                />;
      case 'feedback':
        return <Feedback 
                    feedbackDraft={feedbackDraft}
                    setFeedbackDraft={setFeedbackDraft}
                />;
      case 'help':
        return <Help setView={setView} />;
      case 'about':
        return <About />;
      case 'library':
        return <Library />;
      case 'terms':
        return <Terms />;
      case 'tutorial':
        return <Tutorial
                    tutorialImages={tutorialImages}
                    setTutorialImages={setTutorialImages}
                    addToast={addToast}
                    tutorialVideoUrl={tutorialVideoUrl}
                    setTutorialVideoUrl={setTutorialVideoUrl}
                />;
      default:
        return <div>{t('common.notFound')}</div>;
    }
  };

  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} addToast={addToast} />;
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
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} userDetails={userDetails} setView={setView} addToast={addToast} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
       {activeSession?.type === 'break' && <BreakView session={activeSession} onEnd={handleBreakCompletion} />}
    </div>
  );
};

export default App;