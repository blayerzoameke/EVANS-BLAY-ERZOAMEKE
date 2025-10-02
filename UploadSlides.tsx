import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import katex from 'katex';
import type { SmartPlan, ActiveSession, Toast, LearningHubState, UploadedFile, ImagePart, Note, PlanSlot, ConflictInfo } from '../types.ts';
import { ActivityType, DayOfWeek } from '../types.ts';
import type { View } from '../App.tsx';
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
        // FIX: Corrected invalid JSX syntax for the code tag.
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
        <div className="prose dark:prose-invert max-w-none text-left">
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
                // FIX: Changed type from JSX.Element[] to React.ReactNode[] to resolve "Cannot find namespace 'JSX'" error.
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


const UploadSlides: React.FC<UploadSlidesProps> = ({
  smartPlan, setSmartPlan, activeSession, setActiveSession, setView, addToast,
  learningHubState, setLearningHubState, notes, setNotes,
  showTitle = true, isStudyModeView = false,
  intendedStudyContext, setIntendedStudyContext,
}) => {
  const { t } = useLanguage();
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isReading, setIsReading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [sessionPrompt, setSessionPrompt] = useState<{ slot: PlanSlot, nextSlot: PlanSlot | null, day: DayOfWeek } | null>(null);

  const [conflict, setConflict] = useState<{slot: PlanSlot, day: DayOfWeek, file: UploadedFile} | null>(null);
  const [showConflictResolution, setShowConflictResolution] = useState(false);

  const { file, analysisMode, analysisResults, chatHistory, isProcessing } = learningHubState;

  const setFile = (file: UploadedFile | null) => setLearningHubState(prev => ({ ...prev, file }));
  const setAnalysisMode = (mode: LearningHubState['analysisMode']) => setLearningHubState(prev => ({ ...prev, analysisMode: mode }));
  const setAnalysisResult = (type: 'summarize' | 'explain' | 'read', result: string | null) => {
      setLearningHubState(prev => ({
          ...prev,
          analysisResults: { ...prev.analysisResults, [type]: result }
      }));
  };
   
  const setIsProcessing = (processing: boolean) => setLearningHubState(prev => ({...prev, isProcessing: processing}));

  useEffect(() => {
    if (analysisMode === 'chat') {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, analysisMode]);

  useEffect(() => {
    // Cleanup context on unmount
    return () => {
        if (intendedStudyContext) {
            setIntendedStudyContext(null);
        }
    };
  }, [intendedStudyContext, setIntendedStudyContext]);

  const stopReading = useCallback(() => {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    setIsReading(false);
  }, []);

  // Cleanup speech synthesis on unmount or file change
  useEffect(() => {
    return () => stopReading();
  }, [file, stopReading]);

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

  const processAndStartSession = useCallback(async (fileToProcess: File, slot: PlanSlot) => {
    setIsProcessing(true);
    setLoadingMessage(t('uploadslides.verifying'));
    try {
        const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileToProcess);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const newFile: UploadedFile = {
            name: fileToProcess.name,
            type: fileToProcess.type,
            size: fileToProcess.size,
            base64: base64String,
            context: slot.activity, // Use scheduled activity as context
        };
        
        setFile(newFile);
        startSession(slot, newFile.context);

    } catch (error: any) {
        addToast(error.message || 'Failed to process file.', 'error');
    } finally {
        setIsProcessing(false);
    }
  }, [addToast, t, setActiveSession]);
  
  const processUntrackedFile = useCallback(async (fileToProcess: File) => {
      setIsProcessing(true);
      setLoadingMessage(t('uploadslides.verifying'));
      try {
           const base64String = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(fileToProcess);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });
            const filePart: ImagePart = { inlineData: { data: base64String, mimeType: fileToProcess.type } };

            if (!await isStudyMaterial(filePart)) {
                addToast(t('examprep.error.notStudyMaterial', { fileName: fileToProcess.name }), 'error');
                return;
            }
            setLoadingMessage(t('uploadslides.extractingContext'));
            const context = await getDocumentContext(filePart);
            const newFile: UploadedFile = { name: fileToProcess.name, type: fileToProcess.type, size: fileToProcess.size, base64: base64String, context };
            setFile(newFile);
            addToast(t('uploadslides.fileReady'), 'success');
      } catch (e: any) {
          addToast(e.message || 'Failed to process file.', 'error');
      } finally {
        setIsProcessing(false);
      }
  }, [addToast, t]);

  const processAndHandleConflict = useCallback(async (fileToProcess: File, scheduledSlot: PlanSlot, scheduledDay: DayOfWeek) => {
    setIsProcessing(true);
    setLoadingMessage(t('uploadslides.extractingContext'));
     try {
           const base64String = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(fileToProcess);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });
            const filePart: ImagePart = { inlineData: { data: base64String, mimeType: fileToProcess.type } };
            const context = await getDocumentContext(filePart);
            const newFile: UploadedFile = { name: fileToProcess.name, type: fileToProcess.type, size: fileToProcess.size, base64: base64String, context };
            
            setConflict({ slot: scheduledSlot, day: scheduledDay, file: newFile });
            setShowConflictResolution(true);
      } catch (e: any) {
          addToast(e.message || 'Failed to process file for conflict resolution.', 'error');
      } finally {
          setIsProcessing(false);
      }
  }, [addToast, t]);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0];
    if (!droppedFile) return;

    if (droppedFile.size > 25 * 1024 * 1024) { // 25MB limit
        addToast(t('toasts.fileSizeError25'), 'error');
        return;
    }
    
    // If coming from dashboard click, bypass time checks
    if (intendedStudyContext) {
        processAndStartSession(droppedFile, intendedStudyContext.fromSlot);
        setIntendedStudyContext(null); // Consume the context
        return;
    }

    const { slot, nextSlot, day } = findCurrentSlots(smartPlan);

    if (slot && (slot.type === 'study' || slot.type === 'lecture') && day) {
        setStagedFile(droppedFile);
        setSessionPrompt({ slot, nextSlot, day });
    } else { // Free period or no plan
        processUntrackedFile(droppedFile);
    }
  }, [addToast, t, smartPlan, intendedStudyContext, setIntendedStudyContext, processAndStartSession, processUntrackedFile]);
  
  const startSession = (slot: PlanSlot, subject?: string) => {
      const now = Date.now();
      const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
       const newSession: ActiveSession = {
          startTime: now,
          endTime: now + duration * 60 * 1000,
          subject: subject || slot.activity,
          type: ActivityType.STUDY,
          isUntracked: true, // All sessions via Hub start this way
          durationMinutes: duration,
          fromSlot: { ...slot, activity: subject || slot.activity },
          nextSlot: null, // Simplified for this flow
      };
      setActiveSession(newSession);
  };
  
  const handlePromptConfirm = () => { // User says "Yes, it is the correct course"
      if (stagedFile && sessionPrompt) {
          processAndStartSession(stagedFile, sessionPrompt.slot);
      }
      setSessionPrompt(null);
      setStagedFile(null);
  };
  
  const handlePromptReject = () => { // User says "No, it's different"
      if (stagedFile && sessionPrompt) {
          processAndHandleConflict(stagedFile, sessionPrompt.slot, sessionPrompt.day);
      }
      setSessionPrompt(null);
      setStagedFile(null);
  };
  
  const handleConflictResolution = (resolution: 'replace' | 'shift' | 'addExtra') => {
    if (!conflict || !smartPlan) return;

    const { slot: currentSlot, day: currentDay, file: newFile } = conflict;
    let newPlan = JSON.parse(JSON.stringify(smartPlan));
    
    const dayPlanIndex = newPlan.findIndex((d: any) => d.day === currentDay);
    if (dayPlanIndex === -1) return;
    const slotIndex = newPlan[dayPlanIndex].slots.findIndex((s: any) => s.startTime === currentSlot.startTime && s.activity === currentSlot.activity);
    if (slotIndex === -1) return;

    const slotToStart: PlanSlot = { ...currentSlot, activity: newFile.context };

    if (resolution === 'replace') {
        newPlan[dayPlanIndex].slots[slotIndex] = slotToStart;
    } 
    else if (resolution === 'shift') {
        let shifted = false;
        for(let i = slotIndex + 1; i < newPlan[dayPlanIndex].slots.length; i++){
            if(newPlan[dayPlanIndex].slots[i].type === 'free'){
                 newPlan[dayPlanIndex].slots[i] = slotToStart;
                 shifted = true;
                 break;
            }
        }
        if(!shifted){
             newPlan[dayPlanIndex].slots.push(slotToStart);
        }
    } else if (resolution === 'addExtra') {
        newPlan[dayPlanIndex].slots.splice(slotIndex + 1, 0, slotToStart);
    }

    setSmartPlan(newPlan);
    setFile(newFile);
    startSession(slotToStart);

    setShowConflictResolution(false);
    setConflict(null);
  };


  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, disabled: isProcessing });

  const handleAnalysis = async (mode: 'summarize' | 'explain' | 'read') => {
    if (!file || isProcessing) return;
    setAnalysisMode(mode);
    if (analysisResults[mode]) return; // Don't re-fetch

    setIsProcessing(true);
    setLoadingMessage(t(`uploadslides.loading.${mode}` as any));
    try {
        const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
        let result = '';
        if (mode === 'summarize') result = await summarizeDocument(filePart, file.context);
        else if (mode === 'explain') result = await explainDocument(filePart, file.context);
        else if (mode === 'read') result = await extractTextFromDocument(filePart);
        setAnalysisResult(mode, result);
    } catch (error: any) {
        addToast(error.message || `Failed to ${mode} document.`, 'error');
        setAnalysisMode('none');
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleChatSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !file || isProcessing) return;

      const userMessage = chatInput;
      setLearningHubState(prev => ({...prev, chatHistory: [...prev.chatHistory, { user: userMessage, blay: t('uploadslides.blayIsTyping') }]}));
      setChatInput('');
      setIsProcessing(true);

      try {
          const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
          // FIX: Pass smartPlan to chatWithDocumentStream to provide schedule context to the AI.
          const stream = await chatWithDocumentStream(filePart, userMessage, chatHistory, file.context, smartPlan);
          
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
          addToast("Sorry, I couldn't get a response. Please try again.", 'error');
          setLearningHubState(prev => {
              const newHistory = [...prev.chatHistory];
              if (newHistory.length > 0) {
                  newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], blay: "Sorry, an error occurred. Please try again." };
              }
              return { ...prev, chatHistory: newHistory };
          });
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleStartSession = (config: { subject: string; duration: number; selectedNoteId?: string }) => {
      const now = Date.now();
      const newSession: ActiveSession = {
          startTime: now,
          endTime: now + config.duration * 60 * 1000,
          subject: config.subject,
          type: ActivityType.STUDY,
          isUntracked: true,
          durationMinutes: config.duration,
          fromSlot: { activity: config.subject, startTime: '', endTime: '', type: ActivityType.STUDY },
          nextSlot: null,
      };

      if (config.selectedNoteId) {
          const note = notes.find(n => n.id === config.selectedNoteId);
          if (note) {
            setFile({
                name: note.title,
                type: 'text/plain',
                size: note.content.length,
                base64: btoa(unescape(encodeURIComponent(note.content))), // text to base64
                context: note.subject,
            });
          }
      }
      
      setActiveSession(newSession);
      setIsSetupModalOpen(false);
      setView('uploadslides');
  };
  
  const clearFile = () => {
    stopReading();
    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
  };
  
  const saveToNotes = () => {
      const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read'];
      if (!file || !content || isProcessing) return;
      const newNote: Note = {
        id: Date.now().toString(),
        title: `${analysisMode.charAt(0).toUpperCase() + analysisMode.slice(1)}: ${file.name}`,
        content,
        subject: file.context,
        createdAt: new Date().toISOString(),
        isFavourite: false,
      };
      setNotes([newNote, ...notes]);
      addToast(t('toasts.savedToNotes'), 'success');
  }

  const copyContent = () => {
      const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read'];
      if (content) {
          navigator.clipboard.writeText(content).then(() => addToast('Copied to clipboard!', 'success'));
      }
  };
  
  const toggleReadAloud = () => {
    if (isReading) {
        stopReading();
    } else {
        const textToRead = analysisResults.read;
        if (textToRead) {
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.onend = () => setIsReading(false);
            utteranceRef.current = utterance;
            speechSynthesis.speak(utterance);
            setIsReading(true);
        }
    }
  };

  const AnalysisView: React.FC = () => {
    const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read'];
    
    if (isProcessing) return <LoadingIndicator message={loadingMessage} />;
    
    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 flex-1 overflow-y-auto">
            <FormattedContent content={content || "No content available."} />
        </div>
    );
  };

  const ChatView: React.FC = () => (
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
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isProcessing} className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" placeholder="Ask a question..." />
              <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-primary text-primary-text rounded disabled:opacity-50">Send</button>
          </form>
      </div>
  );

  const ActionCard: React.FC<{ title: string; desc: string; onClick: () => void }> = ({ title, desc, onClick }) => (
    <button onClick={onClick} disabled={isProcessing} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 text-left w-full hover:border-primary dark:hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        <h4 className="font-bold text-lg text-gray-800 dark:text-white">{title}</h4>
        <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </button>
  );

  const renderFileContent = () => {
    if (isStudyModeView) {
        return <FileViewer file={file} />;
    }
    
    if (analysisMode === 'read-focus') {
        return (
             <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{file?.name}</h3>
                        <p className="text-sm text-gray-500">{file?.context}</p>
                    </div>
                    <button onClick={() => setAnalysisMode('none')} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md">Back to Actions</button>
                </div>
                <div className="flex-1 overflow-y-auto pr-4 -mr-4">
                    {isProcessing ? <LoadingIndicator message={loadingMessage} /> : (
                        <FormattedContent content={analysisResults.read || "Loading content..."} />
                    )}
                </div>
            </div>
        )
    }

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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <ActionCard title="Summarize" desc="Get the key points." onClick={() => handleAnalysis('summarize')} />
            <ActionCard title="Explain Material" desc="Break down complex topics." onClick={() => handleAnalysis('explain')} />
            <ActionCard title="Chat with Document" desc="Ask questions about the content." onClick={() => setAnalysisMode('chat')} />
            <ActionCard title="Read Material" desc="View the extracted text." onClick={() => { handleAnalysis('read'); setAnalysisMode('read-focus'); }} />
          </div>

          <div className="flex-1 overflow-hidden">
            {/* FIX: Removed redundant `analysisMode !== 'read-focus'` check that caused a TypeScript error. */}
            {analysisMode !== 'none' && (
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold capitalize">{analysisMode} Results</h4>
                        {analysisMode !== 'chat' && (
                            <div className="flex items-center gap-2">
                                {analysisMode === 'read' && (
                                    <button onClick={toggleReadAloud} disabled={isProcessing || !analysisResults.read} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                                        {isReading ? <><StopIcon className="w-4 h-4" /> Stop</> : <><PlayIcon className="w-4 h-4" /> Read Aloud</>}
                                    </button>
                                )}
                                <button onClick={copyContent} disabled={isProcessing || !analysisResults[analysisMode]} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                                    <CopyIcon className="w-4 h-4" /> Copy
                                </button>
                                <button onClick={saveToNotes} disabled={isProcessing || !analysisResults[analysisMode]} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                                    <SaveIcon className="w-4 h-4" /> Save to Notes
                                </button>
                            </div>
                        )}
                    </div>
                    {analysisMode === 'chat' ? <ChatView /> : <AnalysisView />}
                </div>
            )}
            {analysisMode === 'none' && (
                <div className="flex-1 flex items-center justify-center text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p>Select an action above to get started.</p>
                </div>
            )}
          </div>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {showTitle && (
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
                    <p className="text-gray-500">PDF, PPTX, DOCX, JPG, PNG (Max 25MB)</p>
                </div>
            </div>
        )}
      </div>
      {!isStudyModeView && !activeSession && (
        <div className="mt-6 text-center">
            <button onClick={() => setIsSetupModalOpen(true)} className="px-8 py-3 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 transition-all">
                {t('uploadslides.startStudySession')}
            </button>
        </div>
      )}
      <AdvancedStudySetupModal 
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onStart={handleStartSession}
        fileContext={file?.context}
        notes={notes}
      />
      {sessionPrompt && (
          <SchedulePromptModal
            isOpen={!!sessionPrompt}
            onClose={() => setSessionPrompt(null)}
            onConfirm={handlePromptConfirm}
            onReject={handlePromptReject}
            sessionInfo={sessionPrompt}
          />
      )}
      {showConflictResolution && conflict && (
          <ConflictResolutionModal
            isOpen={showConflictResolution}
            onClose={() => { setShowConflictResolution(false); setConflict(null); }}
            conflict={{ plannedSubject: conflict.slot.activity, uploadedSubject: conflict.file.context }}
            onResolve={handleConflictResolution}
          />
      )}
    </div>
  );
};

export default UploadSlides;