import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import MyTimetables from './components/MyTimetables';
import Progression from './components/Progression';
import Notes from './components/Notes';
import SignUp from './components/SignUp';
import ResetPassword from './components/ResetPassword';
import ToastContainer from './components/ToastContainer';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Feedback from './components/Feedback';
import Help from './components/Help';
import About from './components/About';
import UploadSlides from './components/UploadSlides';
import { ExamPrep } from './components/ExamPrep';
import BreakView from './components/BreakView';
import FocusedStudyView from './components/FocusedStudyView';
import Library from './components/Library';
import Terms from './components/Terms';
import Tutorial from './components/Tutorial';
import LanguageSettings from './components/Language';
import ThemeSettings from './components/Theme';
import NotificationSettingsComponent from './components/NotificationSettings';
import { CollaborativeSession } from './components/CollaborativeSession';
import { CloseIcon } from './components/icons/CloseIcon';
import NotificationManager from './components/NotificationManager';
import Welcome from './components/Welcome';
import UpgradeAnnouncementModal from './components/UpgradeAnnouncementModal';
import CollaborativeOnboarding from './components/CollaborativeOnboarding';
import EduBlayNotifications from './components/EduBlayNotifications';
import { getCurrentUser, logout, storageService, completeGoogleRedirect } from './services/authService';
import { auth } from './services/firebase';
import { globalFeedbackService } from './services/globalFeedbackService';
import type { UserDetails, SmartPlan, StoredPlan, Note, Toast, ActiveSession, LearningHubState, NotificationSettings, TrackedSession, GenerationState, QuizState, FlashcardState, DashboardInputState, ExamPrepState, ProfileEditState, NotesViewState, ReportDraft, PlanSlot, View, UploadedMaterialInfo, CourseCodeMap, FeatureName, ImagePart, UploadedFile, HistoryEntry } from './types';
// FIX: Added EducationalLevel to imports from types.ts to resolve the error on line 176
import { QuizType, ActivityType, EducationalLevel } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { timeToMinutes, processAndResizeImage } from './lib/utils';
import { initializeUsage, incrementUsage } from './lib/usageManager';
import { isStudyMaterial, getDocumentContext } from './services/geminiService';
import { LogoIcon } from './components/icons/LogoIcon';
import ConfirmationModal from './components/ConfirmationModal';
import History from './components/History';
import SessionBot from './components/SessionBot';
import { MobileBottomNav } from './components/PWAMobile';

