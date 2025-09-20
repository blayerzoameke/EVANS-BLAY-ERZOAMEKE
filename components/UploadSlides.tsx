

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    isStudyMaterial,
    getDocumentContext,
    summarizeDocument,
    explainDocument,
    extractTextFromDocument,
    chatWithDocumentStream,
} from '../services/geminiService';
import { ActivityType } from '../types.ts';
import type { 
    UploadedFile, 
    Toast,
    AnalysisMode,
    LearningHubState,
    ChatTurn,
    SmartPlan,
    ActiveSession,
    Note,
    PlanSlot
} from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';
import { PdfIcon } from './icons/PdfIcon.tsx';
import { PowerPointIcon } from './icons/PowerPointIcon.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import SchedulePromptModal from './SchedulePromptModal.tsx';
import UntrackedStudySetupModal from './UntrackedStudySetupModal.tsx';
import ConflictResolutionModal from './ConflictResolutionModal.tsx';
import AdvancedStudySetupModal from './AdvancedStudySetupModal.tsx';
import type { View } from '../App.tsx';

interface UploadSlidesProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
    learningHubState: LearningHubState;
    setLearningHubState: (state: LearningHubState) => void;
    smartPlan: SmartPlan | null;
    activeSession: ActiveSession | null;
    setActiveSession: (session: ActiveSession | null) => void;
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    showTitle?: boolean;
    isStudyModeView?: boolean;
}

