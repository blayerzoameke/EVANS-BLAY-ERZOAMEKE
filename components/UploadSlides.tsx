import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import katex from 'katex';
import type { SmartPlan, ActiveSession, Toast, LearningHubState, UploadedFile, ImagePart, Note, PlanSlot, ConflictInfo, ChatTurn, View, AnalysisMode } from '../types';
import { ActivityType, DayOfWeek } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getDocumentContext, isStudyMaterial, summarizeDocument, explainDocument, extractTextFromDocument, chatWithDocumentStream } from '../services/geminiService';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';
import AdvancedStudySetupModal from './AdvancedStudySetupModal';
import SchedulePromptModal from './SchedulePromptModal';
import ConflictResolutionModal from './ConflictResolutionModal';
import FileViewer from './FileViewer';
import { SaveIcon } from './icons/SaveIcon';
import { CopyIcon } from './icons/CopyIcon';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { StopIcon } from './icons/StopIcon';
import { DAYS_OF_WEEK } from '../constants';
import SessionCustomizationModal from './SessionCustomizationModal';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { timeToMinutes, processAndResizeImage } from '../lib/utils';
import { CheckIcon } from './icons/CheckIcon';
import { PencilIcon } from './icons/PencilIcon';
import { VolumeIcon } from './icons/VolumeIcon';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { RefreshIcon } from './icons/RefreshIcon';

interface UploadSlidesProps {
  smartPlan: SmartPlan | null;
  setSmartPlan: (plan: SmartPlan | null) => void,
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
        return <code>{content}</code>;
    }
});