const USER_KEY_PREFIX = 'eb_u_data_';

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
            setSettings({ status: 'configured', enabled: true, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
            return;
        }
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                setSettings({ status: 'configured', enabled: true, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
                new Notification(t('notifications.firstTime.enabled'), { body: t('notifications.firstTime.enabledBody') });
            } else {
                setSettings({ status: 'configured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
            }
        });
    };
    const handleDismiss = () => setSettings({ status: 'configured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true });
    return (
        <div className="bg-primary-dark text-white p-3 text-center z-50 shadow-md no-print animate-fade-in-down">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <p className="text-sm text-left">{t('notifications.firstTime.body')}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleFirstTimeEnable} className="px-3 py-1.5 text-sm font-semibold bg-white text-primary rounded-md hover:bg-gray-100 whitespace-nowrap">{t('notifications.firstTime.turnOn')}</button>
                    <button onClick={handleDismiss} className="text-sm font-medium hover:underline whitespace-nowrap">{t('notifications.firstTime.maybeLater')}</button>
                    <button onClick={handleDismiss} className="p-1 rounded-full hover:bg-white/20" aria-label={t('common.close')}><CloseIcon className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
};

const defaultNotificationSettings: NotificationSettings = { status: 'unconfigured', enabled: false, reminders: true, reminderTime: 10, sessionStart: true, breakStartEnd: true };
const defaultQuizState: QuizState = { quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null, timerSeconds: null };

const App: React.FC = () => {
  const { t } = useLanguage();
  const [isInitializing, setIsInitializing] = useState(true);
  // Tracks if handleLogin() already ran during this page load (e.g. popup sign-in).
  // If true, init() must NOT override isLoggedIn or welcomeComplete.
  const loginAlreadyHandled = React.useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUpgradeAnnouncement, setShowUpgradeAnnouncement] = useState(false);
  const [showCollabOnboarding, setShowCollabOnboarding] = useState(false);
  const [smartPlan, setSmartPlan] = useState<SmartPlan | null>(null);
  const [savedTimetables, setSavedTimetables] = useState<StoredPlan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sessionHistory, setSessionHistory] = useState<HistoryEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [learningHubState, setLearningHubState] = useState<LearningHubState>({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null, deep: null }, chatHistory: [], isProcessing: false, processingMessage: '' });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [trackedData, setTrackedData] = useState<TrackedSession[]>([]);
  const [uploadedMaterials, setUploadedMaterials] = useState<UploadedMaterialInfo[]>([]);
  const [generationState, setGenerationState] = useState<GenerationState>({ isLoading: false, message: '', error: null, source: 'dashboard' });
  const [quizState, setQuizState] = useState<QuizState>(defaultQuizState);
  const [flashcardState, setFlashcardState] = useState<FlashcardState>({ cards: [], currentIndex: 0, flipped: false, known: [], unknown: [], sessionDone: false });
  const [intendedStudyContext, setIntendedStudyContext] = useState<{ subject: string; fromSlot: PlanSlot } | null>(null);
  const [welcomeComplete, setWelcomeComplete] = useState(false);
  const [courseCodeMap, setCourseCodeMap] = useState<CourseCodeMap>({});
  const [activeCode, setActiveCode] = useState<string | null>(null);
  
  // Feedback notification state
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [lastFeedbackViewedTime, setLastFeedbackViewedTime] = useState<number>(0);

  // Tutorial Invitation State
  const [showTutorialInvitation, setShowTutorialInvitation] = useState(false);

  const [dashboardInputs, setDashboardInputs] = useState<DashboardInputState>({ lectures: [], studyGoals: [], agendaItems: [], generalGoals: '', imageFile: null, imagePreview: null, step: 1, isManualPlan: false, isEditing: false });
  const [examPrepState, setExamPrepState] = useState<ExamPrepState>({ mode: 'quiz', topic: '', numQuestions: 5, quizType: QuizType.MCQ, uploadedFiles: [], focusArea: '', isVerifying: false, quizTimerMinutes: 0, numFlashcards: 10, quizDifficulty: 'moderate', flashcardFiles: [], flashcardDifficulty: 'moderate', questionImage: null, questionText: '', solution: null, outputFormat: 'steps', programmingLanguage: 'python', graphInterval: '', graphYInterval: '', graphConfig: null });
  const [profileEditState, setProfileEditState] = useState<ProfileEditState>({ isEditing: false, details: null });
  const [notesViewState, setNotesViewState] = useState<NotesViewState>({ currentNoteId: null, searchTerm: '' });
  const [reportDraft, setReportDraft] = useState<ReportDraft>({ category: 'bug', description: '', attachment: null, contactEmail: '', contactWhatsApp: '' });

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const newToast = { id: Date.now(), message, type };
    setToasts(prev => [...prev, newToast]);
  }, []);

  // ── Auto-generate a session title using Gemini Flash ────────────────────
  const generateSessionTitle = async (type: 'chat' | 'quiz', context: string): Promise<string> => {
    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const prompt = type === 'chat'
            ? `Generate a short, specific 4-7 word title for a study chat session about: "${context}". Examples: "Cell Division Mechanisms Explained", "Newton's Laws of Motion Chat". Return ONLY the title, no quotes.`
            : `Generate a short, specific 4-7 word title for a quiz session about: "${context}". Examples: "Photosynthesis MCQ Quiz", "World War II Theory Test". Return ONLY the title, no quotes.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash',
            contents: prompt,
        });
        return (response.text || '').trim() || context;
    } catch {
        return context;
    }
  };

  // ── Save a completed chat session to history ──────────────────────────
  const saveChatToHistory = async (chatHistory: any[], documentName: string, documentContext: string) => {
    if (!chatHistory || chatHistory.length === 0) return;
    const title = await generateSessionTitle('chat', documentContext || documentName);
    const entry: HistoryEntry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        type: 'chat',
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chatHistory,
        documentName,
        documentContext,
    };
    setSessionHistory(prev => {
        // Update if same document already has a history entry today, else prepend
        const existing = prev.findIndex(e => e.type === 'chat' && e.documentName === documentName && 
            new Date(e.createdAt).toDateString() === new Date().toDateString());
        if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], chatHistory, updatedAt: new Date().toISOString() };
            return updated;
        }
        return [entry, ...prev];
    });
  };

  // ── Save a completed quiz session to history ──────────────────────────
  const saveQuizToHistory = async (quiz: any[], userAnswers: any[], summary: any, focusArea: string) => {
    if (!quiz || quiz.length === 0) return;
    const context = focusArea || quiz[0]?.topic || 'General Quiz';
    const title = await generateSessionTitle('quiz', context);
    const entry: HistoryEntry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        type: 'quiz',
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        quiz,
        userAnswers,
        quizSummary: summary,
        focusArea,
    };
    setSessionHistory(prev => [entry, ...prev]);
  };

  const persistAllState = useCallback(async () => {
    if (!userDetails?.email) return;
    const userId = auth.currentUser?.uid || userDetails.id || userDetails.email;
    const emailKey = `${USER_KEY_PREFIX}${userDetails.email}`;

    const localUserData = {
        userDetails, smartPlan, savedTimetables, notes, sessionHistory,
        notificationSettings, trackedData, uploadedMaterials,
        courseCodeMap,
        quizState: { quiz: quizState.quiz, currentQuestionIndex: quizState.currentQuestionIndex, userAnswers: quizState.userAnswers },
        learningHubState: { ...learningHubState, isProcessing: false },
        dashboardInputs: { ...dashboardInputs, imageFile: null }
    };
    
    await storageService.saveItem(emailKey, localUserData);

    const cloudUserData = JSON.parse(JSON.stringify(localUserData));
    if (cloudUserData.learningHubState?.file) cloudUserData.learningHubState.file.base64 = ""; 
    if (cloudUserData.dashboardInputs) {
        cloudUserData.dashboardInputs.imagePreview = null;
        cloudUserData.dashboardInputs.imageFile = null;
    }
    if (auth.currentUser) {
        await storageService.syncUserToCloud(auth.currentUser.uid, cloudUserData);
    }
  }, [userDetails, smartPlan, savedTimetables, notes, notificationSettings, trackedData, quizState, uploadedMaterials, courseCodeMap, learningHubState, dashboardInputs]);

    const loadUserData = useCallback(async (user: UserDetails) => {
        const emailKey = `${USER_KEY_PREFIX}${user.email}`;
        const userData = await storageService.loadItem<any>(emailKey);
        
        const applyState = (data: any) => {
            const finalUserDetails = { 
                ...user, 
                ...(data.userDetails || {}), 
                usage: (data.userDetails?.usage || user.usage || initializeUsage()) 
            };
            setUserDetails(finalUserDetails);
            setSmartPlan(data.smartPlan || null);
            setSessionHistory(data.sessionHistory || []);
            setSavedTimetables(data.savedTimetables || []);
            setNotes(data.notes || []);
            setTrackedData(data.trackedData || []);
            setUploadedMaterials(data.uploadedMaterials || []);
            setNotificationSettings(data.notificationSettings || defaultNotificationSettings);
            setCourseCodeMap(data.courseCodeMap || {});
            if (data.quizState && data.quizState.quiz?.length > 0) setQuizState({ ...defaultQuizState, ...data.quizState, feedback: null, summary: null });
            if (data.learningHubState) setLearningHubState(prev => ({ ...prev, ...data.learningHubState, isProcessing: false }));
            
            // STRICT STEP LOGIC: If details are not confirmed, they MUST start at Step 1.
            const needsConfirmation = !finalUserDetails.hasConfirmedDetails;
            
            if (data.dashboardInputs) {
                setDashboardInputs(prev => ({ 
                    ...prev, 
                    ...data.dashboardInputs, 
                    step: needsConfirmation ? 1 : (data.dashboardInputs.step || 1), 
                    imageFile: null 
                }));
            } else if (needsConfirmation) {
                setDashboardInputs(prev => ({ ...prev, step: 1 }));
            }
        };
        applyState(userData || {});
    }, []);

    const checkAndRun = async (
        feature: FeatureName,
        action: (...args: any[]) => Promise<void> | void,
        ...args: any[]
    ) => {
        if (!userDetails) return;
        try {
            await action(...args);
            setUserDetails(prev => prev ? { ...prev, usage: incrementUsage(prev.usage, feature) } : null);
            return true;
        } catch (e) {
            console.error(`Feature ${feature} error:`, e);
            return false; 
        }
    };

    // ── Office file text extractor ──────────────────────────────────────────
    // Gemini does not support PPTX/DOCX/PPT/DOC as inline data.
    // We extract all text client-side using JSZip (loaded via CDN in index.html)
    // and send it as plain text instead.
    const extractOfficeText = async (file: File): Promise<string> => {
        const JSZip = (window as any).JSZip;
        if (!JSZip) throw new Error('JSZip not loaded');

        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const fileName = file.name.toLowerCase();
        let allText = '';

        if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
            // PPTX: slides are in ppt/slides/slide*.xml
            const slideFiles = Object.keys(zip.files)
                .filter(name => name.match(/ppt\/slides\/slide[0-9]+\.xml$/))
                .sort();

            for (const slideName of slideFiles) {
                const xml = await zip.files[slideName].async('string');
                // Extract text from <a:t> tags (DrawingML text nodes)
                const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
                const slideText = matches
                    .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
                    .filter((t: string) => t.length > 0)
                    .join(' ');
                if (slideText) allText += slideText + '\n';
            }
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            // DOCX: content is in word/document.xml
            const docFile = zip.files['word/document.xml'];
            if (docFile) {
                const xml = await docFile.async('string');
                const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
                allText = matches
                    .map((m: string) => m.replace(/<[^>]+>/g, '').trim())
                    .filter((t: string) => t.length > 0)
                    .join(' ');
            }
        }

        if (!allText.trim()) {
            throw new Error(`Could not extract text from ${file.name}. The file may be empty or password-protected.`);
        }

        // Truncate to ~50,000 chars to stay within Gemini context limits
        return allText.trim().substring(0, 50000);
    };

    const handleNewMaterialUpload = useCallback(async (fileToProcess: File) => {
        if (!userDetails) return;
        
        const toBase64 = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

        const lower = fileToProcess.name.toLowerCase();

        // DOCX: convert to text via mammoth (or just accept and pass context)
        const isDocx = lower.endsWith('.docx');
        const isPdf = lower.endsWith('.pdf') || fileToProcess.type === 'application/pdf';
        const isImage = fileToProcess.type.startsWith('image/');

        if (!isPdf && !isImage && !isDocx) {
            addToast('Only PDF, images (JPG/PNG/WEBP), and DOCX files are supported.', 'error');
            return;
        }

        if (fileToProcess.size > 25 * 1024 * 1024) {
            addToast(`File too large. Maximum size is 25MB.`, 'error');
            return;
        }

        setLearningHubState(prev => ({...prev, isProcessing: true, processingMessage: 'Reading your file…'}));

        try {
            let base64String = '';
            let mimeType = fileToProcess.type;
            let fileContext = intendedStudyContext ? intendedStudyContext.fromSlot.activity : '';
            let finalSize = fileToProcess.size;

            if (isDocx) {
                // For DOCX: extract text using mammoth, then treat as plain text
                const mammoth = await import('mammoth');
                const arrayBuffer = await fileToProcess.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value;
                if (!text || text.trim().length < 20) {
                    addToast('This document appears to be empty or unreadable.', 'error');
                    setLearningHubState(prev => ({ ...prev, isProcessing: false, processingMessage: '' }));
                    return;
                }
                // Store text as base64 plain text
                base64String = btoa(unescape(encodeURIComponent(text)));
                mimeType = 'text/plain';
                if (!fileContext) {
                    fileContext = fileToProcess.name.replace(/\.[^/.]+$/, '');
                }
            } else {
                if (isImage) {
                    const resized = await processAndResizeImage(fileToProcess);
                    base64String = resized.base64;
                    mimeType = resized.mimeType;
                    finalSize = atob(base64String).length;
                } else {
                    base64String = await toBase64(fileToProcess);
                }

                if (!fileContext) {
                    setLearningHubState(prev => ({ ...prev, processingMessage: 'Identifying content…' }));
                    try {
                        const filePart: ImagePart = { inlineData: { data: base64String, mimeType } };
                        fileContext = await getDocumentContext(filePart, { fast: true });
                        if (!fileContext || fileContext.trim().length < 3) {
                            fileContext = fileToProcess.name.replace(/\.[^/.]+$/, '');
                        }
                    } catch {
                        fileContext = fileToProcess.name.replace(/\.[^/.]+$/, '');
                    }
                }
            }

            const processedFile: UploadedFile = {
                name: fileToProcess.name,
                type: mimeType,
                size: finalSize,
                base64: base64String,
                context: fileContext,
            };
            
            setLearningHubState(prev => ({ ...prev, file: processedFile, analysisMode: 'actions', analysisResults: { summarize: null, explain: null, read: null, deep: null }, chatHistory: [] }));
            
            const newMaterial: UploadedMaterialInfo = {
                name: processedFile.name,
                type: processedFile.type,
                size: processedFile.size,
                context: processedFile.context,
                uploadedAt: new Date().toISOString()
            };

            if (userDetails.id) {
                globalFeedbackService.trackMaterialUpload(userDetails.id).catch(console.error);
            }

            setUploadedMaterials(prevMaterials => {
                const isNew = !prevMaterials.some(m => m.name === newMaterial.name && m.size === newMaterial.size);
                if (isNew) {
                    return [...prevMaterials, newMaterial];
                }
                return prevMaterials;
            });

        } catch (error: any) {
            // Convert technical errors into plain English the user can understand
            let msg = error?.message || '';
            if (!msg || msg.length < 5) {
                msg = 'Something went wrong while processing your file. Please try again with a different file.';
            } else if (msg.includes('400') || msg.includes('Bad Request')) {
                msg = 'Your file could not be read. This usually means the file is corrupted or in a format that is not supported. Please try converting it to PDF and uploading again.';
            } else if (msg.includes('413') || msg.includes('too large') || msg.includes('size')) {
                msg = 'Your file is too large. Please reduce the file size to under 25 MB and try again.';
            } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
                msg = 'A network error occurred. Please check your internet connection and try again.';
            } else if (msg.includes('timeout') || msg.includes('DEADLINE')) {
                msg = 'The request took too long. Please try again — if it keeps failing, try with a smaller file.';
            } else if (msg.includes('SAFETY') || msg.includes('blocked')) {
                msg = 'Your file was blocked by the content filter. Please make sure you are uploading academic or educational material.';
            }
            addToast(msg, 'error');
            throw error;
        } finally {
            setLearningHubState(prev => ({...prev, isProcessing: false, processingMessage: ''}));
        }
    }, [addToast, t, userDetails, intendedStudyContext]);

    const handleSavePlanAttempt = (planName: string) => {
        checkAndRun('timetables', () => {
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
        checkAndRun('uploads', () => handleNewMaterialUpload(file));
    };

    const handleGenerateQuizAttempt = (apiAction: () => Promise<void>) => {
        checkAndRun('quizzes', apiAction);
    };

    const handleSolveProblemAttempt = (apiAction: () => Promise<void>) => {
        checkAndRun('solves', apiAction);
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

    useEffect(() => {
        const init = async () => {
            try {
                // ── Google redirect completion ────────────────────────────────
                // When signInWithRedirect is used (installed PWA only), Firebase
                // navigates away and back. getRedirectResult() must be called on
                // the return load to retrieve the auth credential.
                // This MUST run before getCurrentUser() so the auth state is set.
                try {
                    const redirectUser = await completeGoogleRedirect();
                    if (redirectUser) {
                        await loadUserData(redirectUser);
                        setIsLoggedIn(true);
                        setWelcomeComplete(true);
                        setTimeout(() => setIsInitializing(false), 100);
                        return; // done — skip the rest of init
                    }
                } catch (redirectErr) {
                    // Not a redirect return — safe to ignore
                    console.debug('[Auth] No redirect result:', redirectErr);
                }

                // ── RACE CONDITION GUARD ─────────────────────────────────────
                // If handleLogin() already ran (e.g. Google popup completed while
                // init() was still awaiting), do not override the logged-in state.
                // getCurrentUser() calls waitForAuthInit() which can take several
                // seconds — in that time the user may have already authenticated.
                if (loginAlreadyHandled.current) {
                    return; // user already logged in via popup — leave state alone
                }

                const user = await getCurrentUser();

                // Check again after the async wait — popup may have completed
                if (loginAlreadyHandled.current) {
                    return;
                }

                const lastView = await storageService.loadItem<number>('lastFeedbackViewedTime');
                
                // Only reset welcome if we're sure no login happened
                setWelcomeComplete(false);
                setLastFeedbackViewedTime(lastView || 0);

                if (user) {
                    await loadUserData(user);
                    setIsLoggedIn(true);
                }
            } catch (error) {
                console.error("Initialization error:", error);
            } finally {
                setTimeout(() => setIsInitializing(false), 100);
            }
        };
        init();
    }, [loadUserData]);
  
  useEffect(() => {
    const handler = setTimeout(() => { if (isLoggedIn) persistAllState(); }, 2000); 
    return () => clearTimeout(handler);
  }, [isLoggedIn, persistAllState]);

  // Persist sessionHistory immediately whenever it changes so History tab always shows current data
  useEffect(() => {
    if (!isLoggedIn || sessionHistory.length === 0) return;
    const handler = setTimeout(() => { persistAllState(); }, 500);
    return () => clearTimeout(handler);
  }, [sessionHistory, isLoggedIn, persistAllState]);

  // Real-time listener for global feedback messages to manage unread badge
  useEffect(() => {
    if (!isLoggedIn || view === 'feedback') {
        if (view === 'feedback') setUnreadFeedbackCount(0);
        return;
    }
    
    const unsubscribe = globalFeedbackService.subscribeToComments((comments) => {
        if ((view as string) === 'feedback') {
            setUnreadFeedbackCount(0);
            return;
        }
        
        const unread = comments.filter(c => {
            if (!c.timestamp) return false;
            const msgTime = c.timestamp.toDate ? c.timestamp.toDate().getTime() : new Date(c.timestamp).getTime();
            return msgTime > lastFeedbackViewedTime;
        });
        setUnreadFeedbackCount(unread.length);
    });

    return () => unsubscribe();
  }, [isLoggedIn, lastFeedbackViewedTime, view]);

  // Clear unread count when entering feedback view
  useEffect(() => {
    if (view === 'feedback') {
        const now = Date.now();
        setUnreadFeedbackCount(0);
        setLastFeedbackViewedTime(now);
        storageService.saveItem('lastFeedbackViewedTime', now);
    }
  }, [view]);

  const handleLogin = async (user: UserDetails) => {
    // Mark immediately so that the background init() doesn't override our state
    loginAlreadyHandled.current = true;
    await loadUserData(user);
    setIsLoggedIn(true);
    // Show upgrade announcement once per user per update cycle
    const upgradeKey = `seen_upgrade_v2_collab_flash_${user.email || user.id}`;
    const hasSeen = await storageService.loadItem<boolean>(upgradeKey);
    if (!hasSeen) {
        setTimeout(() => setShowUpgradeAnnouncement(true), 800);
        await storageService.saveItem(upgradeKey, true);
    }
  };

  const handleLogout = async () => {
    await persistAllState(); 
    await logout();
    setUserDetails(null);
    setIsLoggedIn(false);
    setSmartPlan(null);
    setSavedTimetables([]);
    setNotes([]);
    setActiveSession(null);
    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null, deep: null }, chatHistory: [], isProcessing: false });
    addToast(t('auth.logoutSuccess'), 'info');
  };

  const handleWelcomeComplete = () => {
      // Only in-memory — Welcome shows every time on fresh load (not skipped)
      setWelcomeComplete(true);
  };
  
  const handleDetailsConfirmed = async () => {
      if (!userDetails?.email) return;
      
      // Update User Details with the confirmation flag
      const updatedUser = { ...userDetails, hasConfirmedDetails: true };
      setUserDetails(updatedUser);
      
      // Save details immediately when confirmed
      const emailKey = `${USER_KEY_PREFIX}${userDetails.email}`;
      const localUserData = await storageService.loadItem<any>(emailKey) || {};
      await storageService.saveItem(emailKey, { ...localUserData, userDetails: updatedUser });
      if (auth.currentUser) {
          await storageService.syncUserToCloud(auth.currentUser.uid, { ...localUserData, userDetails: updatedUser });
      }
      
      const key = `has_seen_tutorial_invitation_${userDetails.email}`;
      const hasSeen = await storageService.loadItem<boolean>(key);
      if (!hasSeen) {
          setShowTutorialInvitation(true);
      }
  };

  const handleTutorialConfirm = async () => {
      if (userDetails?.email) {
          await storageService.saveItem(`has_seen_tutorial_invitation_${userDetails.email}`, true);
      }
      setShowTutorialInvitation(false);
      setView('tutorial');
  };

  const handleTutorialCancel = async () => {
      if (userDetails?.email) {
          await storageService.saveItem(`has_seen_tutorial_invitation_${userDetails.email}`, true);
      }
      setShowTutorialInvitation(false);
  };

  const isResetPasswordRoute = window.location.pathname === '/reset-password' || window.location.search.includes('mode=resetPassword');

  if (isResetPasswordRoute) {
      return <ResetPassword onBack={() => { window.history.replaceState({}, '', '/'); setWelcomeComplete(true); setIsLoggedIn(false); }} />;
  }

  if (isInitializing) {
      return (
          <div className="flex flex-col h-screen h-[100dvh] bg-gray-100 dark:bg-gray-900 items-center justify-center">
              <div className="relative">
                  <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><LogoIcon className="w-8 h-8 text-primary animate-pulse" /></div>
              </div>
              <h1 className="mt-4 text-xl font-bold text-gray-800 dark:text-white tracking-wide">EduBlay</h1>
          </div>
      );
  }

  if (!isLoggedIn) {
    if (!welcomeComplete) return <Welcome onProceed={handleWelcomeComplete} />;
    return <SignUp onLogin={handleLogin} />;
  }
  
  if (activeSession?.type === 'study') {
     return <FocusedStudyView session={activeSession!} setSession={setActiveSession} addToast={addToast} trackedData={trackedData} setTrackedData={setTrackedData} setView={setView} learningHubState={learningHubState} setLearningHubState={setLearningHubState} addActivity={() => {}} />;
  }
  
  const showNotifPrompt = notificationSettings.status === 'unconfigured' && typeof Notification !== 'undefined' && Notification.permission === 'default';

  return (
    <div className="flex h-screen h-[100dvh] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <NotificationManager plan={smartPlan} settings={notificationSettings} />
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <EduBlayNotifications userDetails={userDetails} addToast={addToast} />

      {/* ── One-time upgrade announcement ─────────────────────── */}
      {showUpgradeAnnouncement && (
          <UpgradeAnnouncementModal
              onClose={() => setShowUpgradeAnnouncement(false)}
              onGoToCollaborative={() => { setShowUpgradeAnnouncement(false); setView('collaborative'); }}
              onGoToExamPrep={() => { setShowUpgradeAnnouncement(false); setView('examprep'); }}
          />
      )}

      {/* ── Collaborative session first-visit onboarding ──────── */}
      {showCollabOnboarding && (
          <CollaborativeOnboarding
              onComplete={() => setShowCollabOnboarding(false)}
          />
      )}
      <Sidebar view={view} setView={setView} isOpen={sidebarOpen} setOpen={setSidebarOpen} userDetails={userDetails} unreadFeedbackCount={unreadFeedbackCount} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {showNotifPrompt && <NotificationPrompt settings={notificationSettings} setSettings={setNotificationSettings} />}
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} userDetails={userDetails} setView={setView} addToast={addToast} handleLogout={handleLogout} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ position: 'relative', background: 'transparent' }}>
          {/* EduBlay interactive animated background */}
          <div aria-hidden="true" className="edublay-main-bg" style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/edublay-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center bottom', backgroundRepeat: 'no-repeat', zIndex: 0, pointerEvents: 'none' }} />
          <div aria-hidden="true" className="edublay-main-bg-overlay" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
          {(() => {
              if (view === 'collaborative') {
                // Show onboarding on first visit
                const checkCollabOnboarding = async () => {
                    const key = `seen_collab_onboarding_${userDetails?.email || 'guest'}`;
                    const hasSeen = await storageService.loadItem<boolean>(key);
                    if (!hasSeen) {
                        setShowCollabOnboarding(true);
                        await storageService.saveItem(key, true);
                    }
                };
                // Only trigger if not already showing
                if (!showCollabOnboarding) checkCollabOnboarding();
                return <CollaborativeSession userDetails={userDetails} addToast={addToast} onActionAttempt={(a) => a()} activeCode={activeCode} setActiveCode={setActiveCode} notes={notes} setNotes={setNotes} />;
              }
              switch (view) {
                case 'dashboard': return <Dashboard setSmartPlan={setSmartPlan} smartPlan={smartPlan} userDetails={userDetails} setUserDetails={setUserDetails} savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} addToast={addToast} setActiveSession={setActiveSession} trackedData={trackedData} setTrackedData={setTrackedData} generationState={generationState} setGenerationState={setGenerationState} dashboardInputs={dashboardInputs} setDashboardInputs={setDashboardInputs} setView={setView} setIntendedStudyContext={setIntendedStudyContext} setLearningHubState={setLearningHubState} courseCodeMap={courseCodeMap} setCourseCodeMap={setCourseCodeMap} onSavePlanAttempt={handleSavePlanAttempt} onDetailsConfirmed={handleDetailsConfirmed} />;
                case 'profile': return <Profile userDetails={userDetails} setUserDetails={setUserDetails} addToast={addToast} profileEditState={profileEditState} setProfileEditState={setProfileEditState} />;
                case 'mytimetables': return <MyTimetables savedTimetables={savedTimetables} setSavedTimetables={setSavedTimetables} onLoadPlan={(plan) => { setSmartPlan(plan); setView('dashboard'); }} addToast={addToast} userDetails={userDetails} />;
                case 'progression': return <Progression plan={smartPlan} trackedData={trackedData} userDetails={userDetails} />;
                case 'notes': return <Notes notes={notes} setNotes={setNotes} notesViewState={notesViewState} setNotesViewState={setNotesViewState} userDetails={userDetails} onMaterialTracked={() => { if(userDetails?.id) globalFeedbackService.trackMaterialUpload(userDetails.id).catch(console.error); }} addActivity={() => {}} />;
                case 'uploadslides': return <UploadSlides smartPlan={smartPlan} setSmartPlan={setSmartPlan} activeSession={activeSession} setActiveSession={setActiveSession} setView={setView} addToast={addToast} learningHubState={learningHubState} setLearningHubState={setLearningHubState} notes={notes} setNotes={setNotes} intendedStudyContext={intendedStudyContext} setIntendedStudyContext={setIntendedStudyContext} onAttemptUpload={(f) => handleNewMaterialUploadAttempt(f)} onSaveChatToHistory={saveChatToHistory} />;
                case 'examprep': return <ExamPrep addToast={addToast} setView={setView} generationState={generationState} setGenerationState={setGenerationState} quizState={quizState} setQuizState={setQuizState} flashcardState={flashcardState} setFlashcardState={setFlashcardState} notes={notes} setNotes={setNotes} examPrepState={examPrepState} setExamPrepState={setExamPrepState} onGenerateQuizAttempt={handleGenerateQuizAttempt} onSolveProblemAttempt={handleSolveProblemAttempt} onSaveQuizToHistory={saveQuizToHistory} />;
                case 'language': return <LanguageSettings />;
                case 'theme': return <ThemeSettings />;
                case 'notification': return <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />;
                case 'settings': return <Settings addToast={addToast} handleLogout={handleLogout} userDetails={userDetails} setShowUpgradeModal={() => {}} />;
                case 'report': return <Reports userDetails={userDetails} reportDraft={reportDraft} setReportDraft={setReportDraft} addToast={addToast} />;
                case 'feedback': return <Feedback userDetails={userDetails} addToast={addToast} />;
                case 'help': return <Help setView={setView} />;
                case 'about': return <About setView={setView} />;
                case 'library': return <Library />;
                case 'terms': return <Terms />;
                case 'tutorial': return <Tutorial addToast={addToast} tutorialVideoUrl='https://youtu.be/f14AwLpLb9E' />;
                case 'history': return <History history={sessionHistory} setHistory={setSessionHistory} setView={setView} setLearningHubState={setLearningHubState} setQuizState={setQuizState} addToast={addToast} />;
                default: return <div>{t('common.notFound')}</div>;
              }
          })()}
          </div>
        </main>
      </div>
       {activeSession?.type === 'break' && <BreakView session={activeSession} onEnd={handleBreakCompletion} />}

       {/* ── Session Help Bot ── */}
       <SessionBot view={view} userEmail={userDetails?.email} />

       {/* ── Mobile Bottom Navigation Bar ── */}
       {!['collaborative', 'uploadslides', 'examprep'].includes(view) && <MobileBottomNav view={view} setView={setView} unreadFeedbackCount={unreadFeedbackCount} />}

       <ConfirmationModal
           isOpen={showTutorialInvitation}
           onClose={handleTutorialCancel}
           onConfirm={handleTutorialConfirm}
           title="Welcome to EduBlay!"
           message="Profile Details Confirmed! To help you get started, we recommend visiting our Tutorial section to watch a quick video on how the app works."
           confirmText="Proceed to Tutorial"
           cancelText="Later"
           confirmColor="blue"
       />
    </div>
  );
};

export default App;