const UploadSlides: React.FC<UploadSlidesProps> = ({ 
    addToast, 
    setView, 
    learningHubState, 
    setLearningHubState,
    smartPlan,
    activeSession,
    setActiveSession,
    notes,
    setNotes,
    showTitle = true,
    isStudyModeView = false,
}) => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    
    const [schedulePromptOpen, setSchedulePromptOpen] = useState(false);
    const [untrackedSetupOpen, setUntrackedSetupOpen] = useState(false);
    const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);

    const { file, analysisMode, analysisResults, chatHistory } = learningHubState;
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const updateState = (newState: Partial<LearningHubState>) => {
        setLearningHubState({ ...learningHubState, ...newState });
    };

    const resetState = () => {
        updateState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] });
    };

    const processFile = useCallback(async (acceptedFile: File) => {
        setIsLoading(true);
        setError(null);
        setLoadingMessage(t('uploadslides.verifying'));
        
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
                
                updateState({
                    file: {
                        name: acceptedFile.name,
                        type: acceptedFile.type,
                        size: acceptedFile.size,
                        base64,
                        context
                    },
                    analysisMode: 'none'
                });
            } catch (e: any) {
                setError(e.message || t('uploadslides.error.generic'));
            } finally {
                setIsLoading(false);
            }
        };
    }, [t, updateState]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            processFile(acceptedFiles[0]);
        }
    }, [processFile]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.jpeg', '.jpg', 'png'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
        },
        multiple: false,
        disabled: isLoading,
    });
    
    const handleAnalysis = async (mode: AnalysisMode) => {
        if (!file) return;

        updateState({ analysisMode: mode });
        
        if (mode === 'chat' || mode === 'none') return;
        
        const resultKey = mode as 'summarize' | 'explain' | 'read';
        if (analysisResults[resultKey]) return; // Already have result
        
        setIsLoading(true);
        setLoadingMessage(t('uploadslides.generating'));
        try {
            const filePart = { inlineData: { data: file.base64, mimeType: file.type } };
            let result = '';
            if (mode === 'summarize') result = await summarizeDocument(filePart, file.context);
            else if (mode === 'explain') result = await explainDocument(filePart, file.context);
            else if (mode === 'read') result = await extractTextFromDocument(filePart);
            
            updateState({
                analysisResults: { ...analysisResults, [resultKey]: result }
            });

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !file || isStreaming) return;
        
        const question = chatInput;
        setChatInput('');
        setIsStreaming(true);

        const newHistory: ChatTurn[] = [...chatHistory, { user: question, blay: '' }];
        updateState({ chatHistory: newHistory });

        try {
            const filePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const stream = await chatWithDocumentStream(filePart, question, chatHistory, file.context);
            
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                newHistory[newHistory.length - 1].blay += chunkText;
                updateState({ chatHistory: [...newHistory] });
            }

        } catch (e: any) {
            addToast(e.message || 'Error in chat stream', 'error');
            newHistory[newHistory.length - 1].blay += `\n\n**Error:** ${e.message}`;
            updateState({ chatHistory: [...newHistory] });
        } finally {
            setIsStreaming(false);
        }
    };

    const handleStartFocusedStudy = (studyFile: UploadedFile) => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
        
        const todaysPlan = smartPlan?.find(d => d.day === today);
        const currentSlot = todaysPlan?.slots.find(slot => {
            const startTimeMinutes = timeToMinutes(slot.startTime);
            const endTimeMinutes = timeToMinutes(slot.endTime);
            return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
        });

        if (currentSlot && currentSlot.type === 'study') {
            if(currentSlot.activity.toLowerCase() === studyFile.context.toLowerCase()){
                // Perfect match! Start session
                startSessionFromSlot(currentSlot);
            } else {
                // Conflict
                // TODO: Open conflict resolution modal
                addToast("Conflict: you planned to study something else.", "warning");
            }
        } else {
            // No scheduled study slot right now
            setSchedulePromptOpen(true);
        }
        setAdvancedSetupOpen(false);
    }
    
    const startSessionFromSlot = (slot: PlanSlot) => {
        const now = Date.now();
        const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const endTime = now + (duration * 60 * 1000);
        
        setActiveSession({
            startTime: now,
            endTime: endTime,
            subject: slot.activity,
            type: 'study',
            fromSlot: slot,
            nextSlot: null, // This would need to be figured out from smartPlan
        });
    }

    const startUntrackedSession = (config: { studyDuration: number; breakDuration: number; breakActivity: string; breakLink: string }) => {
        const now = Date.now();
        const studyEndTime = now + (config.studyDuration * 60 * 1000);
        
        let breakSlot: PlanSlot | null = null;
        if (config.breakDuration > 0) {
            breakSlot = {
                activity: config.breakActivity || 'Break',
                startTime: '', // Not relevant for untracked
                endTime: '',
// FIX: Changed string literal 'break' to the enum member `ActivityType.BREAK` to fix type error.
                type: ActivityType.BREAK,
                link: config.breakLink,
            }
        }

        setActiveSession({
            startTime: now,
            endTime: studyEndTime,
            subject: file?.context || 'Untracked Study',
            type: 'study',
// FIX: Changed string literal 'study' to the enum member `ActivityType.STUDY` to fix type error.
            fromSlot: { activity: file?.context || 'Untracked Study', type: ActivityType.STUDY, startTime: '', endTime: '' },
            nextSlot: breakSlot,
            isUntracked: true,
        });
        setUntrackedSetupOpen(false);
    }

    const timeToMinutes = (time: string): number => {
      try {
        const [timePart, meridiem] = time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (meridiem && meridiem.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (meridiem && meridiem.toLowerCase() === 'am' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      } catch {
        return 0;
      }
    };


    if (!file) {
        return (
            <div className="max-w-4xl mx-auto">
                {showTitle && <>
                    <h2 className="text-3xl font-bold text-center">{t('uploadslides.title')}</h2>
                    <p className="text-gray-500 mt-1 mb-8 text-center">{t('uploadslides.subtitle')}</p>
                </>}
                <div {...getRootProps()} className={`group p-12 border-2 border-dashed rounded-lg transition-colors ${isDragActive ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-300 dark:border-gray-600'} ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-teal-400'}`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 transition-colors group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        <UploadIcon className="w-16 h-16 mb-4 transition-transform group-hover:scale-110" />
                        <p className="font-semibold text-lg">{isLoading ? loadingMessage : t('uploadslides.dropPrompt')}</p>
                        <p className="text-sm">{t('uploadslides.supportedFormats')}</p>
                    </div>
                </div>
                {error && <p className="mt-4 text-center text-red-500">{error}</p>}
            </div>
        );
    }

    const MainContent = () => {
        if (isLoading) {
            return <div className="text-center p-8">{loadingMessage}</div>
        }
        if (analysisMode === 'none') {
            return (
                <div className="p-6">
                    <h3 className="text-xl font-bold mb-4">{t('uploadslides.whatToDo')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Analysis options */}
                        <button onClick={() => handleAnalysis('summarize')} className="text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700">
                            <h4 className="font-bold">{t('uploadslides.summarize')}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('uploadslides.summarize.desc')}</p>
                        </button>
                        <button onClick={() => handleAnalysis('explain')} className="text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700">
                             <h4 className="font-bold">{t('uploadslides.explain')}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('uploadslides.explain.desc')}</p>
                        </button>
                        <button onClick={() => handleAnalysis('chat')} className="text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700">
                             <h4 className="font-bold">{t('uploadslides.chat')}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('uploadslides.chat.desc')}</p>
                        </button>
                         <button onClick={() => handleAnalysis('read')} className="text-left p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700">
                             <h4 className="font-bold">{t('uploadslides.read')}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('uploadslides.read.desc')}</p>
                        </button>
                    </div>
                </div>
            )
        }
        if (analysisMode === 'chat') {
            return (
                <div className="flex flex-col h-full">
                    <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                        {chatHistory.map((turn, index) => (
                            <div key={index}>
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg ml-auto max-w-xl"><p className="font-semibold">You</p>{turn.user}</div>
                                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg mt-2 max-w-xl"><p className="font-semibold">Blay</p><pre className="whitespace-pre-wrap font-sans">{turn.blay}</pre></div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleChatSubmit} className="p-4 border-t dark:border-gray-700">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={t('uploadslides.chat.placeholder')}
                            className="w-full p-2 border rounded-md dark:bg-gray-700"
                            disabled={isStreaming}
                        />
                    </form>
                </div>
            )
        }
        return (
            <div className="p-4 overflow-y-auto">
                 <pre className="whitespace-pre-wrap font-sans">{analysisResults[analysisMode as 'summarize' | 'explain' | 'read']}</pre>
            </div>
        );
    }

    return (
      <div className={`max-w-7xl mx-auto ${isStudyModeView ? '' : 'mt-8'}`}>
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-lg border dark:border-gray-700 flex flex-col md:flex-row min-h-[70vh]">
            {/* Sidebar */}
            <aside className="w-full md:w-1/3 border-b md:border-b-0 md:border-r dark:border-gray-700 p-4 space-y-4">
                <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                    {file.type.includes('pdf') ? <PdfIcon className="w-8 h-8 text-red-600 shrink-0"/> : <PowerPointIcon className="w-8 h-8 text-orange-500 shrink-0"/>}
                    <p className="text-sm font-semibold truncate">{file.name}</p>
                </div>
                <div className="text-xs space-y-1">
                   <p><strong>{t('uploadslides.fileSize')}:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                   <p><strong>{t('uploadslides.fileContext')}:</strong> {file.context}</p>
                </div>
                {!isStudyModeView && (
                    <button onClick={() => setAdvancedSetupOpen(true)} className="w-full py-2 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700">
                        Start Focused Study
                    </button>
                )}
                <nav className="space-y-1">
                    <button onClick={() => handleAnalysis('none')} className={`w-full text-left p-2 rounded ${analysisMode === 'none' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Home</button>
                    <button onClick={() => handleAnalysis('summarize')} className={`w-full text-left p-2 rounded ${analysisMode === 'summarize' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.summarize')}</button>
                    <button onClick={() => handleAnalysis('explain')} className={`w-full text-left p-2 rounded ${analysisMode === 'explain' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.explain')}</button>
                    <button onClick={() => handleAnalysis('chat')} className={`w-full text-left p-2 rounded ${analysisMode === 'chat' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.chat')}</button>
                    <button onClick={() => handleAnalysis('read')} className={`w-full text-left p-2 rounded ${analysisMode === 'read' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.read')}</button>
                </nav>
                 {!isStudyModeView && (
                    <button onClick={resetState} className="w-full mt-4 text-sm text-red-500 hover:underline">{t('uploadslides.changeFile')}</button>
                 )}
            </aside>
            {/* Main content */}
            <main className="w-full md:w-2/3 flex flex-col">
                <MainContent />
            </main>
        </div>
        {!isStudyModeView && <>
            <SchedulePromptModal 
                isOpen={schedulePromptOpen} 
                onClose={() => setSchedulePromptOpen(false)}
                onCreateSchedule={() => { setSchedulePromptOpen(false); setView('dashboard'); }}
                onContinue={() => { setSchedulePromptOpen(false); setUntrackedSetupOpen(true); }}
            />
            <UntrackedStudySetupModal
                isOpen={untrackedSetupOpen}
                onClose={() => setUntrackedSetupOpen(false)}
                onStart={startUntrackedSession}
            />
            <AdvancedStudySetupModal
                isOpen={advancedSetupOpen}
                onClose={() => setAdvancedSetupOpen(false)}
                onStart={handleStartFocusedStudy}
                learningHubFile={file}
                notes={notes}
            />
        </>}
      </div>
    );
};

export default UploadSlides;