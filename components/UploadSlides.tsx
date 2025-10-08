import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import katex from 'katex';
import type { SmartPlan, ActiveSession, Toast, LearningHubState, UploadedFile, ImagePart, Note, PlanSlot, ConflictInfo, ChatTurn, View } from '../types.ts';
import { ActivityType, DayOfWeek } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { getDocumentContext, isStudyMaterial, summarizeDocument, explainDocument, extractTextFromDocument, chatWithDocumentStream } from '../services/geminiService.ts';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import AdvancedStudySetupModal from './AdvancedStudySetupModal.tsx';
import SchedulePromptModal from './SchedulePromptModal.tsx';
import ConflictResolutionModal from './ConflictResolutionModal.tsx';
import FileViewer from './FileViewer.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { StopIcon } from './icons/StopIcon.tsx';
import { DAYS_OF_WEEK } from '../constants.ts';
import SessionCustomizationModal from './SessionCustomizationModal.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';

interface UploadSlidesProps {
  smartPlan: SmartPlan | null;
  setSmartPlan: (plan: SmartPlan) => void,
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;
  setView: (view: View) => void;
  addToast: (message: string, type: Toast['type']) => void;
  learningHubState: LearningHubState;
  setLearningHubState: React.Dispatch<React.SetStateAction<LearningHubState>>;
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  showTitle?: boolean;
  isStudyModeView?: boolean;
  intendedStudyContext: { subject: string; fromSlot: PlanSlot } | null;
  setIntendedStudyContext: (context: { subject: string; fromSlot: PlanSlot } | null) => void;
}

type AudioState = 'idle' | 'playing' | 'paused';
type HubView = 'actions' | 'summarize' | 'explain' | 'chat' | 'read-aloud';

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    try {
        const timeLower = time.toLowerCase().replace(/\s/g, '');
        const isPM = timeLower.includes('pm');
        const isAM = timeLower.includes('am');

        const timeOnly = timeLower.replace('am', '').replace('pm', '');
        
        let [hourStr, minuteStr] = timeOnly.split(':');
        
        if (!minuteStr) minuteStr = '0';

        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr, 10);

        if (isNaN(hours) || isNaN(minutes)) {
            console.warn(`Could not parse time: ${time}`);
            return 0;
        }
        
        if (isPM && hours !== 12) {
            hours += 12;
        }
        if (isAM && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    } catch (e) {
        console.error("Failed to parse time string:", time, e);
        return 0;
    }
};

const minutesToTime = (totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-8 h-full">
        <div className="animate-spin w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full"></div>
        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{message}</p>
    </div>
);

const LoadingOverlay: React.FC<{ isLoading: boolean; message: string }> = ({ isLoading, message }) => {
    if (!isLoading) return null;
    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex flex-col items-center justify-center z-10 rounded-2xl backdrop-blur-sm">
            <div className="animate-spin w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"></div>
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{message}</p>
        </div>
    );
};

const KatexRenderer: React.FC<{ content: string; displayMode: boolean }> = React.memo(({ content, displayMode }) => {
    try {
        const html = katex.renderToString(content, { throwOnError: false, displayMode });
        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
        // FIX: Corrected invalid JSX syntax.
        return <code>{content}</code>;
    }
});

const FormattedContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    const renderInlineElements = (line: string) => {
        const inlineRegex = /(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\*\*.*?\*\*)|(`.*?`)/g;
        const parts = line.split(inlineRegex).filter(Boolean);
        return parts.map((part, index) => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
                return <KatexRenderer key={index} content={part.slice(2, -2)} displayMode={true} />;
            }
            if (part.startsWith('$') && part.endsWith('$')) {
                return <KatexRenderer key={index} content={part.slice(1, -1)} displayMode={false} />;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={index} className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
            }
            return part;
        });
    };

    const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

    return (
        <div className="prose prose-lg dark:prose-invert max-w-none text-left">
            {blocks.map((block, index) => {
                if (block.startsWith('```') && block.endsWith('```')) {
                    const codeContent = block.slice(3, -3);
                    const lang = codeContent.match(/^[a-zA-Z]+\n/)?.[0].trim() || '';
                    const code = codeContent.replace(/^[a-zA-Z]+\n/, '');
                    return (
                        <div key={index} className="bg-gray-100 dark:bg-gray-900 rounded-md my-4">
                             {lang && <div className="text-xs text-gray-500 px-4 pt-2 capitalize">{lang}</div>}
                             <pre><code className="block whitespace-pre-wrap p-4 text-sm">{code}</code></pre>
                        </div>
                    );
                }

                const lines = block.split('\n');
                // FIX: Changed type to be more flexible and idiomatic for React children.
                const elements: React.ReactNode[] = [];
                let listItems: string[] = [];
                let inList = false;

                const flushList = () => {
                    if (listItems.length > 0) {
                        elements.push(
                            <ul key={`ul-${elements.length}`} className="list-disc pl-6 my-2 space-y-1">
                                {listItems.map((item, i) => (
                                    <li key={i}>{renderInlineElements(item)}</li>
                                ))}
                            </ul>
                        );
                        listItems = [];
                    }
                    inList = false;
                };

                lines.forEach((line) => {
                    if (line.match(/^###\s/)) {
                        flushList();
                        elements.push(<h4 key={elements.length} className="font-bold text-lg mt-4 mb-2">{renderInlineElements(line.replace(/^###\s/, ''))}</h4>);
                    } else if (line.match(/^##\s/)) {
                        flushList();
                        elements.push(<h3 key={elements.length} className="font-bold text-xl mt-5 mb-2">{renderInlineElements(line.replace(/^##\s/, ''))}</h3>);
                    } else if (line.match(/^#\s/)) {
                        flushList();
                        elements.push(<h2 key={elements.length} className="font-bold text-2xl mt-6 mb-3">{renderInlineElements(line.replace(/^#\s/, ''))}</h2>);
                    } else if (line.match(/^\s*---\s*$/)) {
                        flushList();
                        elements.push(<hr key={elements.length} className="my-4" />);
                    } else if (line.match(/^\s*(\*|-)\s/)) {
                        listItems.push(line.replace(/^\s*(\*|-)\s/, ''));
                        inList = true;
                    } else if (line.trim() !== '') {
                        flushList();
                        elements.push(<p key={elements.length} className="my-2">{renderInlineElements(line)}</p>);
                    } else { // Empty line
                        flushList();
                    }
                });

                flushList();
                return <React.Fragment key={index}>{elements}</React.Fragment>;
            })}
        </div>
    );
});

interface ChatViewProps {
    chatHistory: ChatTurn[];
    chatInput: string;
    setChatInput: (value: string) => void;
    handleChatSubmit: (e: React.FormEvent) => void;
    isProcessing: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({ chatHistory, chatInput, setChatInput, handleChatSubmit, isProcessing }) => {
    const { t } = useLanguage();
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {chatHistory.map((turn, i) => (
                    <div key={i} className="space-y-2 clear-both">
                        <div className="flex justify-end"><div className="bg-primary text-primary-text p-3 rounded-xl inline-block max-w-[80%]">{turn.user}</div></div>
                        <div className="flex justify-start"><div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-xl inline-block max-w-[80%] text-left"><FormattedContent content={turn.blay} /></div></div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChatSubmit} className="p-4 border-t dark:border-gray-700 flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isProcessing} className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" placeholder={t('uploadslides.chat.placeholder')} />
                <button type="submit" disabled={isProcessing || !chatInput.trim()} className="px-4 py-2 bg-primary text-primary-text rounded disabled:opacity-50">{t('uploadslides.chat.send')}</button>
            </form>
        </div>
    );
};


const UploadSlides: React.FC<UploadSlidesProps> = ({
  smartPlan, setSmartPlan, activeSession, setActiveSession, setView, addToast,
  learningHubState, setLearningHubState, notes, setNotes,
  showTitle = true, isStudyModeView = false,
  intendedStudyContext, setIntendedStudyContext,
}) => {
  const { t } = useLanguage();
  const [loadingMessage, setLoadingMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [hubView, setHubView] = useState<HubView>('actions');

  // --- Resizable Panel State ---
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Workflow State ---
  const [sessionPrompt, setSessionPrompt] = useState<{ slot: PlanSlot, nextSlot: PlanSlot | null, day: DayOfWeek } | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ plannedSubject: string; uploadedSubject: string; day: DayOfWeek; slot: PlanSlot; file: UploadedFile; } | null>(null);
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [customizationRequest, setCustomizationRequest] = useState<{ file: UploadedFile, slot?: PlanSlot, isUntracked: boolean } | null>(null);


  const { file, analysisResults, chatHistory, isProcessing } = learningHubState;

  const setFile = (file: UploadedFile | null) => setLearningHubState(prev => ({ ...prev, file }));
  const setAnalysisResult = (type: 'summarize' | 'explain' | 'read', result: string | null) => {
      setLearningHubState(prev => ({
          ...prev,
          analysisResults: { ...prev.analysisResults, [type]: result }
      }));
  };
   
  const setIsProcessing = (processing: boolean) => setLearningHubState(prev => ({...prev, isProcessing: processing}));

  const handleMouseDown = (e: React.MouseEvent) => {
      isResizingRef.current = true;
      e.preventDefault();
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) {
          return;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      let newWidthPercent = (mouseX / containerRect.width) * 100;
  
      if (newWidthPercent < 20) newWidthPercent = 20;
      if (newWidthPercent > 80) newWidthPercent = 80;
      
      setLeftPanelWidth(newWidthPercent);
  }, []);

  useEffect(() => {
      const handleGlobalMouseUp = () => {
          isResizingRef.current = false;
      };
  
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
  
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
        if (intendedStudyContext) {
            setIntendedStudyContext(null);
        }
    };
  }, [intendedStudyContext, setIntendedStudyContext]);

    const handleStop = useCallback(() => {
        if (speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused) {
            speechSynthesis.cancel();
        }
        setAudioState('idle');
    }, []);

    const handlePlay = useCallback(() => {
        if (audioState === 'paused') {
            speechSynthesis.resume();
            setAudioState('playing');
        } else if (audioState === 'idle') {
            const textToRead = analysisResults.read;
            if (textToRead) {
                speechSynthesis.cancel(); // Ensure any previous utterance is stopped
                const utterance = new SpeechSynthesisUtterance(textToRead);
                utterance.onend = () => {
                    setAudioState('idle');
                    utteranceRef.current = null;
                };
                utteranceRef.current = utterance;
                speechSynthesis.speak(utterance);
                setAudioState('playing');
            }
        }
    }, [audioState, analysisResults.read]);

    const handlePause = useCallback(() => {
        if (audioState === 'playing') {
            speechSynthesis.pause();
            setAudioState('paused');
        }
    }, [audioState]);

  useEffect(() => {
    // Cleanup on unmount or file change
    return () => handleStop();
  }, [file, handleStop]);

  const findCurrentSlots = (plan: SmartPlan | null): { slot: PlanSlot | null, nextSlot: PlanSlot | null, day: DayOfWeek | null } => {
    if (!plan) return { slot: null, nextSlot: null, day: null };
    const now = new Date();
    const dayIndex = now.getDay();
    const currentDay = DAYS_OF_WEEK[dayIndex === 0 ? 6 : dayIndex - 1];
    const dayPlan = plan.find(d => d.day === currentDay);
    if (!dayPlan) return { slot: null, nextSlot: null, day: currentDay };
    
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSlotIndex = dayPlan.slots.findIndex(slot => 
        timeToMinutes(slot.startTime) <= nowMinutes && 
        timeToMinutes(slot.endTime) > nowMinutes
    );
    
    if (currentSlotIndex === -1) {
        return { slot: null, nextSlot: null, day: currentDay };
    }

    const slot = dayPlan.slots[currentSlotIndex];
    const nextSlot = currentSlotIndex + 1 < dayPlan.slots.length ? dayPlan.slots[currentSlotIndex + 1] : null;

    return { slot, nextSlot, day: currentDay };
  };

  const processFile = useCallback(async (fileToProcess: File, context?: string): Promise<UploadedFile | null> => {
     try {
        const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileToProcess);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const filePart: ImagePart = { inlineData: { data: base64String, mimeType: fileToProcess.type } };

        setLoadingMessage(t('uploadslides.verifying'));
        const isMaterial = await isStudyMaterial(filePart);

        if (!isMaterial) {
            addToast(t('examprep.error.notStudyMaterial', { fileName: fileToProcess.name }), 'error');
            return null;
        }

        let fileContext = context;
        if (!fileContext) {
            setLoadingMessage(t('uploadslides.extractingContext'));
            fileContext = await getDocumentContext(filePart);
        }

        return {
            name: fileToProcess.name,
            type: fileToProcess.type,
            size: fileToProcess.size,
            base64: base64String,
            context: fileContext,
        };
     } catch(e: any) {
        addToast(e.message || t('toasts.fileProcessingError'), 'error');
        return null;
     }
  }, [addToast, t]);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0];
    if (!droppedFile) return;

    if (droppedFile.size > 25 * 1024 * 1024) {
        addToast(t('toasts.fileSizeError25'), 'error');
        return;
    }
    
    setIsProcessing(true);
    const context = intendedStudyContext ? intendedStudyContext.fromSlot.activity : undefined;
    const processedFile = await processFile(droppedFile, context);
    if (processedFile) {
        setLearningHubState(prev => ({ ...prev, file: processedFile, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] }));
        setHubView('actions');
    }
    setIsProcessing(false);
  }, [addToast, t, intendedStudyContext, processFile, setLearningHubState]);

  const handleStartStudyRequest = () => {
    if (!file) return;

    if (intendedStudyContext) {
        setCustomizationRequest({ file, slot: intendedStudyContext.fromSlot, isUntracked: false });
        setIntendedStudyContext(null);
        return;
    }

    const { slot, nextSlot, day } = findCurrentSlots(smartPlan);

    if (smartPlan && slot && (slot.type === 'study' || slot.type === 'lecture') && day) {
        setSessionPrompt({ slot, nextSlot, day });
    } else {
        setCustomizationRequest({ file, isUntracked: true });
    }
  };
  
  const handlePromptConfirm = async () => {
      if (file && sessionPrompt) {
          setCustomizationRequest({ file, slot: sessionPrompt.slot, isUntracked: false });
      }
      setSessionPrompt(null);
  };
  
  const handlePromptReject = async () => {
      if (file && sessionPrompt) {
          setConflictInfo({
              plannedSubject: sessionPrompt.slot.activity,
              uploadedSubject: file.context,
              day: sessionPrompt.day,
              slot: sessionPrompt.slot,
              file: file,
          });
          setShowConflictResolution(true);
      }
      setSessionPrompt(null);
  };
  
  const handleConflictResolution = (resolution: 'replace' | 'shift' | 'addExtra') => {
    if (!conflictInfo || !smartPlan) return;
    
    setShowConflictResolution(false);
    
    const { slot: currentSlot, day: currentDay, file: newFile, uploadedSubject } = conflictInfo;
    
    let newPlan = JSON.parse(JSON.stringify(smartPlan));
    const dayPlanIndex = newPlan.findIndex((d: any) => d.day === currentDay);
    if (dayPlanIndex === -1) return;
    
    const slotDuration = timeToMinutes(currentSlot.endTime) - timeToMinutes(currentSlot.startTime);
    let slotToCustomize = { ...currentSlot, activity: uploadedSubject, type: ActivityType.STUDY };

    if (resolution === 'replace') {
        const slotIndex = newPlan[dayPlanIndex].slots.findIndex((s: any) => s.startTime === currentSlot.startTime && s.activity === currentSlot.activity);
        if(slotIndex !== -1) newPlan[dayPlanIndex].slots[slotIndex] = slotToCustomize;
    } 
    else if (resolution === 'shift') {
        let shifted = false;
        for(let dayIdx = dayPlanIndex; dayIdx < newPlan.length; dayIdx++) {
            const slots = newPlan[dayIdx].slots;
            for(let slotIdx = 0; slotIdx < slots.length; slotIdx++){
                const slot = slots[slotIdx];
                if(slot.type === ActivityType.FREE){
                    const freeDuration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
                    if (freeDuration >= slotDuration) {
                        const newStartTime = timeToMinutes(slot.startTime);
                        const newEndTime = newStartTime + slotDuration;
                        slotToCustomize = { ...slotToCustomize, startTime: minutesToTime(newStartTime), endTime: minutesToTime(newEndTime) };
                        const remainingFreeSlot: PlanSlot = { ...slot, startTime: minutesToTime(newEndTime) };
                        slots.splice(slotIdx, 1, slotToCustomize);
                        if (timeToMinutes(remainingFreeSlot.endTime) > newEndTime) {
                            slots.splice(slotIdx + 1, 0, remainingFreeSlot);
                        }
                        shifted = true;
                        break;
                    }
                }
            }
            if(shifted) break;
        }
        if(!shifted){
             addToast(t('toasts.noFreeSlot'), "warning");
             const lastSlot = newPlan[dayPlanIndex].slots[newPlan[dayPlanIndex].slots.length - 1];
             const newStartTime = timeToMinutes(lastSlot.endTime);
             slotToCustomize = {...slotToCustomize, startTime: minutesToTime(newStartTime), endTime: minutesToTime(newStartTime + slotDuration)};
             newPlan[dayPlanIndex].slots.push(slotToCustomize);
        }
    } else if (resolution === 'addExtra') {
       const slotIndex = newPlan[dayPlanIndex].slots.findIndex((s: any) => s.startTime === currentSlot.startTime && s.activity === currentSlot.activity);
        if(slotIndex !== -1) {
            newPlan[dayPlanIndex].slots.splice(slotIndex + 1, 0, slotToCustomize);
        } else {
            newPlan[dayPlanIndex].slots.push(slotToCustomize);
        }
    }

    setSmartPlan(newPlan);
    setConflictInfo(null);
    setCustomizationRequest({ file: newFile, slot: slotToCustomize, isUntracked: false });
  };

  const startSessionWithCustomDuration = (slot: PlanSlot, uploadedFile: UploadedFile, durationMinutes: number, breakConfig: { breakActivity: string; breakLink: string; breakDuration: number; breakPlacement: 'during' | 'after'; }, isUntracked: boolean) => {
    setFile(uploadedFile);
    
    const now = Date.now();
    const studyDurationMs = durationMinutes * 60 * 1000;
    const breakDurationMs = breakConfig.breakDuration * 60 * 1000;

    let sessionEndTime = now + studyDurationMs;
    let breakStartTime: number | undefined = undefined;

    if (breakConfig.breakPlacement === 'during' && breakDurationMs > 0) {
        sessionEndTime += breakDurationMs;
        breakStartTime = now + (studyDurationMs / 2);
    }

     const newSession: ActiveSession = {
        startTime: now,
        endTime: sessionEndTime,
        subject: slot.activity,
        type: ActivityType.STUDY,
        isUntracked,
        durationMinutes: durationMinutes,
        fromSlot: slot,
        nextSlot: breakConfig.breakDuration > 0 ? {
            activity: breakConfig.breakActivity,
            startTime: 'N/A', 
            endTime: 'N/A',
            type: ActivityType.BREAK,
            link: breakConfig.breakLink,
            durationMinutes: breakConfig.breakDuration
        } : null,
        breakPlacement: breakConfig.breakPlacement,
        breakStartsAt: breakStartTime,
    };
    setActiveSession(newSession);
  };

  const handleCustomizationConfirm = (config: { studyDuration: number; breakDuration: number; breakActivity: string; breakLink: string; breakPlacement: 'during' | 'after'; }) => {
      if (!customizationRequest) return;
      const { file, slot: initialSlot, isUntracked } = customizationRequest;
      setCustomizationRequest(null);

      const finalSlot: PlanSlot = initialSlot 
        ? { ...initialSlot, endTime: minutesToTime(timeToMinutes(initialSlot.startTime) + config.studyDuration) }
        : {
          activity: file.context,
          startTime: 'Now',
          endTime: 'Custom',
          type: ActivityType.STUDY,
      };
      
      startSessionWithCustomDuration(finalSlot, file, config.studyDuration, config, isUntracked);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, disabled: isProcessing });

  const handleAnalysis = async (mode: 'summarize' | 'explain' | 'read' | 'chat') => {
    if (!file || isProcessing) return;

    if (mode === 'summarize' || mode === 'explain' || mode === 'chat') {
        setHubView(mode);
    } else if (mode === 'read') {
        setHubView('read-aloud');
    }
    
    if (analysisResults[mode as 'summarize' | 'explain' | 'read']) {
        if (mode === 'read') {
            handlePlay();
        }
        return;
    }

    if (mode === 'chat') return;

    setIsProcessing(true);
    setLoadingMessage(t(`uploadslides.loading.${mode}` as any));
    try {
        const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
        let result = '';
        if (mode === 'summarize') {
            result = await summarizeDocument(filePart, file.context);
        } else if (mode === 'explain') {
            result = await explainDocument(filePart, file.context);
        } else if (mode === 'read') {
            result = await extractTextFromDocument(filePart);
        }
        
        setAnalysisResult(mode, result);

        if (mode === 'read') {
            handlePlay();
        }
    } catch (error: any) {
        addToast(error.message || `Failed to ${mode} document.`, 'error');
        setHubView('actions');
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !file || isProcessing) return;

    const userMessage = chatInput;
    const historyForApi: ChatTurn[] = [...chatHistory];
    
    setLearningHubState(prev => ({
        ...prev, 
        chatHistory: [...prev.chatHistory, { user: userMessage, blay: t('uploadslides.blayIsTyping') }]
    }));
    setChatInput('');
    setIsProcessing(true);

    try {
        const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
        // FIX: Added missing 'smartPlan' prop to function call.
        const stream = await chatWithDocumentStream(filePart, userMessage, historyForApi, file.context, smartPlan);
        
        let fullResponse = '';
        for await (const chunk of stream) {
            fullResponse += chunk.text;
            setLearningHubState(prev => {
                const newHistory = [...prev.chatHistory];
                if (newHistory.length > 0) {
                    newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], blay: fullResponse };
                }
                return { ...prev, chatHistory: newHistory };
            });
        }
    } catch (error) {
        addToast(t('toasts.chatError'), 'error');
        setLearningHubState(prev => {
            const newHistory = [...prev.chatHistory];
            if (newHistory.length > 0) {
                 newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], blay: t('toasts.chatError') };
            }
            return { ...prev, chatHistory: newHistory };
        });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const clearFile = () => {
    handleStop();
    setHubView('actions');
    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
  };
  
  const saveToNotes = () => {
      const content = analysisResults[hubView as 'summarize' | 'explain'];
      if (!file || !content || isProcessing) return;
      const newNote: Note = {
        id: Date.now().toString(),
        title: `${hubView.charAt(0).toUpperCase() + hubView.slice(1)}: ${file.name}`,
        content,
        subject: file.context,
        createdAt: new Date().toISOString(),
        isFavourite: false,
      };
      setNotes([newNote, ...notes]);
      addToast(t('toasts.savedToNotes'), 'success');
  }

  const copyContent = () => {
      const content = analysisResults[hubView as 'summarize' | 'explain'];
      if (content) {
          navigator.clipboard.writeText(content).then(() => addToast(t('toasts.copied'), 'success'));
      }
  };

  const AnalysisView: React.FC = () => {
    const content = analysisResults[hubView as 'summarize' | 'explain'];
    if (isProcessing && !content) return <LoadingIndicator message={loadingMessage} />;
    
    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 h-full overflow-y-auto">
            <FormattedContent content={content || ''} />
        </div>
    );
  };

  const ActionCard: React.FC<{ titleKey: string; descKey: string; onClick: () => void }> = ({ titleKey, descKey, onClick }) => (
    <button onClick={onClick} disabled={isProcessing} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 text-left w-full h-full hover:border-primary dark:hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-center">
        <h4 className="font-bold text-lg text-gray-800 dark:text-white">{t(titleKey as any)}</h4>
        <p className="text-sm text-gray-500 mt-1">{t(descKey as any)}</p>
    </button>
  );

  const renderFileContent = () => {
    if (!file) return null;
    if (isStudyModeView) return <FileViewer file={file} />;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 h-full flex flex-col">
          <div className="flex justify-between items-start mb-6">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{file?.name}</h3>
                  <p className="text-sm text-gray-500">{file?.context}</p>
              </div>
              {!isStudyModeView && (
                <button onClick={clearFile} disabled={isProcessing} className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"><CloseIcon className="w-5 h-5"/></button>
              )}
          </div>
          
          {hubView === 'actions' || hubView === 'read-aloud' ? (
              <div ref={containerRef} className="flex-1 flex items-stretch gap-2 overflow-hidden">
                    <div style={{ width: `${leftPanelWidth}%` }} className="flex-shrink-0 h-full">
                        <FileViewer file={file} />
                    </div>
                    <div onMouseDown={handleMouseDown} className="w-2 flex-shrink-0 cursor-col-resize bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-primary transition-colors duration-200" />
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                       {hubView === 'actions' ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
                                <ActionCard titleKey="uploadslides.actions.summarize" descKey="uploadslides.actions.summarize.desc" onClick={() => handleAnalysis('summarize')} />
                                <ActionCard titleKey="uploadslides.actions.explain" descKey="uploadslides.actions.explain.desc" onClick={() => handleAnalysis('explain')} />
                                <ActionCard titleKey="uploadslides.actions.chat" descKey="uploadslides.actions.chat.desc" onClick={() => handleAnalysis('chat')} />
                                <ActionCard titleKey="uploadslides.actions.read" descKey="uploadslides.actions.read.desc" onClick={() => handleAnalysis('read')} />
                            </div>
                       ) : ( // hubView === 'read-aloud'
                            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 h-full flex flex-col justify-center items-center">
                                <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-4">{t('uploadslides.actions.read')}</h4>
                                <div className="flex items-center gap-4">
                                     <button onClick={handlePlay} disabled={audioState === 'playing' || isProcessing || !analysisResults.read} className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 disabled:opacity-50"><PlayIcon className="w-6 h-6"/></button>
                                     <button onClick={handlePause} disabled={audioState !== 'playing'} className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 disabled:opacity-50"><PauseIcon className="w-6 h-6"/></button>
                                     <button onClick={handleStop} disabled={audioState === 'idle'} className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 disabled:opacity-50"><StopIcon className="w-6 h-6"/></button>
                                </div>
                                 <button onClick={() => setHubView('actions')} className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                                    <ArrowLeftIcon className="w-4 h-4"/> {t('uploadslides.backToActions')}
                                </button>
                            </div>
                       )}
                    </div>
              </div>
          ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xl font-bold capitalize">{t('uploadslides.results.title', { mode: hubView })}</h4>
                        <div className="flex items-center gap-2">
                             <button onClick={() => setHubView('actions')} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                                <ArrowLeftIcon className="w-4 h-4"/> {t('uploadslides.backToActions')}
                            </button>
                             {hubView !== 'chat' && (
                                <>
                                    <button onClick={copyContent} disabled={isProcessing || !analysisResults[hubView as 'summarize' | 'explain']} className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-50"><CopyIcon className="w-4 h-4"/></button>
                                    <button onClick={saveToNotes} disabled={isProcessing || !analysisResults[hubView as 'summarize' | 'explain']} className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-50"><SaveIcon className="w-4 h-4"/></button>
                                </>
                            )}
                        </div>
                    </div>
                     {hubView === 'chat' ? (
                        <ChatView chatHistory={chatHistory} chatInput={chatInput} setChatInput={setChatInput} handleChatSubmit={handleChatSubmit} isProcessing={isProcessing} />
                    ) : <AnalysisView />}
                </div>
          )}
        </div>
    );
  }

  // FIX: Added return statement for the main component.
  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      {showTitle && !isStudyModeView && (
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('uploadslides.title')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('uploadslides.subtitle')}</p>
        </div>
      )}
      <div className="flex-1">
        {file ? renderFileContent() : (
            <div className="relative h-full">
                <LoadingOverlay isLoading={isProcessing} message={loadingMessage} />
                <div {...getRootProps()} className={`h-full flex flex-col items-center justify-center p-8 border-4 border-dashed rounded-2xl transition-colors ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} ${isProcessing ? 'opacity-50' : 'hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'} cursor-pointer`}>
                    <input {...getInputProps()} />
                     {intendedStudyContext ? (
                        <>
                            <UploadIcon className="w-16 h-16 mb-4 text-gray-400" />
                            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Upload materials for {intendedStudyContext.subject}</p>
                        </>
                    ) : (
                        <>
                            <UploadIcon className="w-16 h-16 mb-4 text-gray-400" />
                            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">{t('uploadslides.dropzone')}</p>
                        </>
                    )}
                    <p className="text-gray-500">{t('uploadslides.fileFormatHint')}</p>
                </div>
            </div>
        )}
      </div>
      {!isStudyModeView && !activeSession && file && (
        <div className="mt-6 text-center">
            <button onClick={handleStartStudyRequest} className="px-8 py-3 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all">
                {t('uploadslides.startStudySession')}
            </button>
        </div>
      )}

      {sessionPrompt && (
          <SchedulePromptModal
            isOpen={!!sessionPrompt}
            onClose={() => setSessionPrompt(null)}
            onConfirm={handlePromptConfirm}
            onReject={handlePromptReject}
            sessionInfo={sessionPrompt}
          />
      )}
      {showConflictResolution && conflictInfo && (
          <ConflictResolutionModal
            isOpen={showConflictResolution}
            onClose={() => { setShowConflictResolution(false); setConflictInfo(null); }}
            conflict={{ plannedSubject: conflictInfo.plannedSubject, uploadedSubject: conflictInfo.uploadedSubject }}
            onResolve={handleConflictResolution}
          />
      )}
       {customizationRequest && (
        <SessionCustomizationModal
            isOpen={!!customizationRequest}
            onClose={() => setCustomizationRequest(null)}
            onConfirm={handleCustomizationConfirm}
            defaultDuration={customizationRequest.slot ? timeToMinutes(customizationRequest.slot.endTime) - timeToMinutes(customizationRequest.slot.startTime) : 50}
        />
       )}
    </div>
  );
};

export default UploadSlides;