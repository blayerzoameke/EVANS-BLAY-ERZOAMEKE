import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
    isStudyMaterial, 
    getDocumentContext,
    summarizeDocument,
    explainDocument,
    chatWithDocumentStream,
    extractTextFromDocument
} from '../services/geminiService';
import type { 
    UploadedFile, 
    SmartPlan, 
    ActiveSession, 
    PlanSlot, 
    Toast,
    Note,
    LearningHubState,
    ChatTurn,
    AnalysisMode,
    ConflictInfo
} from '../types';
import { DayOfWeek, ActivityType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';
import { PdfIcon } from './icons/PdfIcon';
import { PowerPointIcon } from './icons/PowerPointIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import StudyModeSetupModal from './StudyModeSetupModal';
import SchedulePromptModal from './SchedulePromptModal';
import UntrackedStudySetupModal from './UntrackedStudySetupModal';
import ConflictResolutionModal from './ConflictResolutionModal';
// FIX: Changed to a type import and added the .tsx extension.
import type { View } from '../App.tsx';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { StopIcon } from './icons/StopIcon';
import { PencilIcon } from './icons/PencilIcon.tsx';

// Declare katex and Chart as a global variables to satisfy TypeScript since they're loaded from CDN
declare const katex: {
    renderToString(tex: string, options?: any): string;
} | undefined;
declare const Chart: any;

const CopyIconInline: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);


const InteractiveGraph: React.FC<{ graphData: { function: string; domain: [number, number] } }> = ({ graphData }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null); // To hold the chart instance

    useEffect(() => {
        if (!canvasRef.current) return;

        const { function: funcStr, domain } = graphData;
        const labels = [];
        const data = [];
        const step = (domain[1] - domain[0]) / 100; // 100 points for the graph

        try {
            const func = new Function('x', `return ${funcStr}`);

            for (let x = domain[0]; x <= domain[1]; x += step) {
                labels.push(x.toFixed(2));
                data.push(func(x));
            }
        } catch (error) {
            console.error("Error evaluating graph function:", error);
            // Optionally render an error state for the graph
            return;
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        // Destroy previous chart instance if it exists
        if (chartRef.current) {
            chartRef.current.destroy();
        }

        chartRef.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `f(x) = ${funcStr.replace(/\*\*/g, '^').replace(/Math\./g, '')}`,
                    data: data,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        title: { display: true, text: 'x' },
                    },
                    y: {
                        title: { display: true, text: 'f(x)' },
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                },
            }
        });

        // Cleanup function to destroy chart on component unmount
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [graphData]);

    return (
        <div className="my-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <canvas ref={canvasRef}></canvas>
        </div>
    );
};

const FormattedContent: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return null;

    // This regex is ordered to match display LaTeX ($$) before inline ($).
    const regex = /(\$\$[\s\S]*?\$\$|\$.*?\$|\*\*.*?\*\*|\{\s*"graph":[\s\S]*?\})/g;
    const parts = content.split(regex);

    return (
        <div className="whitespace-pre-wrap leading-relaxed prose dark:prose-invert max-w-none">
            {parts.map((part, index) => {
                if (!part) return null;

                // Check for Display LaTeX
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    if (typeof katex !== 'undefined') {
                        const html = katex.renderToString(part.slice(2, -2), { throwOnError: false, displayMode: true });
                        return <div key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                    }
                }
                // Check for Inline LaTeX
                else if (part.startsWith('$') && part.endsWith('$')) {
                     if (typeof katex !== 'undefined') {
                        const html = katex.renderToString(part.slice(1, -1), { throwOnError: false, displayMode: false });
                        return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
                    }
                }
                // Check for Bold
                else if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index}>{part.slice(2, -2)}</strong>;
                }
                // Check for Graph JSON
                else if (part.trim().startsWith('{') && part.includes('"graph"')) {
                    try {
                        const jsonPart = part.substring(part.indexOf('{'), part.lastIndexOf('}') + 1);
                        const graphData = JSON.parse(jsonPart);
                        if (graphData.graph) {
                            return <InteractiveGraph key={index} graphData={graphData.graph} />;
                        }
                    } catch (e) { /* Fallback to text */ }
                }
                
                // Otherwise, it's just plain text.
                return <span key={index}>{part}</span>;
            })}
        </div>
    );
};