const RichTextViewer: React.FC<{ content: string; highlightCharIndex?: number }> = React.memo(({ content, highlightCharIndex }) => {
    let charCounter = 0;

    const renderTextWithHighlight = (text: string) => {
        const textStart = charCounter;
        charCounter += text.length;
        
        if (highlightCharIndex === undefined || highlightCharIndex < textStart || highlightCharIndex >= charCounter) {
            return <>{text}</>;
        }
        
        const segments = text.split(/(\s+)/);
        let innerOffset = textStart;
        return segments.map((segment, index) => {
            const segmentStart = innerOffset;
            innerOffset += segment.length;
            const isHighlighted = highlightCharIndex >= segmentStart && highlightCharIndex < innerOffset && segment.trim().length > 0;
            return <span key={index} className={isHighlighted ? 'bg-primary/20 dark:bg-primary/30 rounded transition-colors duration-150' : ''}>{segment}</span>;
        });
    }

    const renderInlineElements = (line: string) => {
        const inlineRegex = /(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\*\*.*?\*\*)|(`.*?`)/g;
        const parts = line.split(inlineRegex).filter(Boolean);
        return parts.map((part, index) => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
                charCounter += part.length;
                return <KatexRenderer key={index} content={part.slice(2, -2)} displayMode={true} />;
            }
            if (part.startsWith('$') && part.endsWith('$')) {
                charCounter += part.length;
                return <KatexRenderer key={index} content={part.slice(1, -1)} displayMode={false} />;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                charCounter += 2; // for the opening **
                const innerContent = part.slice(2,-2);
                const rendered = renderTextWithHighlight(innerContent);
                charCounter += 2; // for the closing **
                return <strong key={index}>{rendered}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                charCounter += part.length;
                return <code key={index} className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
            }
            return renderTextWithHighlight(part);
        });
    };

    const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

    return (
        <div className="prose prose-lg dark:prose-invert max-w-none text-left">
            {blocks.map((block, index) => {
                if (block.startsWith('```') && block.endsWith('```')) {
                    charCounter += block.length;
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
                const elements: React.ReactNode[] = [];
                let listItems: string[] = [];
                let paragraphLines: string[] = [];
                let inList = false;

                const flushParagraph = () => {
                    if (paragraphLines.length > 0) {
                        const paragraphContent = (
                            <>
                                {paragraphLines.map((pLine, pIndex) => (
                                    <React.Fragment key={pIndex}>
                                        {renderInlineElements(pLine)}
                                        {pIndex < paragraphLines.length - 1 ? ' ' : ''}
                                    </React.Fragment>
                                ))}
                            </>
                        );
                        elements.push(<p key={`p-${elements.length}`} className="my-2">{paragraphContent}</p>);
                        charCounter += paragraphLines.length - 1; // Account for the newlines we replaced with spaces
                        paragraphLines = [];
                    }
                };
                
                const flushList = () => {
                    flushParagraph(); // A list interrupts a paragraph
                    if (listItems.length > 0) {
                        elements.push(
                            <ul key={`ul-${elements.length}`} className="list-disc pl-6 my-2 space-y-1">
                                {listItems.map((item, i) => {
                                    const renderedItem = <li key={i}>{renderInlineElements(item)}</li>;
                                    charCounter++; // for newline after list item
                                    return renderedItem;
                                })}
                            </ul>
                        );
                        listItems = [];
                    }
                    inList = false;
                };

                lines.forEach((line) => {
                    if (line.match(/^###\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h4 key={elements.length} className="font-bold text-lg mt-4 mb-2">{renderInlineElements(line.replace(/^###\s/, ''))}</h4>);
                        charCounter++;
                    } else if (line.match(/^##\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h3 key={elements.length} className="font-bold text-xl mt-5 mb-2">{renderInlineElements(line.replace(/^##\s/, ''))}</h3>);
                        charCounter++;
                    } else if (line.match(/^#\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h2 key={elements.length} className="font-bold text-2xl mt-6 mb-3">{renderInlineElements(line.replace(/^#\s/, ''))}</h2>);
                        charCounter++;
                    } else if (line.match(/^\s*---\s*$/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<hr key={elements.length} className="my-4" />);
                        charCounter++;
                    } else if (line.match(/^\s*(\*|-)\s/)) {
                        flushParagraph();
                        listItems.push(line.replace(/^\s*(\*|-)\s/, ''));
                        inList = true;
                        // charCounter for newline is handled when flushing the list
                    } else if (line.trim() !== '') {
                        if (inList) flushList();
                        paragraphLines.push(line);
                        // charCounter for newline is handled when flushing the paragraph
                    } else { // Empty line
                        flushParagraph();
                        flushList();
                        charCounter++;
                    }
                });

                flushParagraph();
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
                                    <div className="bg-white dark:bg-gray-700 p-3 rounded-xl inline-block max-w-[80%] text-left">
                                        <RichTextViewer content={turn.blay} />
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
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isProcessing} className="flex-1 px-4 py-3 bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50" placeholder={t('uploadslides.chat.placeholder')} />
                <button type="submit" disabled={isProcessing || !chatInput.trim()} className="px-4 py-2 bg-primary text-primary-text rounded-lg disabled:opacity-50">{t('uploadslides.chat.send')}</button>
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
  
  const [readAloudState, setReadAloudState] = useState<ReadAloudState>('idle');
  const [controlsPosition, setControlsPosition] = useState({ x: 0, y: 0 });
  const [readingSpeed, setReadingSpeed] = useState(1);
  const [readingVolume, setReadingVolume] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [isHoveringTopBar, setIsHoveringTopBar] = useState(false);
  const [isHoveringPlaybackControls, setIsHoveringPlaybackControls] = useState(false);
  const [highlightCharIndex, setHighlightCharIndex] = useState(-1);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechCharIndexRef = useRef(0);

  const [sessionPrompt, setSessionPrompt] = useState<{ slot: PlanSlot, nextSlot: PlanSlot | null, day: DayOfWeek } | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ plannedSubject: string; uploadedSubject: string; day: DayOfWeek; slot: PlanSlot; file: UploadedFile; } | null>(null);
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [customizationRequest, setCustomizationRequest] = useState<{ file: UploadedFile, slot?: PlanSlot, isUntracked: boolean } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ index: number; text: string } | null>(null);
  
  const { file, analysisMode, analysisResults, chatHistory, isProcessing } = learningHubState;

  const setFile = (file: UploadedFile | null) => setLearningHubState(prev => ({ ...prev, file }));
  const setIsProcessing = (processing: boolean) => setLearningHubState(prev => ({...prev, isProcessing: processing}));
  const setAnalysisMode = (mode: AnalysisMode) => setLearningHubState(prev => ({ ...prev, analysisMode: mode }));
  const setAnalysisResult = (type: 'summarize' | 'explain' | 'read', result: string | null) => {
    setLearningHubState(prev => ({
        ...prev,
        analysisResults: { ...prev.analysisResults, [type]: result }
    }));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHoveringPlaybackControls) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setControlsPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    });
  };
  
  const handlePlay = useCallback((startIndex = 0) => {
    const textToRead = analysisResults.read;
    if (textToRead && textToRead.length > startIndex) {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(textToRead.substring(startIndex));
        utteranceRef.current = utterance;

        utterance.rate = readingSpeed;
        utterance.volume = readingVolume;

        utterance.onboundary = (event) => {
            const absoluteCharIndex = startIndex + event.charIndex;
            setHighlightCharIndex(absoluteCharIndex);
            speechCharIndexRef.current = absoluteCharIndex;
        };

        utterance.onend = () => {
            if (utteranceRef.current === utterance) {
                setReadAloudState('interactive');
                speechCharIndexRef.current = 0;
                setHighlightCharIndex(-1);
            }
        };

        speechSynthesis.speak(utterance);
        setReadAloudState('playing');
    }
}, [analysisResults.read, readingSpeed, readingVolume]);


  const handleResume = useCallback(() => {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        setReadAloudState('playing');
      }
  }, []);

  const handlePause = useCallback(() => {
      if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        setReadAloudState('paused');
      }
  }, []);

  const handleStop = useCallback(() => {
      if (speechSynthesis.speaking || speechSynthesis.paused) {
        utteranceRef.current = null;
        speechSynthesis.cancel();
      }
      setReadAloudState('interactive');
      speechCharIndexRef.current = 0;
      setHighlightCharIndex(-1);
  }, []);
  
  useEffect(() => {
    if (readAloudState === 'playing') {
        handlePlay(speechCharIndexRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingSpeed, readingVolume]);

  useEffect(() => {
    return () => handleStop();
  }, [file, handleStop]);

  useEffect(() => {
    return () => {
        if (intendedStudyContext) {
            setIntendedStudyContext(null);
        }
    };
  }, [intendedStudyContext, setIntendedStudyContext]);

  const findCurrentSlots = (plan: SmartPlan | null): { slot: PlanSlot | null, nextSlot: PlanSlot | null, day: DayOfWeek | null } => {
    if (!plan) return { slot: null, nextSlot: null, day: null };
    const now = new Date();
    const currentDay = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1];
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
        let base64String: string;
        let mimeType = fileToProcess.type;
        let finalSize = fileToProcess.size;

        if (fileToProcess.type.startsWith('image/')) {
            const resized = await processAndResizeImage(fileToProcess);
            base64String = resized.base64;
            mimeType = resized.mimeType;
            finalSize = atob(base64String).length; // Approximate size
        } else {
            base64String = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(fileToProcess);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });
        }

        const filePart: ImagePart = { inlineData: { data: base64String, mimeType: mimeType } };

        setLoadingMessage(t('uploadslides.verifying'));
        const isMaterial = await isStudyMaterial(filePart, { fast: true });

        if (!isMaterial) {
            addToast(t('examprep.error.notStudyMaterial', { fileName: fileToProcess.name }), 'error');
            return null;
        }

        let fileContext = context;
        if (!fileContext) {
            setLoadingMessage(t('uploadslides.extractingContext'));
            fileContext = await getDocumentContext(filePart, { fast: true });
        }

        return {
            name: fileToProcess.name,
            type: mimeType,
            size: finalSize,
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

    if (droppedFile.size > 50 * 1024 * 1024) { // 50MB limit
        addToast(t('toasts.fileSizeTooLarge', { fileName: droppedFile.name, size: 50 }), 'error');
        return;
    }
    
    setIsProcessing(true);
    const context = intendedStudyContext ? intendedStudyContext.fromSlot.activity : undefined;
    const processedFile = await processFile(droppedFile, context);
    if (processedFile) {
        setLearningHubState(prev => ({ ...prev, file: processedFile, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] }));
        setAnalysisMode('actions');
    }
    setIsProcessing(false);
  }, [addToast, t, intendedStudyContext, processFile, setLearningHubState, setAnalysisMode]);

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

  const handleAnalysis = async (mode: 'summarize' | 'explain' | 'read') => {
    if (!file || isProcessing) return;
  
    setAnalysisMode(mode);
  
    if (analysisResults[mode]) {
      if (mode === 'read') {
        setReadAloudState('interactive');
        setAnalysisMode('read-focus');
      }
      return;
    }
  
    setIsProcessing(true);
    setLoadingMessage(t(`uploadslides.loading.${mode}` as any));
    try {
      const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
      let result = '';
      if (mode === 'summarize') {
        result = await summarizeDocument(filePart, file.context, { fast: true });
      } else if (mode === 'explain') {
        result = await explainDocument(filePart, file.context, { fast: true });
      } else if (mode === 'read') {
        result = await extractTextFromDocument(filePart, { fast: true });
      }
  
      setAnalysisResult(mode, result);
    } catch (error: any) {
      addToast(error.message || `Failed to ${mode} document.`, 'error');
      setAnalysisMode('actions');
    } finally {
      setIsProcessing(false);
      if (mode === 'read') {
        setReadAloudState('interactive');
        setAnalysisMode('read-focus');
      }
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
        const filePart: ImagePart | null = historyForApi.length === 0 
            ? { inlineData: { data: file.base64, mimeType: file.type } }
            : null;
            
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
          navigator.clipboard.writeText(content).then(() => addToast(t('toasts.copied'), 'success'));
      }
  };

  const handleReadAloudClick = () => {
    handleAnalysis('read');
  };

  const handleEditMessage = (index: number) => {
      const turn = chatHistory[index];
      if(turn) {
          setEditingMessage({ index, text: turn.user });
      }
  };

  const handleCancelEdit = () => setEditingMessage(null);

  const handleSaveEdit = (index: number) => {
      if(!editingMessage) return;

      const updatedHistory = [...chatHistory];
      updatedHistory.splice(index); // Remove all turns from the edited message onwards

      setLearningHubState(prev => ({
          ...prev,
          chatHistory: updatedHistory,
      }));
      setChatInput(editingMessage.text);
      setEditingMessage(null);
  };

  const AnalysisView: React.FC = () => {
    const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read'];
    
    if (isProcessing && !content) return <LoadingIndicator message={loadingMessage} />;
    
    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 flex-1 overflow-y-auto">
            <RichTextViewer content={content || t('uploadslides.noContent')} />
        </div>
    );
  };

  const ActionCard: React.FC<{ titleKey: string; descKey: string; onClick: () => void }> = ({ titleKey, descKey, onClick }) => (
    <button onClick={onClick} disabled={isProcessing} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 text-left w-full hover:border-primary dark:hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        {/* FIX: Cast to any to bypass incomplete TranslationKey type. */}
        <h4 className="font-bold text-lg text-gray-800 dark:text-white">{t(titleKey as any)}</h4>
        {/* FIX: Cast to any to bypass incomplete TranslationKey type. */}
        <p className="text-sm text-gray-500 mt-1">{t(descKey as any)}</p>
    </button>
  );

  const renderFileContent = () => {
    if (analysisMode === 'read-focus') {
        const topBarButtonClass = "p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors";
        return (
             <div className="h-full flex flex-col relative bg-gray-200 dark:bg-gray-900 rounded-lg">
                <div
                    onMouseEnter={() => setIsHoveringTopBar(true)}
                    onMouseLeave={() => setIsHoveringTopBar(false)}
                    className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-between gap-8 px-4 py-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-lg rounded-full shadow-xl border border-white/20 dark:border-gray-500/20"
                >
                    <button onClick={() => { handleStop(); setAnalysisMode('actions'); }} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                        <ArrowLeftIcon className="w-4 h-4" /> 
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={() => { handlePlay(0); }} className={topBarButtonClass} title="Restart"><RefreshIcon className="w-5 h-5" /></button>
                        {readAloudState === 'playing' ? (
                            <button onClick={handlePause} className={topBarButtonClass} title="Pause"><PauseIcon className="w-5 h-5" /></button>
                        ) : (
                            <button onClick={readAloudState === 'paused' ? handleResume : () => handlePlay(0)} className={topBarButtonClass} title="Play"><PlayIcon className="w-5 h-5" /></button>
                        )}
                        <button onClick={handleStop} className={topBarButtonClass} title="Stop"><StopIcon className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                           <ZoomOutIcon className="w-5 h-5"/>
                           <input type="range" min="0.5" max="2.5" step="0.1" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} className="w-24 accent-primary" aria-label="Zoom"/>
                           <ZoomInIcon className="w-5 h-5"/>
                        </div>
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t('readAloud.speed')}</span>
                            <input type="range" min="0.5" max="2" step="0.1" value={readingSpeed} onChange={e => setReadingSpeed(parseFloat(e.target.value))} className="w-20 accent-primary" aria-label="Reading speed"/>
                        </div>
                         <div className="flex items-center gap-2">
                            <VolumeIcon className="w-5 h-5" />
                            <input type="range" min="0" max="1" step="0.1" value={readingVolume} onChange={e => setReadingVolume(parseFloat(e.target.value))} className="w-20 accent-primary" aria-label="Volume"/>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden pt-16 grid grid-cols-2 gap-4 p-4">
                     <div className="h-full overflow-y-auto">
                        <FileViewer file={file} zoom={zoom} onZoomChange={setZoom} showControls={false} />
                     </div>
                     <div 
                        onMouseMove={handleMouseMove}
                        className="relative h-full group"
                    >
                         <div className="h-full overflow-y-auto bg-white dark:bg-gray-800 p-6 rounded-lg">
                            {isProcessing && !analysisResults.read ? (
                                <LoadingIndicator message={t('uploadslides.loading.read')} />
                            ) : (
                                <RichTextViewer content={analysisResults.read || t('uploadslides.loading.content' as any)} highlightCharIndex={highlightCharIndex} />
                            )}
                         </div>
                         <div
                            onMouseEnter={() => setIsHoveringPlaybackControls(true)}
                            onMouseLeave={() => setIsHoveringPlaybackControls(false)}
                            style={{ 
                                left: `${controlsPosition.x}px`, 
                                top: `${controlsPosition.y}px`,
                            }}
                            className={`absolute z-30 flex items-center gap-1 p-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-lg rounded-full shadow-xl border border-white/40 dark:border-gray-500/30 transition-opacity transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 ${isHoveringTopBar ? '!opacity-0' : ''}`}
                        >
                            {readAloudState === 'playing' && (
                                <button onClick={handlePause} className="p-3 text-gray-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full"><PauseIcon className="w-6 h-6" /></button>
                            )}
                            {(readAloudState === 'paused' || readAloudState === 'interactive') && !isProcessing && analysisResults.read && (
                                <button onClick={readAloudState === 'paused' ? handleResume : () => handlePlay(0)} className="p-3 text-gray-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full"><PlayIcon className="w-6 h-6" /></button>
                            )}
                            {(readAloudState === 'playing' || readAloudState === 'paused') && (
                                <button onClick={handleStop} className="p-3 text-gray-800 dark:text-white hover:bg-black/10 dark:hover:bg-white/10 rounded-full"><StopIcon className="w-6 h-6" /></button>
                            )}
                        </div>
                     </div>
                </div>
            </div>
        )
    }

    if (isStudyModeView) {
        return <FileViewer file={file} />;
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
            <ActionCard titleKey="uploadslides.actions.summarize" descKey="uploadslides.actions.summarize.desc" onClick={() => handleAnalysis('summarize')} />
            <ActionCard titleKey="uploadslides.actions.explain" descKey="uploadslides.actions.explain.desc" onClick={() => handleAnalysis('explain')} />
            <ActionCard titleKey="uploadslides.actions.chat" descKey="uploadslides.actions.chat.desc" onClick={() => setAnalysisMode('chat')} />
            <ActionCard titleKey="uploadslides.actions.read" descKey="uploadslides.actions.read.desc" onClick={handleReadAloudClick} />
          </div>

          <div className="flex-1 overflow-hidden">
            {analysisMode !== 'none' && analysisMode !== 'actions' && (
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold capitalize">{t('uploadslides.results.title', { mode: analysisMode })}</h4>
                        {analysisMode !== 'chat' && (
                            <div className="flex items-center gap-2">
                                <button onClick={copyContent} disabled={isProcessing || !analysisResults[analysisMode as 'summarize' | 'explain' | 'read']} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                                    <CopyIcon className="w-4 h-4" /> {t('common.copy')}
                                </button>
                                <button onClick={saveToNotes} disabled={isProcessing || !analysisResults[analysisMode as 'summarize' | 'explain' | 'read']} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                                    <SaveIcon className="w-4 h-4" /> {t('common.saveToNotes')}
                                </button>
                            </div>
                        )}
                    </div>
                    {analysisMode === 'chat' ? (
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
            {(analysisMode === 'none' || analysisMode === 'actions') && (
                <div className="flex-1 flex items-center justify-center text-center text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p>{t('uploadslides.selectAction')}</p>
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
                    <p className="text-gray-500">{t('uploadslides.fileFormatHint')}</p>
                </div>
            </div>
        )}
      </div>
      {!isStudyModeView && !activeSession && file && (
        <div className="mt-6 text-center">
            <button onClick={handleStartStudyRequest} className="px-8 py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark transition-all">
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