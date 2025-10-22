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
import { timeToMinutes } from '../lib/utils.ts';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { PencilIcon } from './icons/PencilIcon.tsx';

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

type HubView = 'actions' | 'summarize' | 'explain' | 'chat' | 'read-focus';
type ReadAloudState = 'idle' | 'loading' | 'interactive' | 'playing' | 'paused';


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

const CopyButton: React.FC<{ textToCopy: string; className?: string }> = ({ textToCopy, className }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <button onClick={handleCopy} className={`p-1.5 rounded-md transition-colors ${className}`}>
            {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
        </button>
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
        <div className="prose prose-lg dark:prose-invert max-w-none text-left">
            {blocks.map((block, index) => {
                if (block.startsWith('```') && block.endsWith('```')) {
                    const codeContent = block.slice(3, -3);
                    const lang = codeContent.match(/^[a-zA-Z]+\n/)?.[0].trim() || '';
                    const code = codeContent.replace(/^[a-zA-Z]+\n/, '');
                    return (
                        <div key={index} className="relative bg-black/70 text-gray-100 rounded-xl my-4 border border-gray-700 shadow-lg">
                            <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700 rounded-t-xl">
                                <span className="text-xs font-mono text-gray-400 capitalize">{lang || 'code'}</span>
                                <CopyButton textToCopy={code} className="bg-gray-700/50 text-gray-300 hover:bg-gray-600/70 hover:text-white" />
                            </div>
                            <pre className="p-4 overflow-x-auto"><code className="text-sm font-mono whitespace-pre-wrap">{code}</code></pre>
                        </div>
                    );
                }

                const lines = block.split('\n');
                // FIX: Changed type from JSX.Element[] to React.ReactNode[] to be safer and more idiomatic.
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
    editingMessage: { index: number; text: string } | null;
    setEditingMessage: React.Dispatch<React.SetStateAction<{ index: number; text: string } | null>>;
    handleEditMessage: (index: number) => void;
    handleCancelEdit: () => void;
    handleSaveEdit: (index: number) => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
    chatHistory, chatInput, setChatInput, handleChatSubmit, isProcessing,
    editingMessage, setEditingMessage, handleEditMessage, handleCancelEdit, handleSaveEdit 
}) => {
    const { t } = useLanguage();
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const CopyButtonWithTooltip: React.FC<{ textToCopy: string; className?: string }> = ({ textToCopy, className }) => {
        const [isCopied, setIsCopied] = useState(false);

        const handleCopy = (e: React.MouseEvent) => {
            e.stopPropagation();
            navigator.clipboard.writeText(textToCopy).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            });
        };

        return (
            <div className="relative group/tooltip">
                <button onClick={handleCopy} className={`p-1.5 rounded-md transition-colors ${className}`}>
                    {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 text-xs font-semibold text-white bg-gray-900/80 dark:bg-black/80 rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                    {isCopied ? t('toasts.copied') : t('common.copy')}
                </div>
            </div>
        );
    };
    
    const buttonClass = "p-1.5 bg-gray-100 dark:bg-gray-600/80 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500/80 backdrop-blur-sm shadow";

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {chatHistory.map((turn, i) => {
                    if (editingMessage && editingMessage.index === i) {
                        return (
                            <div key={`${i}-editing`} className="my-2 p-3 bg-blue-50 dark:bg-gray-700/50 rounded-lg">
                                <textarea
                                    value={editingMessage.text}
                                    onChange={(e) => setEditingMessage({ index: i, text: e.target.value })}
                                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500"
                                    rows={Math.max(3, editingMessage.text.split('\n').length)}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={handleCancelEdit} className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 rounded-md">
                                        {t('common.cancel')}
                                    </button>
                                    <button onClick={() => handleSaveEdit(i)} className="px-4 py-1.5 text-sm bg-primary text-primary-text rounded-md">
                                        {t('common.save')}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={i} className="space-y-2 clear-both">
                            {/* User message */}
                            <div className="flex justify-end">
                                <div className="group relative">
                                    <div className="bg-primary text-primary-text p-3 rounded-xl inline-block max-w-[80%]">
                                        {turn.user}
                                    </div>
                                    <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-full flex items-center gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="relative group/tooltip">
                                            <button onClick={() => handleEditMessage(i)} className={buttonClass}>
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 text-xs font-semibold text-white bg-gray-900/80 dark:bg-black/80 rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                                                {t('common.edit')}
                                            </div>
                                        </div>
                                        <CopyButtonWithTooltip textToCopy={turn.user} className={buttonClass} />
                                    </div>
                                </div>
                            </div>
                             {/* Blay's message */}
                            <div className="flex justify-start">
                                 <div className="group relative">
                                    <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-xl inline-block max-w-[80%] text-left">
                                        <FormattedContent content={turn.blay} />
                                    </div>
                                    <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full flex items-center gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CopyButtonWithTooltip textToCopy={turn.blay} className={buttonClass} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChatSubmit} className="p-4 border-t dark:border-gray-700 flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isProcessing} className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" placeholder={t('uploadslides.chat.placeholder')} />
                <button type="submit" disabled={isProcessing || !chatInput.trim()} className="px-4 py-2 bg-primary text-primary-text rounded disabled:opacity-50">{t('uploadslides.chat.send')}</button>
            </form>
        </div>
    );
};


const HighlightedReadAloud: React.FC<{ text: string; highlightIndex: number; charLength: number; }> = ({ text, highlightIndex, charLength }) => {
    const paragraphs = text.split('\n');
    let charCounter = 0;
    const currentWordRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        currentWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightIndex]);

    return (
        <div className="prose prose-2xl dark:prose-invert max-w-4xl mx-auto text-left leading-relaxed py-8">
            {paragraphs.map((paragraph, pIndex) => {
                if (!paragraph.trim()) return <br key={pIndex} />;
                
                const pStart = charCounter;
                const pEnd = pStart + paragraph.length;

                charCounter = pEnd + 1; // Account for the newline character

                // Paragraph has not been spoken yet or reading is idle
                if (highlightIndex === -1 || (highlightIndex + charLength < pStart)) {
                    return <p key={pIndex}>{paragraph}</p>;
                }
                
                // Paragraph has been fully spoken
                if (highlightIndex >= pEnd) {
                    return <p key={pIndex}><span className="bg-primary/20 transition-colors duration-150">{paragraph}</span></p>;
                }

                // Paragraph is being spoken now
                const spokenPartEnd = highlightIndex;
                const currentWordEnd = highlightIndex + charLength;

                const preText = paragraph.substring(0, Math.max(0, spokenPartEnd - pStart));
                const wordText = paragraph.substring(Math.max(0, spokenPartEnd - pStart), Math.max(0, currentWordEnd - pStart));
                const postText = paragraph.substring(Math.max(0, currentWordEnd - pStart));
                
                const isCurrentWordInThisParagraph = highlightIndex >= pStart && highlightIndex < pEnd;

                return (
                    <p key={pIndex}>
                        <span className="bg-primary/20 transition-colors duration-150">{preText}</span>
                        <span ref={isCurrentWordInThisParagraph ? currentWordRef : null} className="bg-primary/40 transition-colors duration-150 rounded px-1">{wordText}</span>
                        <span>{postText}</span>
                    </p>
                );
            })}
        </div>
    );
};

const ClickableReadAloudText: React.FC<{ text: string; onWordClick: (charIndex: number) => void; }> = ({ text, onWordClick }) => {
    const paragraphs = text.split('\n');
    let charCounter = 0;

    return (
        <div className="prose prose-2xl dark:prose-invert max-w-4xl mx-auto text-left leading-relaxed py-8">
            {paragraphs.map((paragraph, pIndex) => {
                const paragraphStartOffset = charCounter;
                charCounter += paragraph.length + 1; // Account for newline

                if (!paragraph.trim()) return <br key={pIndex} />;

                const wordsAndSpaces = paragraph.split(/(\s+)/);
                let localCharCounter = 0;

                return (
                    <p key={pIndex}>
                        {wordsAndSpaces.map((segment, wIndex) => {
                            const isWord = segment.trim().length > 0;
                            const globalSegmentStart = paragraphStartOffset + localCharCounter;
                            localCharCounter += segment.length;

                            return (
                                <span
                                    key={wIndex}
                                    onClick={isWord ? () => onWordClick(globalSegmentStart) : undefined}
                                    className={isWord ? "cursor-pointer hover:bg-primary/20 rounded transition-colors" : ""}
                                >
                                    {segment}
                                </span>
                            );
                        })}
                    </p>
                );
            })}
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
  const [hubView, setHubView] = useState<HubView>('actions');
  const speechStartIndexRef = useRef(0);
  
  const [readAloudState, setReadAloudState] = useState<ReadAloudState>('idle');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [highlightLength, setHighlightLength] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [controlsPosition, setControlsPosition] = useState({ x: 0, y: 0 });

  const [sessionPrompt, setSessionPrompt] = useState<{ slot: PlanSlot, nextSlot: PlanSlot | null, day: DayOfWeek } | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ plannedSubject: string; uploadedSubject: string; day: DayOfWeek; slot: PlanSlot; file: UploadedFile; } | null>(null);
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [customizationRequest, setCustomizationRequest] = useState<{ file: UploadedFile, slot?: PlanSlot, isUntracked: boolean } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ index: number; text: string } | null>(null);
  
  const { file, analysisResults, chatHistory, isProcessing } = learningHubState;

  const setFile = (file: UploadedFile | null) => setLearningHubState(prev => ({ ...prev, file }));
  const setIsProcessing = (processing: boolean) => setLearningHubState(prev => ({...prev, isProcessing: processing}));
  const setAnalysisResult = (type: 'summarize' | 'explain' | 'read', result: string | null) => {
    setLearningHubState(prev => ({
        ...prev,
        analysisResults: { ...prev.analysisResults, [type]: result }
    }));
  };

  useEffect(() => {
    return () => {
        if (intendedStudyContext) {
            setIntendedStudyContext(null);
        }
    };
  }, [intendedStudyContext, setIntendedStudyContext]);

  const handlePlay = useCallback((startIndex = 0) => {
    const textToRead = analysisResults.read;
    if (textToRead) {
        speechSynthesis.cancel();
        speechStartIndexRef.current = startIndex;
        const utterance = new SpeechSynthesisUtterance(textToRead.substring(startIndex));

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                setHighlightIndex(speechStartIndexRef.current + event.charIndex);
                setHighlightLength(event.charLength);
            }
        };
        utterance.onend = () => {
            setReadAloudState('interactive');
            setHighlightIndex(-1);
            setHighlightLength(0);
        };
        utterance.onstart = () => {
             setHighlightIndex(speechStartIndexRef.current);
             setHighlightLength(0);
        };
        
        speechSynthesis.speak(utterance);
        setReadAloudState('playing');
    }
  }, [analysisResults.read]);
  
  const handleResume = useCallback(() => {
      speechSynthesis.resume();
      setReadAloudState('playing');
  }, []);

  const handlePause = useCallback(() => {
      speechSynthesis.pause();
      setReadAloudState('paused');
  }, []);

  const handleStop = useCallback(() => {
      speechSynthesis.cancel();
      setReadAloudState('interactive');
      setHighlightIndex(-1);
      setHighlightLength(0);
  }, []);

  const handleWordClick = (charIndex: number) => {
    handlePlay(charIndex);
  };

  const handleDocDoubleClick = () => {
      addToast("Reading from the beginning of the document.", "info");
      handlePlay(0);
  };


  useEffect(() => {
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
        addToast(t('toasts.fileSizeTooLarge', { fileName: droppedFile.name, size: 25 }), 'error');
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
    }
    
    if (analysisResults[mode as 'summarize' | 'explain' | 'read']) return;

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

    } catch (error: any) {
        addToast(error.message || `Failed to ${mode} document.`, 'error');
        setHubView('actions');
    } finally {
        if (mode === 'read' && hubView === 'read-focus') {
            setReadAloudState('interactive');
        }
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

  const handleEditMessage = (index: number) => {
    setEditingMessage({ index, text: chatHistory[index].user });
  };

  const handleCancelEdit = () => {
      setEditingMessage(null);
  };

  const handleSaveEdit = async (index: number) => {
      if (!editingMessage || !file) return;

      const userMessage = editingMessage.text;
      const historyForApi = chatHistory.slice(0, index);

      const updatedHistory = [...historyForApi, { user: userMessage, blay: t('uploadslides.blayIsTyping') }];
      setLearningHubState(prev => ({ ...prev, chatHistory: updatedHistory }));
      
      setEditingMessage(null);
      setIsProcessing(true);

      try {
          const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
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

  const copyReadAloudText = () => {
    if (analysisResults.read) {
        navigator.clipboard.writeText(analysisResults.read).then(() => addToast(t('toasts.copied'), 'success'));
    }
  };

  const saveReadAloudTextToNotes = () => {
      if (!file || !analysisResults.read || isProcessing) return;
      const newNote: Note = {
        id: Date.now().toString(),
        title: `${t('uploadslides.actions.read')}: ${file.name}`,
        content: analysisResults.read,
        subject: file.context,
        createdAt: new Date().toISOString(),
        isFavourite: false,
      };
      setNotes([newNote, ...notes]);
      addToast(t('toasts.savedToNotes'), 'success');
  };

  const handleReadAloudClick = () => {
    setHubView('read-focus');
    if (analysisResults.read) {
        setReadAloudState('interactive');
    } else {
        setReadAloudState('loading');
        handleAnalysis('read');
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

    if (hubView === 'read-focus') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <div onDoubleClick={handleDocDoubleClick} className="h-full relative group">
                <FileViewer file={file} />
                {readAloudState === 'interactive' && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl">
                        <p className="text-white font-bold text-lg bg-black/50 px-4 py-2 rounded-lg">Double-tap to read from start</p>
                    </div>
                )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden relative">
              <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('uploadslides.actions.read')}</h3>
                  <div className="flex items-center gap-2">
                      <button onClick={copyReadAloudText} disabled={isProcessing || !analysisResults.read} className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-50" title={t('common.copy')}>
                          <CopyIcon className="w-4 h-4"/>
                      </button>
                      <button onClick={saveReadAloudTextToNotes} disabled={isProcessing || !analysisResults.read} className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-50" title={t('common.saveToNotes')}>
                          <SaveIcon className="w-4 h-4"/>
                      </button>
                      <button onClick={() => { handleStop(); setHubView('actions'); }} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline pl-2">
                          <ArrowLeftIcon className="w-4 h-4"/> {t('uploadslides.backToActions')}
                      </button>
                  </div>
              </header>
              <main
                className="flex-1 overflow-y-auto px-6 relative"
                onMouseEnter={(e) => {
                    setControlsPosition({ x: e.clientX, y: e.clientY });
                    setControlsVisible(true);
                }}
                onMouseLeave={() => {
                    setControlsVisible(false);
                }}
              >
                  {readAloudState === 'loading' && <LoadingIndicator message={loadingMessage || t('uploadslides.loading.read')} />}
                  
                  {readAloudState === 'interactive' && (
                    <>
                      <div className="sticky top-0 bg-white dark:bg-gray-800 py-3 z-10 text-center border-b dark:border-gray-700 mb-4">
                        <p className="font-semibold text-primary">Click any word below to start reading from that point.</p>
                      </div>
                      <ClickableReadAloudText text={analysisResults.read || ''} onWordClick={handleWordClick} />
                    </>
                  )}

                  {(readAloudState === 'playing' || readAloudState === 'paused') && (
                      <HighlightedReadAloud 
                          text={analysisResults.read || ''}
                          highlightIndex={highlightIndex}
                          charLength={highlightLength}
                      />
                  )}
              </main>
              {controlsVisible && (
                    <div
                        style={{ 
                            position: 'fixed', 
                            top: `${controlsPosition.y}px`, 
                            left: `${controlsPosition.x}px`,
                            transform: 'translate(-50%, -120%)' // Position above and centered on cursor
                        }}
                        className="z-50 flex items-center gap-3 p-2 bg-gray-900/80 dark:bg-black/80 backdrop-blur-sm rounded-full shadow-2xl transition-opacity"
                        onMouseEnter={() => setControlsVisible(true)}
                        onMouseLeave={() => setControlsVisible(false)}
                    >
                        {readAloudState === 'playing' ? (
                            <button onClick={handlePause} className="p-2 text-white rounded-full hover:bg-white/20" title={t('uploadslides.pauseReading')}>
                                <PauseIcon className="w-6 h-6"/>
                            </button>
                        ) : (
                            <button onClick={() => readAloudState === 'paused' ? handleResume() : handlePlay(0)} className="p-2 text-white rounded-full hover:bg-white/20" title={t('uploadslides.readAloud')}>
                                <PlayIcon className="w-6 h-6"/>
                            </button>
                        )}
                        <button onClick={handleStop} className="p-2 text-white rounded-full hover:bg-white/20" title={t('uploadslides.stopReading')}>
                            <StopIcon className="w-6 h-6"/>
                        </button>
                    </div>
                )}
            </div>
        </div>
      );
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
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <ActionCard titleKey="uploadslides.actions.summarize" descKey="uploadslides.actions.summarize.desc" onClick={() => handleAnalysis('summarize')} />
                <ActionCard titleKey="uploadslides.actions.explain" descKey="uploadslides.actions.explain.desc" onClick={() => handleAnalysis('explain')} />
                <ActionCard titleKey="uploadslides.actions.chat" descKey="uploadslides.actions.chat.desc" onClick={() => setHubView('chat')} />
                <ActionCard titleKey="uploadslides.actions.read" descKey="uploadslides.actions.read.desc" onClick={handleReadAloudClick} />
            </div>

             {hubView === 'actions' ? (
                <div className="flex-1 flex items-center justify-center text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p>{t('uploadslides.selectAction')}</p>
                </div>
             ) : (
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold capitalize">{t('uploadslides.results.title', { mode: hubView })}</h4>
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
                        <ChatView 
                            chatHistory={chatHistory} 
                            chatInput={chatInput} 
                            setChatInput={setChatInput} 
                            handleChatSubmit={handleChatSubmit} 
                            isProcessing={isProcessing}
                            editingMessage={editingMessage}
                            setEditingMessage={setEditingMessage}
                            handleEditMessage={handleEditMessage}
                            handleCancelEdit={handleCancelEdit}
                            handleSaveEdit={handleSaveEdit}
                        />
                    ) : <AnalysisView />}
                </div>
            )}
          </div>
        </div>
    );
  }

  const wrapperClass = isStudyModeView 
    ? "h-full flex flex-col" 
    : "max-w-7xl mx-auto h-full flex flex-col";

  return (
    <div className={wrapperClass}>
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
      {!isStudyModeView && !activeSession && file && hubView === 'actions' && (
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