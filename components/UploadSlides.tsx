import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import katex from 'katex';
import type { SmartPlan, ActiveSession, Toast, LearningHubState, UploadedFile, ImagePart, Note, PlanSlot, ConflictInfo, ChatTurn, View, AnalysisMode, UploadedMaterialInfo } from '../types';
import { ActivityType, DayOfWeek } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getDocumentContext, isStudyMaterial, summarizeDocument, explainDocument, extractTextFromDocument, chatWithDocumentStream, deepAnalyseDocument } from '../services/geminiService';
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
import { timeToMinutes, processAndResizeImage, getDayOfWeek } from '../lib/utils';
import { CheckIcon } from './icons/CheckIcon';
import { PencilIcon } from './icons/PencilIcon';
import { VolumeIcon } from './icons/VolumeIcon';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { TableRenderer, parseMarkdownTable } from './TableRenderer';
import FloatingDictionary from './FloatingDictionary';

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
  onAttemptUpload: (file: File) => void;
  onSaveChatToHistory?: (chatHistory: any[], documentName: string, documentContext: string) => Promise<void>;
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
        <div style={{ width:40, height:40, borderRadius:'50%', border:'4px solid rgba(99,102,241,0.3)', borderTopColor:'var(--color-primary, #6366f1)', animation:'spin 0.75s linear infinite', WebkitAnimation:'spin 0.75s linear infinite' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@-webkit-keyframes spin{to{-webkit-transform:rotate(360deg)}}`}</style>
        </div>
        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{message}</p>
    </div>
);

const LoadingOverlay: React.FC<{ isLoading: boolean; message: string; onCancel?: () => void }> = ({ isLoading, message, onCancel }) => {
    if (!isLoading) return null;
    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex flex-col items-center justify-center z-50 rounded-2xl backdrop-blur-sm">
            <div style={{ width:48, height:48, borderRadius:'50%', border:'4px solid rgba(99,102,241,0.3)', borderTopColor:'var(--color-primary, #6366f1)', animation:'spin 0.75s linear infinite', WebkitAnimation:'spin 0.75s linear infinite' }}></div>
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{message}</p>
            {onCancel && (
                <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow-sm transition-colors">
                    Cancel
                </button>
            )}
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

const RichTextViewer: React.FC<{ content: string; highlightCharIndex?: number; scrollContainerRef?: React.RefObject<HTMLDivElement> }> = React.memo(({ content, highlightCharIndex, scrollContainerRef }) => {
    let charCounter = 0;

    const renderTextWithHighlight = (text: string, key?: number | string) => {
        const textStart = charCounter;
        charCounter += text.length;
        
        if (highlightCharIndex === undefined || highlightCharIndex < textStart || highlightCharIndex >= charCounter) {
            return <span key={key}>{text}</span>;
        }
        
        const segments = text.split(/(\s+)/);
        let innerOffset = textStart;
        return <span key={key}>{segments.map((segment, index) => {
            const segmentStart = innerOffset;
            innerOffset += segment.length;
            const isHighlighted = highlightCharIndex >= segmentStart && highlightCharIndex < innerOffset && segment.trim().length > 0;
            return <span key={index} className={isHighlighted ? 'bg-primary/20 dark:bg-primary/30 rounded transition-colors duration-150' : ''} {...(isHighlighted ? { 'data-reading-highlight': 'true' } : {})}>{segment}</span>;
        })}</span>;
    };

    const renderInlineElements = (line: string) => {
        const inlineRegex = /(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))|(\*\*.*?\*\*)|(`.*?`)/g;
        const parts = line.split(inlineRegex).filter(Boolean);
        return parts.map((part, index) => {
            if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
                charCounter += part.length;
                const inner = part.startsWith('$$') ? part.slice(2, -2) : part.slice(2, -2);
                return <KatexRenderer key={index} content={inner} displayMode={true} />;
            }
            if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
                charCounter += part.length;
                const inner = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
                return <KatexRenderer key={index} content={inner} displayMode={false} />;
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                charCounter += 2;
                const innerContent = part.slice(2,-2);
                const rendered = renderTextWithHighlight(innerContent, index);
                charCounter += 2;
                return <strong key={index}>{rendered}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                charCounter += part.length;
                return <code key={index} className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
            }
            return renderTextWithHighlight(part, index);
        });
    };

    const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

    return (
        <div className="prose prose-lg dark:prose-invert max-w-none text-left text-black dark:text-gray-100 prose-headings:text-black dark:prose-headings:text-white prose-p:text-black dark:prose-p:text-gray-100 prose-li:text-black dark:prose-li:text-gray-100 prose-strong:text-black dark:prose-strong:text-white">
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
                let tableBuffer: string[] = [];
                let inTable = false;

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
                        elements.push(<p key={`p-${elements.length}`} className="my-2 text-black dark:text-gray-100">{paragraphContent}</p>);
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
                                    const renderedItem = <li key={i} className="text-black dark:text-gray-100">{renderInlineElements(item)}</li>;
                                    charCounter++; // for newline after list item
                                    return renderedItem;
                                })}
                            </ul>
                        );
                        listItems = [];
                    }
                    inList = false;
                };

                const flushTable = () => {
                    if (tableBuffer.length > 0) {
                        const tableData = parseMarkdownTable(tableBuffer.join('\n'));
                        if (tableData) {
                            elements.push(<TableRenderer key={`tbl-${elements.length}`} data={tableData} />);
                            // We treat the table as a single block for char counting purposes if needed,
                            // but generally, we just skip detailed highlighting inside complex tables for now.
                            charCounter += tableBuffer.join('\n').length;
                        } else {
                            // If invalid table, treat as normal lines
                             tableBuffer.forEach(l => {
                                 paragraphLines.push(l);
                             });
                             flushParagraph();
                        }
                        tableBuffer = [];
                    }
                    inTable = false;
                };

                lines.forEach((line) => {
                    const isTableLine = line.trim().startsWith('|') || (inTable && line.trim().startsWith('|'));

                    if (isTableLine) {
                         flushParagraph();
                         flushList();
                         inTable = true;
                         tableBuffer.push(line);
                         return;
                    }
                    
                    if (inTable && !isTableLine) {
                        flushTable();
                    }

                    if (line.match(/^###\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h4 key={elements.length} className="font-bold text-lg mt-4 mb-2 text-black dark:text-white">{renderInlineElements(line.replace(/^###\s/, ''))}</h4>);
                        charCounter++;
                    } else if (line.match(/^##\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h3 key={elements.length} className="font-bold text-xl mt-5 mb-2 text-black dark:text-white">{renderInlineElements(line.replace(/^##\s/, ''))}</h3>);
                        charCounter++;
                    } else if (line.match(/^#\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h2 key={elements.length} className="font-bold text-2xl mt-6 mb-3 text-black dark:text-white">{renderInlineElements(line.replace(/^#\s/, ''))}</h2>);
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
                        flushTable();
                        charCounter++;
                    }
                });

                flushParagraph();
                flushList();
                flushTable();
                
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
        <div className="flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden" style={{ height: '55vh', minHeight: 350 }}>
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
            <form onSubmit={handleChatSubmit} className="p-4 border-t dark:border-gray-700 flex gap-2 bg-white dark:bg-gray-800">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isProcessing} className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50" placeholder={t('uploadslides.chat.placeholder')} />
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
  onAttemptUpload,
  onSaveChatToHistory,
}) => {
  const { t } = useLanguage();
  const [chatInput, setChatInput] = useState('');
  
  const [readAloudState, setReadAloudState] = useState<ReadAloudState>('idle');
  const [controlsPosition, setControlsPosition] = useState({ x: 0, y: 0 });
  const [readingSpeed, setReadingSpeed] = useState(1);
  const [readingVolume, setReadingVolume] = useState(1);
  const [zoom, setZoom] = useState(1.4);
  const [isHoveringTopBar, setIsHoveringTopBar] = useState(false);
  const [isHoveringPlaybackControls, setIsHoveringPlaybackControls] = useState(false);
  const [highlightCharIndex, setHighlightCharIndex] = useState(-1);
  const [studyLayout, setStudyLayout] = useState<'split' | 'doc-focus' | 'text-focus'>('doc-focus');

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechCharIndexRef = useRef(0);
  const notesScrollRef = useRef<HTMLDivElement>(null);

  const [sessionPrompt, setSessionPrompt] = useState<{ slot: PlanSlot, nextSlot: PlanSlot | null, day: DayOfWeek } | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ plannedSubject: string; uploadedSubject: string; day: DayOfWeek; slot: PlanSlot; file: UploadedFile; } | null>(null);
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [customizationRequest, setCustomizationRequest] = useState<{ file: UploadedFile, slot?: PlanSlot, isUntracked: boolean } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ index: number; text: string } | null>(null);
  
  const { file, analysisMode, analysisResults, chatHistory, isProcessing, processingMessage } = learningHubState;

  const setFile = (file: UploadedFile | null) => setLearningHubState(prev => ({ ...prev, file }));
  const setAnalysisMode = (mode: AnalysisMode) => setLearningHubState(prev => ({ ...prev, analysisMode: mode }));
  const setAnalysisResult = (type: 'summarize' | 'explain' | 'read' | 'deep', result: string | null) => {
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
  
  // iOS WebKit kills utterances >~15s. We chunk into ~200-word pieces and chain them.
  const CHUNK_WORD_LIMIT = 200;

  const splitIntoChunks = (text: string): string[] => {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += CHUNK_WORD_LIMIT) {
      chunks.push(words.slice(i, i + CHUNK_WORD_LIMIT).join(' '));
    }
    return chunks.length ? chunks : [text];
  };

  const handlePlay = useCallback((startIndex = 0) => {
    const fullText = analysisResults.read;
    if (!fullText || fullText.length <= startIndex) return;

    const textToRead = fullText.substring(startIndex);

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      // Small delay for iOS to fully reset
      setTimeout(() => speakChunked(textToRead, startIndex), 300);
    } else {
      speakChunked(textToRead, startIndex);
    }

    setReadAloudState('playing');
  }, [analysisResults.read, readingSpeed, readingVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakChunked = useCallback((textToRead: string, globalStartIndex: number) => {
    const chunks = splitIntoChunks(textToRead);
    let chunkIndex = 0;
    let charOffset = globalStartIndex;

    // ── iOS keepalive ────────────────────────────────────────────────────────
    // iOS Safari/Chrome kills speechSynthesis after ~15s of silence or if the
    // page loses focus. We use a setInterval to pause/resume every 10s which
    // keeps the audio session alive without interrupting speech.
    const startKeepalive = () => {
      stopKeepalive();
      keepaliveRef.current = setInterval(() => {
        if (
          typeof speechSynthesis !== 'undefined' &&
          speechSynthesis.speaking &&
          !speechSynthesis.paused
        ) {
          speechSynthesis.pause();
          speechSynthesis.resume();
        }
      }, 10000); // every 10s — safe interval for iOS
    };

    const stopKeepalive = () => {
      if (keepaliveRef.current !== null) {
        clearInterval(keepaliveRef.current);
        keepaliveRef.current = null;
      }
    };

    const speakNext = () => {
      if (chunkIndex >= chunks.length) {
        stopKeepalive();
        setReadAloudState('interactive');
        speechCharIndexRef.current = 0;
        setHighlightCharIndex(-1);
        return;
      }
      if (utteranceRef.current === null) {
        stopKeepalive();
        return; // stopped externally
      }

      const chunk = chunks[chunkIndex];
      const utterance = new SpeechSynthesisUtterance(chunk);
      utteranceRef.current = utterance;

      utterance.rate = readingSpeed;
      utterance.volume = readingVolume;

      // Pick best available English voice
      const voices = speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.lang.startsWith('en') && v.localService) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onboundary = (event) => {
        const absoluteCharIndex = charOffset + event.charIndex;
        setHighlightCharIndex(absoluteCharIndex);
        speechCharIndexRef.current = absoluteCharIndex;
      };

      utterance.onend = () => {
        if (utteranceRef.current === null) { stopKeepalive(); return; }
        charOffset += chunk.length + 1;
        chunkIndex++;
        // Slightly longer delay on iOS prevents audio session from expiring
        setTimeout(speakNext, 150);
      };

      utterance.onerror = (e) => {
        if (e.error === 'interrupted') return; // we cancelled — expected
        console.warn('SpeechSynthesis error:', e.error);
        if (e.error === 'not-allowed') {
          // User hasn't interacted yet — show a message
          stopKeepalive();
          setReadAloudState('interactive');
        } else if (e.error === 'network') {
          // Network voice failed — retry with local voice
          stopKeepalive();
          setTimeout(() => {
            const localVoice = speechSynthesis.getVoices().find(v => v.localService);
            if (localVoice) {
              utterance.voice = localVoice;
              speechSynthesis.speak(utterance);
              startKeepalive();
            }
          }, 300);
        } else {
          // Skip this chunk and continue
          charOffset += chunk.length + 1;
          chunkIndex++;
          setTimeout(speakNext, 300);
        }
      };

      speechSynthesis.speak(utterance);
      startKeepalive(); // restart keepalive on each chunk
    };

    // Ensure voices are loaded (async on first call, especially on Android)
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      utteranceRef.current = {} as SpeechSynthesisUtterance;
      speakNext();
    } else {
      // Voices not loaded yet — wait for them
      speechSynthesis.onvoiceschanged = () => {
        speechSynthesis.onvoiceschanged = null;
        utteranceRef.current = {} as SpeechSynthesisUtterance;
        speakNext();
      };
      // Hard fallback: if onvoiceschanged never fires (some Android browsers)
      setTimeout(() => {
        if (utteranceRef.current === null) {
          utteranceRef.current = {} as SpeechSynthesisUtterance;
          speakNext();
        }
      }, 1200);
    }
  }, [readingSpeed, readingVolume]); // eslint-disable-line react-hooks/exhaustive-deps


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
      utteranceRef.current = null; // signal to speakNext to abort
      if (keepaliveRef.current !== null) {
        clearInterval(keepaliveRef.current);
        keepaliveRef.current = null;
      }
      if (speechSynthesis.speaking || speechSynthesis.paused || speechSynthesis.pending) {
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

  // Auto-scroll the notes panel to follow the reading highlight
  useEffect(() => {
    if (readAloudState !== 'playing' || !notesScrollRef.current) return;
    const highlighted = notesScrollRef.current.querySelector('[data-reading-highlight="true"]') as HTMLElement | null;
    if (!highlighted) return;
    const container = notesScrollRef.current;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elTop = highlighted.offsetTop;
    const elBottom = elTop + highlighted.offsetHeight;
    // Only scroll if the element is not already comfortably in view (with 120px buffer)
    const buffer = 120;
    if (elTop - buffer < containerTop || elBottom + buffer > containerBottom) {
        container.scrollTo({
            top: Math.max(0, elTop - container.clientHeight / 2),
            behavior: 'smooth',
        });
    }
  }, [highlightCharIndex, readAloudState]);

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

  
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles && rejectedFiles.length > 0) {
      addToast('Only PDF, images (JPG/PNG/WEBP), and DOCX files are supported.', 'error');
      return;
    }

    const droppedFile = acceptedFiles[0];
    if (!droppedFile) return;

    // Extra safety check — catch office files that slip through MIME detection
    const lower = droppedFile.name.toLowerCase();
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
        addToast(
            `Please convert "${droppedFile.name}" to PDF before uploading. Open it in your app, then choose "Save as PDF" or "Export to PDF", and upload the PDF here.`,
            'warning'
        );
        return;
    }

    if (droppedFile.size > 25 * 1024 * 1024) { // 25MB limit
        addToast(t('toasts.fileSizeTooLarge', { fileName: droppedFile.name, size: 25 }), 'error');
        return;
    }
    
    onAttemptUpload(droppedFile);

  }, [addToast, t, onAttemptUpload]);

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

  const handleCustomizationConfirm = (config: { studyDuration: number; breakDuration: number; breakActivity: string; breakLink: string; breakPlacement: 'during' | 'after'; addToPlan: boolean }) => {
      if (!customizationRequest) return;
      const { file, slot: initialSlot, isUntracked } = customizationRequest;
      setCustomizationRequest(null);

      // Handle adding to plan if requested
      if (config.addToPlan && isUntracked && smartPlan) {
          const now = new Date();
          const day = getDayOfWeek(now);
          const startTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          // Calculate end time based on duration
          const endTime = new Date(now.getTime() + config.studyDuration * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const newSlot: PlanSlot = {
              activity: customizationRequest.file.context, // or subject
              startTime: startTime,
              endTime: endTime,
              type: ActivityType.STUDY,
              isLocked: false,
              durationMinutes: config.studyDuration
          };

          const updatedPlan = smartPlan.map(dayPlan => {
              if (dayPlan.day === day) {
                  return { ...dayPlan, slots: [...dayPlan.slots, newSlot] };
              }
              return dayPlan;
          });
          setSmartPlan(updatedPlan);
          addToast(t('toasts.timetableUpdated'), 'success');
      }

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: isProcessing,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif'],
      // DOCX support
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    } as any,
  } as any);

  const handleAnalysis = async (mode: 'summarize' | 'explain' | 'read' | 'deep') => {
    if (!file || isProcessing) return;
  
    setAnalysisMode(mode);
  
    if (analysisResults[mode]) {
      if (mode === 'read') {
        setReadAloudState('interactive');
        setAnalysisMode('read-focus');
      }
      return;
    }
  
    // When resumed from history, the original file bytes are not stored — only context text.
    // Summarize/Explain/Read need the actual file; show a friendly message instead of crashing.
    if (!file.base64) {
        addToast('This session was restored from history. Please re-upload the original file to use Summarize, Explain, or Read Aloud. You can still continue chatting using your saved context.', 'warning');
        return;
    }

    setLearningHubState(prev => ({...prev, isProcessing: true, processingMessage: t(`uploadslides.loading.${mode}` as any)}));
    try {
      const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
      let result = '';
      if (mode === 'deep') {
        result = await deepAnalyseDocument(filePart, file.context);
      } else if (mode === 'summarize') {
        result = await summarizeDocument(filePart, file.context, { fast: true });
      } else if (mode === 'explain') {
        result = await explainDocument(filePart, file.context, { fast: true });
      } else if (mode === 'read') {
        // Use the 'fast' option to speed up text extraction for the Read Aloud feature, per user request.
        result = await extractTextFromDocument(filePart, { fast: true });
      }
  
      setAnalysisResult(mode, result);
    } catch (error: any) {
      const msg = error?.message || `We could not complete the ${mode} analysis. Please check your connection and try again.`;
      addToast(msg, 'error');
      setAnalysisMode('actions');
    } finally {
      setLearningHubState(prev => ({...prev, isProcessing: false, processingMessage: ''}));
      if (mode === 'read') {
        setReadAloudState('interactive');
        setAnalysisMode('read-focus');
      }
    }
  };
  
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !file) return;
    
    const userMessage = chatInput;
    const historyForApi: ChatTurn[] = [...chatHistory];
    
    setLearningHubState(prev => ({
        ...prev, 
        isProcessing: true,
        chatHistory: [...prev.chatHistory, { user: userMessage, blay: t('uploadslides.blayIsTyping') }]
    }));
    setChatInput('');

    try {
        // When resuming from history, base64 may be empty — use null so AI uses context text only.
        const filePart: ImagePart | null = file.base64
            ? { inlineData: { data: file.base64, mimeType: file.type } }
            : null;
            
        const stream = await chatWithDocumentStream(filePart as any, userMessage, historyForApi, file.context, smartPlan);
        
        let fullResponse = '';
        for await (const chunk of stream) {
            fullResponse += (chunk.text ?? '');
            setLearningHubState(prev => {
                const newHistory = [...prev.chatHistory];
                if (newHistory.length > 0) {
                    newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], blay: fullResponse };
                }
                return { ...prev, chatHistory: newHistory };
            });
        }

        // Auto-save chat session to history after the full response is received
        if (onSaveChatToHistory && file) {
            try {
                const finalHistory = [...historyForApi, { user: userMessage, blay: fullResponse }];
                onSaveChatToHistory(finalHistory, file.name, file.context).catch(() => {});
            } catch (e) {
                console.error('Failed to save chat to history:', e);
            }
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
        setLearningHubState(prev => ({...prev, isProcessing: false}));
    }
  };
  
  const clearFile = () => {
    handleStop();
    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null, deep: null }, chatHistory: [], isProcessing: false, processingMessage: '' });
  };
  
  const saveToNotes = () => {
      const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read' | 'deep'];
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
      const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read' | 'deep'];
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
    // 'deep' is also a valid analysis mode — include it in the cast
    const content = analysisResults[analysisMode as 'summarize' | 'explain' | 'read' | 'deep'];
    
    if (isProcessing && !content) return <LoadingIndicator message={processingMessage || ''} />;
    
    return (
        // ── LIGHT MODE FIX ─────────────────────────────────────────────────
        // prose class renders markdown but defaults to light gray text which
        // disappears on white background in light mode.
        // text-black dark:text-white ensures readable contrast always.
        <div className="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-6 flex-1 overflow-y-auto border border-gray-200/60 dark:border-gray-700/50 text-black dark:text-white shadow-inner">
            <RichTextViewer content={content || t('uploadslides.noContent')} />
        </div>
    );
  };

  const ActionCard: React.FC<{ titleKey: string; descKey: string; onClick: () => void; highlight?: boolean }> = ({ titleKey, descKey, onClick, highlight }) => (
    <button onClick={onClick} disabled={isProcessing} className={`p-6 rounded-xl shadow-lg border text-left w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${highlight ? 'bg-gray-950 dark:bg-black border-gray-950 dark:border-gray-800 text-white hover:bg-black dark:hover:bg-gray-900 hover:shadow-xl' : 'bg-white dark:bg-gray-800 dark:border-gray-700 hover:border-primary dark:hover:border-primary'}`}>
        <h4 className={`font-bold text-lg ${highlight ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{t(titleKey)}</h4>
        <p className={`text-sm mt-1 ${highlight ? 'text-slate-300' : 'text-gray-500'}`}>{t(descKey)}</p>
    </button>
  );

  const renderFileContent = () => {
    const getModeLabel = (mode: string) => {
        switch (mode) {
            case 'deep': return t('uploadslides.actions.analyze');
            case 'summarize': return t('uploadslides.actions.summarize');
            case 'explain': return t('uploadslides.actions.explain');
            case 'read': return t('uploadslides.actions.read');
            case 'chat': return t('uploadslides.actions.chat');
            default: return mode;
        }
    };

    if (analysisMode === 'read-focus') {
        const topBarButtonClass = "p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors";

        // Layout classes
        const docPanelClass = studyLayout === 'text-focus' ? 'hidden' : studyLayout === 'doc-focus' ? 'flex flex-col' : 'flex flex-col';
        const textPanelClass = studyLayout === 'doc-focus' ? 'hidden' : 'flex flex-col';
        const docPanelStyle: React.CSSProperties = studyLayout === 'split' ? { width: '50%', flexShrink: 0 } : studyLayout === 'doc-focus' ? { width: '100%' } : { width: 0, overflow: 'hidden', padding: 0 };
        const textPanelStyle: React.CSSProperties = studyLayout === 'split' ? { width: '50%', flexShrink: 0 } : studyLayout === 'text-focus' ? { width: '100%' } : { width: 0, overflow: 'hidden', padding: 0 };

        return (
            <div className="flex flex-col" style={{ height: '100%', background: 'var(--color-bg, #f3f4f6)', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>

                {/* ── Top control bar ──────────────────────────────────── */}
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 20 }}>

                    {/* Left: back + playback */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { handleStop(); setAnalysisMode('actions'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all"
                        >
                            <ArrowLeftIcon className="w-4 h-4" /> Back
                        </button>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />

                        <button onClick={() => handlePlay(0)} className={topBarButtonClass} title="Restart"><RefreshIcon className="w-5 h-5" /></button>
                        {readAloudState === 'playing' ? (
                            <button onClick={handlePause} className={`${topBarButtonClass} text-primary`} title="Pause"><PauseIcon className="w-5 h-5" /></button>
                        ) : (
                            <button onClick={readAloudState === 'paused' ? handleResume : () => handlePlay(0)} className={topBarButtonClass} title="Play"><PlayIcon className="w-5 h-5" /></button>
                        )}
                        <button onClick={handleStop} className={topBarButtonClass} title="Stop"><StopIcon className="w-5 h-5" /></button>

                        {/* Reading speed */}
                        <div className="hidden sm:flex items-center gap-1.5 ml-2 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-1">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">{t('readAloud.speed')}</span>
                            <input type="range" min="0.5" max="2" step="0.1" value={readingSpeed} onChange={e => setReadingSpeed(parseFloat(e.target.value))} className="w-16 accent-primary" />
                            <span className="text-xs font-black text-primary w-7 text-right">{readingSpeed.toFixed(1)}×</span>
                        </div>

                        {/* Volume */}
                        <div className="hidden sm:flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-1">
                            <VolumeIcon className="w-4 h-4 text-gray-500" />
                            <input type="range" min="0" max="1" step="0.1" value={readingVolume} onChange={e => setReadingVolume(parseFloat(e.target.value))} className="w-16 accent-primary" />
                        </div>
                    </div>

                    {/* Centre: file name */}
                    <div className="hidden md:block text-center truncate max-w-xs">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest truncate">{file?.name}</p>
                    </div>

                    {/* Right: layout toggle + zoom */}
                    <div className="flex items-center gap-2">
                        {/* Zoom (only shown in doc or split view) */}
                        {studyLayout !== 'text-focus' && (
                            <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl px-2 py-1">
                                <ZoomOutIcon className="w-4 h-4 text-gray-500" />
                                <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} className="w-20 accent-primary" />
                                <ZoomInIcon className="w-4 h-4 text-gray-500" />
                                <span className="text-xs font-black text-gray-500 w-8">{Math.round(zoom * 100)}%</span>
                            </div>
                        )}

                        {/* Layout selector */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-0.5">
                            {([
                                { id: 'doc-focus', icon: '📄', tip: 'Document only' },
                                { id: 'split',     icon: '⬛⬜', tip: 'Split view' },
                                { id: 'text-focus',icon: '📝', tip: 'Notes only' },
                            ] as const).map(({ id, icon, tip }) => (
                                <button
                                    key={id}
                                    onClick={() => setStudyLayout(id)}
                                    title={tip}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                        studyLayout === id
                                            ? 'bg-white dark:bg-gray-600 shadow text-primary'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Content area ─────────────────────────────────────── */}
                <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>

                    {/* Document panel */}
                    {studyLayout !== 'text-focus' && (
                        <div
                            className="flex flex-col overflow-hidden"
                            style={{
                                ...docPanelStyle,
                                background: '#1a1a2e',
                                borderRight: studyLayout === 'split' ? '3px solid var(--color-primary, #6366f1)' : 'none',
                            }}
                        >
                            {/* Panel header */}
                            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-black/20" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <span className="text-xs font-black text-white/40 uppercase tracking-widest">📄 Your Document</span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <FileViewer file={file} zoom={zoom} onZoomChange={setZoom} showControls={false} />
                            </div>
                        </div>
                    )}

                    {/* Study notes panel */}
                    {studyLayout !== 'doc-focus' && (
                        <div
                            className="flex flex-col overflow-hidden"
                            style={{ ...textPanelStyle, background: '#ffffff' }}
                        >
                            {/* Panel header */}
                            <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-gray-100" style={{ background: '#f8f9ff' }}>
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">📝 Study Notes</span>
                                {readAloudState === 'playing' && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-primary animate-pulse">● Reading aloud…</span>
                                    </div>
                                )}
                            </div>

                            <div
                                ref={notesScrollRef}
                                onMouseMove={handleMouseMove}
                                className="flex-1 overflow-y-auto bg-white dark:bg-gray-900"
                                style={{ padding: '32px 36px', fontSize: '1.08rem', lineHeight: '1.9', color: 'inherit', scrollBehavior: 'smooth' }}
                            >
                                {isProcessing && !analysisResults.read ? (
                                    <LoadingIndicator message={processingMessage || t('uploadslides.loading.read')} />
                                ) : (
                                    <div className="max-w-2xl mx-auto">
                                        <RichTextViewer
                                            content={analysisResults.read || t('uploadslides.loading.content' as any)}
                                            highlightCharIndex={highlightCharIndex}
                                            scrollContainerRef={notesScrollRef}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Doc-focus: small floating notes button */}
                    {studyLayout === 'doc-focus' && analysisResults.read && (
                        <div className="absolute bottom-6 right-6 z-30">
                            <button
                                onClick={() => setStudyLayout('split')}
                                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 font-black text-sm hover:scale-105 transition-transform"
                            >
                                📝 Open study notes
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Playback status bar ──────────────────────────────── */}
                {(readAloudState === 'playing' || readAloudState === 'paused') && (
                    <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2 bg-primary/10 border-t border-primary/20">
                        <div className={`w-2 h-2 rounded-full ${readAloudState === 'playing' ? 'bg-primary animate-pulse' : 'bg-gray-400'}`} />
                        <span className="text-xs font-bold text-primary">
                            {readAloudState === 'playing' ? 'Reading aloud…' : 'Paused'}
                        </span>
                        <div className="flex-1" />
                        {readAloudState === 'playing' ? (
                            <button onClick={handlePause} className="px-3 py-1 text-xs font-black text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">Pause</button>
                        ) : (
                            <button onClick={handleResume} className="px-3 py-1 text-xs font-black text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">Resume</button>
                        )}
                        <button onClick={handleStop} className="px-3 py-1 text-xs font-black text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition-colors">Stop</button>
                    </div>
                )}
            </div>
        );
    }

    if (isStudyModeView) {
        return <FileViewer file={file} />;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-6">
              <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{file?.name}</h3>
                  <p className="text-sm text-gray-500">{file?.context}</p>
              </div>
              {!isStudyModeView && (
                <button onClick={clearFile} disabled={isProcessing} className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"><CloseIcon className="w-5 h-5"/></button>
              )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <ActionCard titleKey="uploadslides.actions.analyze" descKey="uploadslides.actions.analyze.desc" onClick={() => handleAnalysis('deep')} highlight={true} />
            <ActionCard titleKey="uploadslides.actions.summarize" descKey="uploadslides.actions.summarize.desc" onClick={() => handleAnalysis('summarize')} />
            <ActionCard titleKey="uploadslides.actions.explain" descKey="uploadslides.actions.explain.desc" onClick={() => handleAnalysis('explain')} />
            <ActionCard titleKey="uploadslides.actions.chat" descKey="uploadslides.actions.chat.desc" onClick={() => setAnalysisMode('chat')} />
            <ActionCard titleKey="uploadslides.actions.read" descKey="uploadslides.actions.read.desc" onClick={handleReadAloudClick} />
          </div>

          <div className="overflow-hidden" style={{ minHeight: 0, flex: '1 1 auto' }}>
            {analysisMode !== 'none' && analysisMode !== 'actions' && (
                <div className="flex flex-col" style={{ height: '100%' }}>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            {t('uploadslides.results.title', { mode: getModeLabel(analysisMode) })}
                        </h4>
                        {analysisMode !== 'chat' && (
                            <div className="flex items-center gap-2">
                                <button onClick={copyContent} disabled={isProcessing || !analysisResults[analysisMode as 'summarize' | 'explain' | 'read' | 'deep']} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 font-medium">
                                    <CopyIcon className="w-4 h-4" /> {t('common.copy')}
                                </button>
                                <button onClick={saveToNotes} disabled={isProcessing || !analysisResults[analysisMode as 'summarize' | 'explain' | 'read' | 'deep']} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 font-medium">
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
          {!isStudyModeView && !activeSession && file && (
            <div className="mt-6 text-center">
                <button onClick={handleStartStudyRequest} className="px-8 py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark transition-all">
                    {t('uploadslides.startStudySession')}
                </button>
            </div>
          )}
        </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${analysisMode === 'read-focus' ? 'w-full' : 'max-w-4xl mx-auto'}`}>
      {showTitle && (
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('uploadslides.title')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('uploadslides.subtitle')}</p>
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-0">
        {file ? renderFileContent() : (
            <div className="relative h-full">
                <LoadingOverlay isLoading={isProcessing} message={processingMessage || ''} onCancel={clearFile} />
                <div {...getRootProps()} className={`h-full flex flex-col items-center justify-center p-8 border-4 border-dashed rounded-2xl transition-colors ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'} cursor-pointer`}>
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
            subject={customizationRequest.slot?.activity || customizationRequest.file.context}
            defaultDuration={customizationRequest.slot ? timeToMinutes(customizationRequest.slot.endTime) - timeToMinutes(customizationRequest.slot.startTime) : 50}
            isUntracked={customizationRequest.isUntracked}
        />
       )}
      {/* Floating Dictionary — appears after file is uploaded, persists across all views */}
      {file && <FloatingDictionary />}
    </div>
  );
};

export default UploadSlides;