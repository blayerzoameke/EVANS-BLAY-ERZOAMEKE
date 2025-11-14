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
import { globalFeedbackService } from './services/globalFeedbackService';
import { redirectToCheckout } from './services/paymentService';
import Pricing from '../components/Pricing';
import UpgradeModal from '../components/UpgradeModal';
import AdBanner from '../components/AdBanner';
import type { UserDetails, SmartPlan, StoredPlan, Note, Toast, ActiveSession, LearningHubState, NotificationSettings, TrackedSession, GenerationState, QuizState, DashboardInputState, ExamPrepState, ProfileEditState, NotesViewState, ReportDraft, PlanSlot, View, UploadedMaterialInfo, CourseCodeMap, FeatureName, ImagePart, UploadedFile } from '../types';
import { QuizType, ActivityType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { timeToMinutes, processAndResizeImage } from '../lib/utils';
import { initializeUsage, checkUsage, incrementUsage } from '../lib/usageManager';
import { isStudyMaterial, getDocumentContext } from '../services/geminiService';


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
  const [learningHubState, setLearningHubState] = useState<LearningHubState>({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false, processingMessage: '' });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [trackedData, setTrackedData] = useState<TrackedSession[]>([]);
  const [uploadedMaterials, setUploadedMaterials] = useState<UploadedMaterialInfo[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>({ isLoading: false, message: '', error: null, source: 'dashboard' });
  const [quizState, setQuizState] = useState<QuizState>(defaultQuizState);
  const [intendedStudyContext, setIntendedStudyContext] = useState<{ subject: string; fromSlot: PlanSlot } | null>(null);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState<string>('https://www.youtube.com/watch?v=tBxfJ36t9_A');
  const [welcomeComplete, setWelcomeComplete] = useState(() => storageService.loadItem<boolean>('welcomeComplete') || false);
  const [courseCodeMap, setCourseCodeMap] = useState<CourseCodeMap>({});

  const [upgradeModalInfo, setUpgradeModalInfo] = useState({ isOpen: false, featureTitle: '' });
  const handleShowUpgradeModal = (show: boolean, featureTitle: string) => {
    setUpgradeModalInfo({ isOpen: show, featureTitle });
  };


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
        uploadedMaterials,
        courseCodeMap,
        quizState: {
            quiz: quizState.quiz,
            currentQuestionIndex: quizState.currentQuestionIndex,
            userAnswers: quizState.userAnswers,
        },
    };
    allUsersData[userDetails.email] = currentUserData;
    storageService.saveItem('usersData', allUsersData);

  }, [userDetails, smartPlan, savedTimetables, notes, notificationSettings, trackedData, quizState, uploadedMaterials, courseCodeMap]);

    const loadUserData = useCallback((user: UserDetails) => {
        const allUsersData = storageService.loadItem<any>('usersData') || {};
        let userData = allUsersData[user.email!];

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
            userData.courseCodeMap = {}; // Initialize for old users

            storageService.removeItem('smartPlan');
            storageService.removeItem('savedTimetables');
            storageService.removeItem('notes');
            storageService.removeItem('trackedData');
            storageService.removeItem('notificationSettings');
            storageService.removeItem('quizProgress');
            storageService.removeItem('userDetails');
        }
        
        // Ensure usage object is initialized
        const finalUserDetails = { ...user, ...(userData.userDetails || {}), usage: (userData.userDetails?.usage || user.usage || initializeUsage()) };

        setUserDetails(finalUserDetails);
        setSmartPlan(userData.smartPlan || null);
        setSavedTimetables(userData.savedTimetables || []);
        setNotes(userData.notes || []);
        setTrackedData(userData.trackedData || []);
        setUploadedMaterials(userData.uploadedMaterials || []);
        setNotificationSettings(userData.notificationSettings || defaultNotificationSettings);
        setCourseCodeMap(userData.courseCodeMap || {});
        
        if (userData.quizState && userData.quizState.quiz?.length > 0) {
            setQuizState({ ...defaultQuizState, ...userData.quizState, feedback: null, summary: null });
        } else {
            setQuizState(defaultQuizState);
        }

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
        storageService.saveItem('tutorialVideoUrl', tutorialVideoUrl);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [isLoggedIn, persistAllState, tutorialVideoUrl]);
  
  useEffect(() => {
    const handlePaymentResult = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const trxRef = urlParams.get('trxref'); // Paystack transaction reference
        const reference = urlParams.get('reference');

        if (trxRef && reference) {
            if (userDetails && userDetails.subscriptionTier !== 'premium') {
                const updatedDetails: UserDetails = {
                    ...userDetails,
                    subscriptionTier: 'premium',
                    subscriptionStatus: 'active',
                };
                setUserDetails(updatedDetails);
                addToast(t('toasts.upgradeSuccess'), 'success');
            }
        } else if (urlParams.get('payment_status') === 'cancelled') {
             addToast(t('toasts.paymentCancelled'), 'info');
        }

        if (trxRef || reference || urlParams.get('payment_status')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('trxref');
            url.searchParams.delete('reference');
            url.searchParams.delete('payment_status');
            window.history.replaceState({}, document.title, url.toString());
        }
    };
    
    if(isLoggedIn) {
        handlePaymentResult();
    }
  }, [isLoggedIn, userDetails, addToast, t]);

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  const handleWelcomeComplete = () => {
      setWelcomeComplete(true);
      storageService.saveItem('welcomeComplete', true);
  };

  const checkAndRun = async (
    feature: FeatureName,
    featureTitle: string,
    action: (...args: any[]) => Promise<void> | void,
    ...args: any[]
  ) => {
    if (!userDetails) return;

    if (userDetails.subscriptionTier === 'premium') {
      try {
        await action(...args);
        return true; 
      } catch {
        return false;
      }
    }

    const usageStatus = checkUsage(userDetails.usage, feature);
    if (usageStatus.canUse) {
      try {
        await action(...args);
        setUserDetails(prev => prev ? { ...prev, usage: incrementUsage(prev.usage, feature) } : null);
        return true;
      } catch {
        return false; 
      }
    } else {
      handleShowUpgradeModal(true, featureTitle);
      return false; 
    }
  };


  const handleLogin = (user: UserDetails) => {
    loadUserData(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    persistAllState(); 
    logout();
    
    setUserDetails(null);
    setIsLoggedIn(false);
    setSmartPlan(null);
    setSavedTimetables([]);
    setNotes([]);
    setActiveSession(null);
    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
    setNotificationSettings(defaultNotificationSettings);
    setTrackedData([]);
    setUploadedMaterials([]);
    setQuizState(defaultQuizState);
    setCourseCodeMap({});
    setDashboardInputs({ lectures: [], studyGoals: [], agendaItems: [], generalGoals: '', imageFile: null, imagePreview: null, step: 1, isManualPlan: false, isEditing: false });
    setExamPrepState({ mode: 'quiz', topic: '', numQuestions: 5, quizType: QuizType.MCQ, uploadedFiles: [], focusArea: '', isVerifying: false, questionImage: null, questionText: '', solution: null, outputFormat: 'steps', programmingLanguage: 'python', graphInterval: '', graphYInterval: '' });
    setProfileEditState({ isEditing: false, details: null });
    setNotesViewState({ currentNoteId: null, searchTerm: '' });
    setReportDraft({ category: 'bug', description: '', attachment: null, contactEmail: '', contactWhatsApp: '' });

    addToast(t('auth.logoutSuccess'), 'info');
  };

    const handleNewMaterialUpload = useCallback(async (fileToProcess: File) => {
        if (!userDetails) return;
        setLearningHubState(prev => ({...prev, isProcessing: true, processingMessage: t('uploadslides.verifying')}));

        try {
            const context = intendedStudyContext ? intendedStudyContext.fromSlot.activity : undefined;
            
            let base64String: string;
            let mimeType = fileToProcess.type;
            let finalSize = fileToProcess.size;
    
            if (fileToProcess.type.startsWith('image/')) {
                const resized = await processAndResizeImage(fileToProcess);
                base64String = resized.base64;
                mimeType = resized.mimeType;
                finalSize = atob(base64String).length;
            } else {
                base64String = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(fileToProcess);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                });
            }
            const filePart: ImagePart = { inlineData: { data: base64String, mimeType: mimeType } };
    
            const isMaterial = await isStudyMaterial(filePart, { fast: true });
            if (!isMaterial) {
                throw new Error(t('examprep.error.notStudyMaterial', { fileName: fileToProcess.name }));
            }
    
            let fileContext = context;
            if (!fileContext) {
                setLearningHubState(prev => ({ ...prev, processingMessage: t('uploadslides.extractingContext') }));
                fileContext = await getDocumentContext(filePart, { fast: true });
            }

            const processedFile: UploadedFile = {
                name: fileToProcess.name,
                type: mimeType,
                size: finalSize,
                base64: base64String,
                context: fileContext,
            };
            
            setLearningHubState(prev => ({ ...prev, file: processedFile, analysisMode: 'actions', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] }));
            
            const newMaterial: UploadedMaterialInfo = {
                name: processedFile.name,
                type: processedFile.type,
                size: processedFile.size,
                context: processedFile.context,
                uploadedAt: new Date().toISOString()
            };

            setUploadedMaterials(prevMaterials => {
                const isNew = !prevMaterials.some(m => m.name === newMaterial.name && m.size === newMaterial.size);
                if (isNew) {
                    if (userDetails?.id) {
                        globalFeedbackService.trackMaterialUpload(userDetails.id).catch(console.error);
                    }
                    return [...prevMaterials, newMaterial];
                }
                return prevMaterials;
            });

        } catch (error: any) {
            addToast(error.message, 'error');
            throw error;
        } finally {
            setLearningHubState(prev => ({...prev, isProcessing: false, processingMessage: ''}));
        }
    }, [addToast, t, userDetails, intendedStudyContext]);
    
    const handleSavePlanAttempt = (planName: string) => {
        checkAndRun('timetables', t('pricing.feature.timetables'), () => {
            if (!smartPlan) return;
            const newPlan: StoredPlan = {
                id: Date.now().toString(),
                name: planName,
                createdAt: new Date().toISOString(),
                plan: smartPlan,
                isFavourite: false,
            };
            setSavedTimetables(prev => [...prev, newPlan]);
            addToast(t('toasts.planSaved'), 'success');
        });
    };

    const handleNewMaterialUploadAttempt = (file: File) => {
        checkAndRun('uploads', t('pricing.feature.materials'), handleNewMaterialUpload, file);
    };

    const handleGenerateQuizAttempt = (apiAction: () => Promise<void>) => {
        checkAndRun('quizzes', t('pricing.feature.quizzes'), apiAction);
    };

    const handleSolveProblemAttempt = (apiAction: () => Promise<void>) => {
        checkAndRun('solves', t('pricing.feature.solver'), apiAction);
    };

    const handleUpgrade = (isYearly: boolean) => {
        const planType = isYearly ? 'yearly' : 'monthly';
        redirectToCheckout(planType, userDetails);
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
  
  const isStudyMode = activeSession?.type === 'study';

  const renderView = () => {
    if (!userDetails) return null;
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
                  courseCodeMap={courseCodeMap}
                  setCourseCodeMap={setCourseCodeMap}
                  onSavePlanAttempt={handleSavePlanAttempt}
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
        return <Progression plan={smartPlan} trackedData={trackedData} userDetails={userDetails} />;
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
                  setSmartPlan={setSmartPlan}
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
                  onAttemptUpload={handleNewMaterialUploadAttempt}
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
                    onGenerateQuizAttempt={handleGenerateQuizAttempt}
                    onSolveProblemAttempt={handleSolveProblemAttempt}
                />;
      case 'language':
        return <LanguageSettings />;
      case 'theme':
        return <ThemeSettings />;
      case 'notification':
        return <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />;
      case 'settings':
        return <Settings 
                    addToast={addToast} 
                    handleLogout={handleLogout}
                    userDetails={userDetails}
                    setShowUpgradeModal={handleShowUpgradeModal}
                />;
      case 'report':
        return <Reports 
                    userDetails={userDetails} 
                    reportDraft={reportDraft}
                    setReportDraft={setReportDraft}
                    addToast={addToast}
                />;
      case 'feedback':
        return <Feedback 
                    userDetails={userDetails} 
                    addToast={addToast} 
                />;
      case 'help':
        return <Help setView={setView} />;
      case 'about':
        return <About setView={setView} />;
      case 'library':
        return <Library />;
      case 'terms':
        return <Terms />;
      case 'pricing':
        return <Pricing userDetails={userDetails} onUpgrade={handleUpgrade} />;
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
                addToast={addToast}
                trackedData={trackedData}
                setTrackedData={setTrackedData}
                setView={setView}
                learningHubState={learningHubState}
                setLearningHubState={setLearningHubState}
            />;
  }
  
  const showNotifPrompt = notificationSettings.status === 'unconfigured' && typeof Notification !== 'undefined' && Notification.permission === 'default';

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <NotificationManager plan={smartPlan} settings={notificationSettings} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Sidebar view={view} setView={setView} isOpen={sidebarOpen} setOpen={setSidebarOpen} userDetails={userDetails} />
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
        {userDetails?.subscriptionTier === 'free' && <AdBanner setView={setView} />}
      </div>
       {activeSession?.type === 'break' && <BreakView session={activeSession} onEnd={handleBreakCompletion} />}
       <UpgradeModal
          isOpen={upgradeModalInfo.isOpen}
          onClose={() => handleShowUpgradeModal(false, '')}
          setView={setView}
          featureTitle={upgradeModalInfo.featureTitle}
        />
    </div>
  );
};

export default App;