const timeToMinutes = (time: string): number => {
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
};

const getDayOfWeek = (date: Date): DayOfWeek => {
    const dayIndex = date.getDay(); // Sunday - 0, Monday - 1, ...
    const days: DayOfWeek[] = [DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday];
    return days[dayIndex];
};

interface UploadSlidesProps {
    smartPlan: SmartPlan | null;
    setSmartPlan: (plan: SmartPlan) => void;
    activeSession: ActiveSession | null;
    setActiveSession: (session: ActiveSession | null) => void;
    setView: (view: View) => void;
    addToast: (message: string, type: Toast['type']) => void;
    learningHubState: LearningHubState;
    setLearningHubState: (state: LearningHubState) => void;
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    showTitle: boolean;
    isStudyModeView?: boolean;
}

const UploadSlides: React.FC<UploadSlidesProps> = ({ 
    smartPlan, setSmartPlan, activeSession, setActiveSession, setView, addToast,
    learningHubState, setLearningHubState, notes, setNotes, showTitle,
    isStudyModeView = false,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [isSchedulePromptOpen, setIsSchedulePromptOpen] = useState(false);
    const [isUntrackedSetupModalOpen, setIsUntrackedSetupModalOpen] = useState(false);
    
    const [studySlotToStart, setStudySlotToStart] = useState<PlanSlot | null>(null);
    const [breakSlotForStudy, setBreakSlotForStudy] = useState<PlanSlot | null>(null);
    const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [isReading, setIsReading] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);


    const { t } = useLanguage();
    const { file, analysisMode, analysisResults, chatHistory } = learningHubState;

    const updateLearningHubState = (updates: Partial<LearningHubState>) => {
        setLearningHubState({ ...learningHubState, ...updates });
    };

    const processFile = async (acceptedFile: File) => {
        setIsLoading(true);
        setError(null);
        setLoadingMessage(t('uploadslides.verifying'));
        
        // Clear previous session data when a new file is uploaded
        updateLearningHubState({ 
            file: null, 
            analysisMode: 'none', 
            analysisResults: { summarize: null, explain: null, read: null }, 
            chatHistory: [] 
        });

        const reader = new FileReader();
        reader.readAsDataURL(acceptedFile);
        reader.onloadend = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1];
                const filePart = { inlineData: { data: base64, mimeType: acceptedFile.type } };

                const isMaterial = await isStudyMaterial(filePart);
                if (!isMaterial) {
                    setError(t('uploadslides.error.notStudyMaterial'));
                    setIsLoading(false);
                    return;
                }
                
                setLoadingMessage(t('uploadslides.analyzing'));
                const context = await getDocumentContext(filePart);
                
                updateLearningHubState({
                    file: {
                        name: acceptedFile.name,
                        type: acceptedFile.type,
                        size: acceptedFile.size,
                        base64,
                        context
                    }
                });
            } catch (e: any) {
                setError(e.message || t('uploadslides.error.generic'));
            } finally {
                setIsLoading(false);
            }
        };
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            processFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.jpeg', '.jpg', '.png'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
        },
        multiple: false,
        disabled: isLoading,
    });
    
    const clearFile = () => {
        updateLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] });
        setError(null);
    };

    const handleToolClick = async (mode: AnalysisMode) => {
        if (!file) return;

        // If result already exists, just switch view without re-fetching
        if (
            (mode === 'summarize' && analysisResults.summarize) ||
            (mode === 'explain' && analysisResults.explain) ||
            (mode === 'read' && analysisResults.read)
        ) {
            updateLearningHubState({ analysisMode: mode });
            return;
        }

        updateLearningHubState({ analysisMode: mode });
        if (mode === 'chat') return; // Chat doesn't have an initial analysis

        setIsAnalyzing(true);
        const filePart = { inlineData: { data: file.base64, mimeType: file.type } };
        
        try {
            let result = '';
            const currentResults = learningHubState.analysisResults;
            if (mode === 'summarize') {
                 setLoadingMessage(t('uploadslides.loading.summarize'));
                 result = await summarizeDocument(filePart, file.context);
                 updateLearningHubState({ analysisResults: { ...currentResults, summarize: result } });
            } else if (mode === 'explain') {
                setLoadingMessage(t('uploadslides.loading.explain'));
                result = await explainDocument(filePart, file.context);
                updateLearningHubState({ analysisResults: { ...currentResults, explain: result } });
            } else if (mode === 'read') {
                setLoadingMessage(t('uploadslides.loading.read'));
                result = await extractTextFromDocument(filePart);
                updateLearningHubState({ analysisResults: { ...currentResults, read: result } });
            }
        } catch (e: any) {
             setError(e.message || "Failed to analyze document.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !file) return;

        const userMessage = chatInput;
        setChatInput('');

        const historyForApi = [...learningHubState.chatHistory];
        const newHistoryWithUser = [...historyForApi, { user: userMessage, blay: '' }];
        updateLearningHubState({ chatHistory: newHistoryWithUser });

        setIsAnalyzing(true);
        setError(null);

        const filePart = { inlineData: { data: file.base64, mimeType: file.type } };
        try {
            const stream = await chatWithDocumentStream(filePart, userMessage, historyForApi, file.context);
            
            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk.text;
                updateLearningHubState({
                    chatHistory: newHistoryWithUser.map((turn, index) => 
                        index === newHistoryWithUser.length - 1 
                        ? { ...turn, blay: fullResponse } 
                        : turn
                    )
                });
            }
        } catch (e: any) {
            const errorMessage = e.message || "Blay is having trouble responding right now.";
            updateLearningHubState({
                chatHistory: newHistoryWithUser.map((turn, index) => 
                    index === newHistoryWithUser.length - 1 
                    ? { ...turn, blay: `Error: ${errorMessage}` } 
                    : turn
                )
            });
            setError(errorMessage);
        } finally {
             setIsAnalyzing(false);
        }
    };

    const handleCopyMessage = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            addToast(t('toasts.copied'), 'success');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    const handleEditMessage = (text: string) => {
        setChatInput(text);
        chatInputRef.current?.focus();
    };
    
    // --- Speech Synthesis Logic ---
    const handleReadAloud = () => {
        if (isReading) { // Is currently speaking, so pause
            window.speechSynthesis.pause();
            setIsReading(false);
        } else {
             if (window.speechSynthesis.paused && utteranceRef.current) { // Is paused, so resume
                window.speechSynthesis.resume();
            } else if (analysisResults.read) { // Is not speaking, start new
                const utterance = new SpeechSynthesisUtterance(analysisResults.read);
                utterance.onend = () => {
                    setIsReading(false);
                    utteranceRef.current = null;
                };
                // FIX: Corrected typo from `utterance.current` to `utteranceRef.current`.
                utteranceRef.current = utterance;
                window.speechSynthesis.cancel(); // Cancel any previous speech
                window.speechSynthesis.speak(utterance);
            }
            setIsReading(true);
        }
    };
    
    const handleStopReading = () => {
        window.speechSynthesis.cancel();
        setIsReading(false);
        utteranceRef.current = null;
    };
    
    useEffect(() => {
        // Cleanup speech synthesis on component unmount or when analysis result changes
        return () => window.speechSynthesis.cancel();
    }, [analysisResults.read]);
    
    const handleSaveToNotes = () => {
        if (!file) return;

        let contentToSave: string | null = null;
        let titlePrefix: string = '';

        if (analysisMode === 'summarize' && analysisResults.summarize) {
            contentToSave = analysisResults.summarize;
            titlePrefix = 'Summary';
        } else if (analysisMode === 'explain' && analysisResults.explain) {
            contentToSave = analysisResults.explain;
            titlePrefix = 'Explanation';
        }
        
        if (!contentToSave) return;
        
        const newNote: Note = {
            id: Date.now().toString(),
            title: `${titlePrefix}: ${file.name}`,
            content: contentToSave,
            subject: file.context,
            createdAt: new Date().toISOString(),
            isFavourite: false,
        };
        setNotes([newNote, ...notes]);
        addToast(t('toasts.noteSaved'), 'success');
        updateLearningHubState({ analysisMode: 'none' });
    };

    // --- Study Session Logic ---
    const startSession = (slot: PlanSlot, untracked = false, virtualNextSlot: PlanSlot | null = null) => {
        const now = Date.now();
        const duration = untracked ? (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)) : (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
        const endTime = now + (duration * 60 * 1000);

        let nextSlot: PlanSlot | null = null;
        if (untracked) {
            nextSlot = virtualNextSlot;
        } else {
            const today = getDayOfWeek(new Date());
            const dayPlan = smartPlan?.find(d => d.day === today);
            const slotIndex = dayPlan?.slots.findIndex(s => s === slot) ?? -1;
            if (dayPlan && slotIndex !== -1 && slotIndex + 1 < dayPlan.slots.length) {
                nextSlot = dayPlan.slots[slotIndex + 1];
            }
        }
        
        setActiveSession({
            startTime: now,
            endTime: endTime,
            subject: slot.activity,
            type: 'study',
            fromSlot: slot,
            nextSlot: (nextSlot && nextSlot.type === ActivityType.BREAK) ? nextSlot : null,
            isLearningHubSession: true,
            isUntracked: untracked,
        });

        addToast(t('toasts.sessionStarted'), 'success');
    };
    
    const handleStudyThisNow = () => {
        if (activeSession) {
            addToast("A session is already active.", 'info');
            return;
        }
        
        if (!smartPlan) {
            setIsUntrackedSetupModalOpen(true);
            return;
        }

        const availableSlots = getAvailableStudySlots();
        if (availableSlots.length > 0) {
            const nextSlot = availableSlots[0];
            const uploadedSubject = file?.context || "material";
            const plannedSubject = nextSlot.activity;
            
            // Check for conflict
            if (!plannedSubject.toLowerCase().includes(uploadedSubject.toLowerCase()) && !uploadedSubject.toLowerCase().includes(plannedSubject.toLowerCase())) {
                setConflictInfo({
                    plannedSubject,
                    uploadedSubject,
                    slot: nextSlot,
                    day: getDayOfWeek(new Date())
                });
            } else {
                handleStartSetup(nextSlot);
            }
        } else {
            setIsSchedulePromptOpen(true);
        }
    };
    
    const handleStartSetup = (studySlot: PlanSlot) => {
        const today = getDayOfWeek(new Date());
        const dayPlan = smartPlan?.find(d => d.day === today);
        const slotIndex = dayPlan?.slots.findIndex(s => s === studySlot) ?? -1;
        const nextSlot = (dayPlan && slotIndex !== -1 && slotIndex + 1 < dayPlan.slots.length)
            ? dayPlan.slots[slotIndex + 1]
            : null;

        if (nextSlot && nextSlot.type === ActivityType.BREAK) {
            setBreakSlotForStudy(nextSlot);
        } else {
            setBreakSlotForStudy(null);
        }
        setStudySlotToStart(studySlot);
        setIsSetupModalOpen(true);
    };
    
    const confirmStartSession = (breakConfig: { breakActivity: string; breakLink: string }) => {
        if (!studySlotToStart) return;

        // Modify the next break slot if details were provided
        if (breakSlotForStudy && smartPlan) {
            const today = getDayOfWeek(new Date());
            const updatedPlan = smartPlan.map(dayPlan => {
                if (dayPlan.day === today) {
                    return {
                        ...dayPlan,
                        slots: dayPlan.slots.map(slot => {
                            if (slot === breakSlotForStudy) {
                                return {
                                    ...slot,
                                    activity: breakConfig.breakActivity || slot.activity,
                                    link: breakConfig.breakLink || slot.link
                                };
                            }
                            return slot;
                        })
                    };
                }
                return dayPlan;
            });
            setSmartPlan(updatedPlan);
        }

        startSession(studySlotToStart);
        setIsSetupModalOpen(false);
    };

    const handleStartUntrackedSession = (config: { studyDuration: number; breakDuration: number; breakActivity: string; breakLink: string }) => {
        const now = new Date();
        const studyStartTime = now;
        const studyEndTime = new Date(now.getTime() + config.studyDuration * 60 * 1000);
    
        const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
        const virtualStudySlot: PlanSlot = {
            activity: file?.context || "Self-Study",
            startTime: formatTime(studyStartTime),
            endTime: formatTime(studyEndTime),
            type: ActivityType.STUDY,
        };
    
        let virtualBreakSlot: PlanSlot | null = null;
        if (config.breakDuration > 0) {
            const breakStartTime = studyEndTime;
            const breakEndTime = new Date(breakStartTime.getTime() + config.breakDuration * 60 * 1000);
            virtualBreakSlot = {
                activity: config.breakActivity || "Break",
                startTime: formatTime(breakStartTime),
                endTime: formatTime(breakEndTime),
                type: ActivityType.BREAK,
                link: config.breakLink || undefined,
            };
        }
    
        startSession(virtualStudySlot, true, virtualBreakSlot);
        setIsUntrackedSetupModalOpen(false);
    };


    const getAvailableStudySlots = () => {
        if (!smartPlan) return [];
        const now = new Date();
        const today = getDayOfWeek(now);
        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
        
        const todayPlan = smartPlan.find(d => d.day === today);
        if (!todayPlan) return [];

        return todayPlan.slots.filter(slot => 
            slot.type === ActivityType.STUDY && 
            timeToMinutes(slot.endTime) > currentTimeInMinutes
        );
    };
    
    if (isStudyModeView && file) {
        if (file.type.includes('pdf') || file.type.includes('image')) {
             return <iframe src={`data:${file.type};base64,${file.base64}`} className="w-full h-full border-0" title={file.name} />;
        }
        return (
             <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 p-8">
                <PowerPointIcon className="w-24 h-24 text-orange-500 mb-4" />
                <p className="text-xl font-semibold text-center">{t('uploadslides.powerpoint.studyPrompt')}</p>
                <p className="text-center text-slate-500 mt-2">{file.name}</p>
            </div>
        );
    }
    
    if (!file) {
        return (
            <div className="max-w-4xl mx-auto text-center">
                {showTitle && <>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('uploadslides.title')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 mb-8">{t('uploadslides.subtitle')}</p>
                </>}

                <div {...getRootProps()} className={`group p-12 border-2 border-dashed rounded-lg transition-colors ${isDragActive ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-300 dark:border-gray-600'} ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-teal-400'}`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 transition-colors group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        <UploadIcon className="w-16 h-16 mb-4 transition-transform group-hover:scale-110" />
                        <p className="font-semibold text-lg">{isLoading ? loadingMessage : t('uploadslides.dropPrompt')}</p>
                        <p className="text-sm">{t('uploadslides.supportedFormats')}</p>
                    </div>
                </div>
                 {error && <p className="mt-4 text-red-500">{error}</p>}
            </div>
        );
    }
    
    const analysisResultToDisplay = 
        analysisMode === 'summarize' ? analysisResults.summarize :
        analysisMode === 'explain' ? analysisResults.explain :
        analysisMode === 'read' ? analysisResults.read :
        null;

    return (
        <div className="max-w-4xl mx-auto">
            {showTitle && <button onClick={clearFile} className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                <ArrowLeftIcon className="w-4 h-4" /> {t('uploadslides.back')}
            </button>}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-8">
                <div className="flex flex-col sm:flex-row items-center gap-4 pb-6 border-b dark:border-gray-700">
                   {file?.type.includes('pdf') 
                        ? <PdfIcon className="w-12 h-12 text-red-600 shrink-0" /> 
                        : file?.type.includes('image')
                        ? <img src={`data:${file.type};base64,${file.base64}`} alt={file.name} className="w-12 h-12 object-cover rounded-md" />
                        : <PowerPointIcon className="w-12 h-12 text-orange-500 shrink-0" />
                   }
                    <div className="text-center sm:text-left flex-1">
                        <h3 className="font-bold text-lg truncate">{file?.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('uploadslides.detectedTopic')}: <span className="font-semibold text-gray-700 dark:text-gray-300">{file?.context}</span></p>
                    </div>
                    {!showTitle && <button onClick={clearFile} className="ml-auto shrink-0 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>}
                </div>
                
                {/* Analysis Tools */}
                <div>
                     <h4 className="font-bold text-xl mb-4">{t('uploadslides.tools.title')}</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         <button disabled={isAnalyzing} onClick={() => handleToolClick('summarize')} className="p-3 text-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('uploadslides.tool.summarize')}</button>
                         <button disabled={isAnalyzing} onClick={() => handleToolClick('explain')} className="p-3 text-center bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-semibold rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('uploadslides.tool.explain')}</button>
                         <button disabled={isAnalyzing} onClick={() => handleToolClick('chat')} className="p-3 text-center bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-semibold rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('uploadslides.tool.chat')}</button>
                         <button disabled={isAnalyzing} onClick={() => handleToolClick('read')} className="p-3 text-center bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 font-semibold rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('uploadslides.tool.read')}</button>
                     </div>
                </div>

                {/* Analysis Result Display */}
                {(isAnalyzing || analysisResultToDisplay || analysisMode === 'chat') && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        {isAnalyzing && analysisMode !== 'chat' && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                                <p className="mt-4 text-sm font-semibold">{loadingMessage || 'Processing...'}</p>
                            </div>
                        )}
                        {!isAnalyzing && analysisResultToDisplay && (
                            <div className="max-w-none">
                                <FormattedContent content={analysisResultToDisplay} />
                            </div>
                        )}
                        { (analysisMode === 'summarize' || analysisMode === 'explain') && analysisResultToDisplay && !isAnalyzing && (
                            <div className="mt-4 text-right">
                                <button onClick={handleSaveToNotes} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">{t('uploadslides.saveToNotes')}</button>
                            </div>
                        )}
                        {analysisMode === 'read' && analysisResultToDisplay && !isAnalyzing && (
                             <div className="mt-4 flex items-center gap-4 p-2 bg-gray-200 dark:bg-gray-800 rounded-full">
                                <button onClick={handleReadAloud} className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700">
                                    {isReading ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                </button>
                                 <button onClick={handleStopReading} className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700">
                                    <StopIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        {analysisMode === 'chat' && (
                             <div className="space-y-4">
                                <div className="max-h-60 overflow-y-auto space-y-4 pr-2">
                                    {chatHistory.map((turn, index) => (
                                        <div key={index}>
                                            <p className="font-bold text-sm text-gray-500 dark:text-gray-400">You:</p>
                                            <div className="group relative pr-4">
                                                <p className="mb-2 whitespace-pre-wrap">{turn.user}</p>
                                                <div className="absolute top-0 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 dark:bg-gray-700 p-1 rounded-md">
                                                    <button
                                                        onClick={() => handleEditMessage(turn.user)}
                                                        title="Edit"
                                                        className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCopyMessage(turn.user)}
                                                        title="Copy"
                                                        className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                                    >
                                                        <CopyIconInline className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="font-bold text-sm text-blue-600 dark:text-blue-400">Blay:</p>
                                            <div>
                                                <FormattedContent content={turn.blay} />
                                                {isAnalyzing && index === chatHistory.length - 1 && <span className="inline-block w-0.5 h-4 bg-slate-700 dark:bg-slate-300 animate-pulse ml-1" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                 <form onSubmit={handleChatSubmit} className="flex gap-2">
                                    <input
                                      ref={chatInputRef}
                                      type="text"
                                      value={chatInput}
                                      onChange={e => setChatInput(e.target.value)}
                                      placeholder={t('uploadslides.chat.placeholder')}
                                      className="flex-1 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 disabled:opacity-50"
                                      disabled={isAnalyzing}
                                    />
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-700 text-white rounded-md disabled:bg-blue-400 disabled:cursor-not-allowed"
                                        disabled={isAnalyzing || !chatInput.trim()}
                                    >
                                        {t('common.submit')}
                                    </button>
                                 </form>
                            </div>
                        )}
                    </div>
                )}


                {/* Study Session */}
                <div className="pt-8 border-t dark:border-gray-700">
                     <h4 className="font-bold text-xl mb-4">{t('uploadslides.studySession.title')}</h4>
                     <button onClick={handleStudyThisNow} disabled={isAnalyzing || !!activeSession} className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400 dark:disabled:bg-green-800 disabled:cursor-not-allowed">
                         {t('uploadslides.studyNow')}
                     </button>
                </div>
            </div>

            {studySlotToStart && (
                <StudyModeSetupModal
                    isOpen={isSetupModalOpen}
                    onClose={() => setIsSetupModalOpen(false)}
                    onStart={confirmStartSession}
                    studySlot={studySlotToStart}
                    breakSlot={breakSlotForStudy}
                />
            )}
            
            <SchedulePromptModal
                isOpen={isSchedulePromptOpen}
                onClose={() => setIsSchedulePromptOpen(false)}
                onCreateSchedule={() => { setView('dashboard'); setIsSchedulePromptOpen(false); }}
                onContinue={() => { setIsSchedulePromptOpen(false); setIsUntrackedSetupModalOpen(true); }}
            />
            <UntrackedStudySetupModal
                isOpen={isUntrackedSetupModalOpen}
                onClose={() => setIsUntrackedSetupModalOpen(false)}
                onStart={handleStartUntrackedSession}
            />
            {conflictInfo && (
                <ConflictResolutionModal
                    isOpen={!!conflictInfo}
                    onClose={() => setConflictInfo(null)}
                    conflict={conflictInfo}
                    onResolve={(resolution) => {
                        if (!conflictInfo) return;
                        const { slot, uploadedSubject, plannedSubject } = conflictInfo;
            
                        switch (resolution) {
                            case 'replace': {
                                // Start session with the uploaded material but using the planned slot's time.
                                const sessionSlot = { ...slot, activity: uploadedSubject };
                                handleStartSetup(sessionSlot);
                                break;
                            }
                            case 'shift': {
                                // Start session now, remind user to reschedule.
                                const sessionSlot = { ...slot, activity: uploadedSubject };
                                handleStartSetup(sessionSlot);
                                addToast(`Started studying ${uploadedSubject}. Don't forget to reschedule '${plannedSubject}'!`, 'info');
                                break;
                            }
                            case 'addExtra': {
                                // Start an untracked 60-minute session for the new material.
                                const now = new Date();
                                const startTime = now;
                                const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 60 min session
                                
                                const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            
                                const virtualStudySlot: PlanSlot = {
                                    activity: uploadedSubject,
                                    startTime: formatTime(startTime),
                                    endTime: formatTime(endTime),
                                    type: ActivityType.STUDY,
                                };
                                startSession(virtualStudySlot, true, null); // start an untracked session
                                break;
                            }
                        }
                        setConflictInfo(null); // Close the modal
                    }}
                />
            )}
        </div>
    );
};

export default UploadSlides;