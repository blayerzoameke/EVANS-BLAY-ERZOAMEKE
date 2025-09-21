import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import katex from 'katex';
import Chart from 'chart.js/auto';

import {
    isStudyMaterial,
    getDocumentContext,
    summarizeDocument,
    explainDocument,
    extractTextFromDocument,
    chatWithDocumentStream,
// FIX: Added .ts extension to geminiService import.
} from '../services/geminiService.ts';
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
    PlanSlot,
} from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { PdfIcon } from './icons/PdfIcon.tsx';
import { PowerPointIcon } from './icons/PowerPointIcon.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';
import AdvancedStudySetupModal from './AdvancedStudySetupModal.tsx';
import UntrackedStudySetupModal from './UntrackedStudySetupModal.tsx';
import type { View } from '../App.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { StopIcon } from './icons/StopIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { PencilIcon } from './icons/PencilIcon.tsx';

// --- Sub-components for Rendering ---

const KatexRenderer: React.FC<{ content: string; displayMode: boolean }> = React.memo(({ content, displayMode }) => {
    const html = katex.renderToString(content, {
        throwOnError: false,
        displayMode,
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
});

const GraphRenderer: React.FC<{ data: any }> = React.memo(({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (canvasRef.current && data) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                // Destroy previous chart instance if it exists
                if (chartRef.current) {
                    chartRef.current.destroy();
                }

                const labels = [];
                const points = [];
                const [min, max] = data.domain;
                const step = (max - min) / 100;
                
                // Create a new function from the string, this is safer than eval
                const func = new Function('x', `return ${data.function.replace(/\^/g, '**')}`);

                for (let x = min; x <= max; x += step) {
                    labels.push(x.toFixed(2));
                    points.push(func(x));
                }

                chartRef.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: `f(x) = ${data.function}`,
                            data: points,
                            borderColor: '#38bdf8', // sky-400
                            tension: 0.1,
                            pointRadius: 0,
                        }]
                    },
                    options: {
                        animation: false,
                    }
                });
            }
        }
        // Cleanup function to destroy chart on component unmount
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [data]);

    return <div className="my-4 p-2 bg-gray-100 dark:bg-gray-900 rounded-md"><canvas ref={canvasRef}></canvas></div>;
});


const FormattedContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    // Regex to capture graph JSON, display LaTeX, inline LaTeX, and bold text
    const regex = /({\s*"graph":[\s\S]*?})|(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\*\*.*?\*\*)/g;
    const parts = content.split(regex).filter(part => part);

    return (
        <div className="prose dark:prose-invert max-w-none">
            {parts.map((part, index) => {
                try {
                    // Check for graph JSON
                    if (part.startsWith('{') && part.endsWith('}')) {
                        const jsonData = JSON.parse(part);
                        if (jsonData.graph) {
                            return <GraphRenderer key={index} data={jsonData.graph} />;
                        }
                    }
                    // Check for display LaTeX
                    if (part.startsWith('$$') && part.endsWith('$$')) {
                        return <KatexRenderer key={index} content={part.slice(2, -2)} displayMode={true} />;
                    }
                    // Check for inline LaTeX
                    if (part.startsWith('$') && part.endsWith('$')) {
                        return <KatexRenderer key={index} content={part.slice(1, -1)} displayMode={false} />;
                    }
                    // Check for bold text
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={index}>{part.slice(2, -2)}</strong>;
                    }
                } catch (e) {
                    // If JSON parsing or anything else fails, just render as text
                }
                // Render plain text
                return <span key={index}>{part}</span>;
            })}
        </div>
    );
});


interface UploadSlidesProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
    learningHubState: LearningHubState;
    setLearningHubState: (state: LearningHubState | ((prevState: LearningHubState) => LearningHubState)) => void;
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
    const [isStreaming, setIsStreaming] = useState(false);
    
    // State for the study session setup flow
    const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
    const [sessionSetup, setSessionSetup] = useState<{file: UploadedFile | null; modalOpen: boolean}>({ file: null, modalOpen: false });
    
    // FIX: Use useRef for the chat input to prevent re-render issues while typing.
    const chatInputRef = useRef<HTMLInputElement>(null);

    // TTS State
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speechUtterance, setSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);

    const { file, analysisMode, analysisResults, chatHistory } = learningHubState;
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isStreaming]);

    // Cleanup TTS on component unmount
    useEffect(() => {
        return () => {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
        };
    }, []);


    const updateState = (newState: Partial<LearningHubState>) => {
        setLearningHubState(prevState => ({ ...prevState, ...newState }));
    };

    const resetState = () => {
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        setIsSpeaking(false);
        setSpeechUtterance(null);
        setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [] });
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
    }, [t, setLearningHubState]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles[0]) {
            processFile(acceptedFiles[0]);
        }
    }, [processFile]);

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
    
    const handleAnalysis = async (mode: AnalysisMode) => {
        if (!file) return;

        // Stop TTS if switching away from 'read' mode
        if (analysisMode === 'read' && mode !== 'read' && speechSynthesis.speaking) {
            speechSynthesis.cancel();
            setIsSpeaking(false);
        }

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
        const question = chatInputRef.current?.value.trim();
        if (!question || !file || isStreaming) return;
        
        if (chatInputRef.current) {
            chatInputRef.current.value = '';
        }
        setIsStreaming(true);

        const newHistory: ChatTurn[] = [...chatHistory, { user: question, blay: '' }];
        updateState({ chatHistory: newHistory });

        try {
            const filePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const stream = await chatWithDocumentStream(filePart, question, chatHistory, file.context);
            
            let currentBlayResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                currentBlayResponse += chunkText;
                setLearningHubState(prevState => ({
                    ...prevState,
                    chatHistory: prevState.chatHistory.map((turn, index) => 
                        index === newHistory.length - 1 ? { ...turn, blay: currentBlayResponse } : turn
                    )
                }));
            }

        } catch (e: any) {
            addToast(e.message || 'Error in chat stream', 'error');
             setLearningHubState(prevState => ({
                ...prevState,
                chatHistory: prevState.chatHistory.map((turn, index) => 
                    index === newHistory.length - 1 ? { ...turn, blay: turn.blay + `\n\n**Error:** ${e.message}` } : turn
                )
            }));
        } finally {
            setIsStreaming(false);
        }
    };

    const handleSaveToNotes = (mode: 'summarize' | 'explain') => {
        const content = analysisResults[mode];
        if (!content || !file) return;

        const newNote: Note = {
            id: Date.now().toString(),
            title: `${t(`uploadslides.${mode}`)}: ${file.name}`,
            content: content,
            subject: file.context,
            createdAt: new Date().toISOString(),
            isFavourite: false,
        };
        setNotes([newNote, ...notes]);
        addToast(t('notes.noteSaved'), 'success');
        setView('notes');
    };

    const handlePlayPauseTTS = () => {
        if (!analysisResults.read) return;

        if (isSpeaking) {
            speechSynthesis.pause();
            setIsSpeaking(false);
        } else {
            if (speechSynthesis.paused && speechUtterance) {
                speechSynthesis.resume();
            } else {
                const utterance = new SpeechSynthesisUtterance(analysisResults.read);
                utterance.onend = () => {
                    setIsSpeaking(false);
                    setSpeechUtterance(null);
                };
                setSpeechUtterance(utterance);
                speechSynthesis.speak(utterance);
            }
            setIsSpeaking(true);
        }
    };
    
    const handleStopTTS = () => {
        speechSynthesis.cancel();
        setIsSpeaking(false);
        setSpeechUtterance(null);
    };

    const handleCopyChat = (text: string) => {
        navigator.clipboard.writeText(text);
        addToast(t('toasts.copied'), 'success');
    };

    const handleEditChat = (text: string) => {
        if(chatInputRef.current) {
            chatInputRef.current.value = text;
            chatInputRef.current.focus();
        }
    };

    if (!file) {
        return (
            <div className="max-w-4xl mx-auto">
                {showTitle && <>
                    <h2 className="text-3xl font-bold text-center">{t('uploadslides.title')}</h2>
                    <p className="text-gray-500 mt-1 mb-8 text-center">{t('uploadslides.subtitle')}</p>
                </>}
                <div {...getRootProps()} className={`group p-12 border-2 border-dashed rounded-lg transition-colors ${isDragActive ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-gray-300 dark:border-gray-600'} ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-sky-400'}`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        <UploadIcon className="w-16 h-16 mb-4 transition-transform group-hover:scale-110" />
                        <p className="font-semibold text-lg">{isLoading ? loadingMessage : t('uploadslides.dropPrompt')}</p>
                        <p className="text-sm">{t('uploadslides.supportedFormats')}</p>
                    </div>
                </div>
                {error && <p className="mt-4 text-center text-red-500">{error}</p>}
            </div>
        );
    }
    
    const AnalysisHeader = () => {
        if (analysisMode === 'none' || analysisMode === 'chat') return null;
        return (
            <div className="flex items-center justify-between p-2 border-b dark:border-gray-700">
                <button onClick={() => handleAnalysis('none')} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back
                </button>
                <h3 className="text-lg font-bold capitalize">{t(`uploadslides.${analysisMode}`)}</h3>
                {analysisMode !== 'read' && (
                    <button onClick={() => handleSaveToNotes(analysisMode)} className="flex items-center gap-2 p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
                        <SaveIcon className="w-4 h-4"/>
                        {t('notes.saveToNotes')}
                    </button>
                )}
            </div>
        )
    };

    const MainContent = () => {
        if (isLoading && !analysisResults[analysisMode as 'summarize' | 'explain' | 'read']) {
            return <div className="flex items-center justify-center h-full"><div className="text-center p-8">{loadingMessage}</div></div>
        }
        if (analysisMode === 'none') {
            return (
                <div className="p-6">
                    <h3 className="text-xl font-bold mb-4">{t('uploadslides.whatToDo')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="group relative flex justify-end">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg max-w-xl">
                                        <p className="font-semibold text-blue-800 dark:text-blue-200">You</p>
                                        <FormattedContent content={turn.user} />
                                    </div>
                                     <div className="absolute left-0 top-1/2 -translate-y-1/2 flex gap-1 p-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleCopyChat(turn.user)} title={t('common.copy')} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><CopyIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleEditChat(turn.user)} title={t('common.edit')} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><PencilIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                {turn.blay && (
                                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg mt-2 max-w-xl">
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">Blay</p>
                                        <FormattedContent content={turn.blay} />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isStreaming && (
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg mt-2 max-w-xl inline-flex items-center">
                               <p className="font-semibold text-gray-800 dark:text-gray-200 mr-2">Blay</p>
                               <span className="text-sm text-gray-500 dark:text-gray-400 italic">{t('uploadslides.typing')}</span>
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleChatSubmit} className="p-4 border-t dark:border-gray-700">
                        <input
                            ref={chatInputRef}
                            type="text"
                            placeholder={t('uploadslides.chat.placeholder')}
                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                            disabled={isStreaming}
                        />
                    </form>
                </div>
            )
        }
        if (analysisMode === 'read') {
            return (
                <div className="flex flex-col h-full">
                    <div className="p-2 border-b dark:border-gray-700 flex items-center justify-center gap-4">
                        <button onClick={handlePlayPauseTTS} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                            {isSpeaking ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                        </button>
                        <button onClick={handleStopTTS} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                            <StopIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1">
                        <p className="whitespace-pre-wrap font-sans leading-relaxed">{analysisResults.read}</p>
                    </div>
                </div>
            )
        }
        return (
            <div className="p-4 overflow-y-auto">
                <FormattedContent content={analysisResults[analysisMode as 'summarize' | 'explain'] || ''} />
            </div>
        );
    }

    return (
      <div className={`max-w-7xl mx-auto ${isStudyModeView ? '' : 'mt-8'}`}>
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-lg border dark:border-gray-700 flex flex-col md:flex-row min-h-[70vh]">
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
                        {t('studyModal.startStudying')}
                    </button>
                )}
                <nav className="space-y-1">
                    <button onClick={() => handleAnalysis('none')} className={`w-full text-left p-2 rounded ${analysisMode === 'none' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.home')}</button>
                    <button onClick={() => handleAnalysis('summarize')} className={`w-full text-left p-2 rounded ${analysisMode === 'summarize' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.summarize')}</button>
                    <button onClick={() => handleAnalysis('explain')} className={`w-full text-left p-2 rounded ${analysisMode === 'explain' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.explain')}</button>
                    <button onClick={() => handleAnalysis('chat')} className={`w-full text-left p-2 rounded ${analysisMode === 'chat' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.chat')}</button>
                    <button onClick={() => handleAnalysis('read')} className={`w-full text-left p-2 rounded ${analysisMode === 'read' ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{t('uploadslides.read')}</button>
                </nav>
                 {!isStudyModeView && (
                    <button onClick={resetState} className="w-full mt-4 text-sm text-red-500 hover:underline">{t('uploadslides.changeFile')}</button>
                 )}
            </aside>
            <main className="w-full md:w-2/3 flex flex-col">
                <AnalysisHeader />
                <MainContent />
            </main>
        </div>
        {!isStudyModeView && <>
            <AdvancedStudySetupModal
                isOpen={advancedSetupOpen}
                onClose={() => setAdvancedSetupOpen(false)}
                onStart={(studyFile) => {
                    setAdvancedSetupOpen(false);
                    // The file in learningHubState might be different if user selected a note
                    setLearningHubState(prevState => ({ ...prevState, file: studyFile }));
                    setSessionSetup({ file: studyFile, modalOpen: true });
                }}
                learningHubFile={file}
                notes={notes}
            />
            <UntrackedStudySetupModal
                isOpen={sessionSetup.modalOpen}
                onClose={() => setSessionSetup({ file: null, modalOpen: false })}
                onStart={({ studyDuration, breakDuration, breakActivity, breakLink }) => {
                    if (!sessionSetup.file) return;

                    const now = Date.now();
                    const studyEndTime = now + studyDuration * 60 * 1000;
                    
                    let nextBreakSlot: PlanSlot | null = null;
                    if (breakDuration > 0) {
                        const breakStartTime = new Date(studyEndTime);
                        const breakEndTime = new Date(studyEndTime + breakDuration * 60 * 1000);
                        
                        nextBreakSlot = {
                            activity: breakActivity || 'Break',
                            // The times here are for the tracker to calculate duration.
                            // We use a simple 24h format that Date() can parse.
                            startTime: `${breakStartTime.getHours().toString().padStart(2, '0')}:${breakStartTime.getMinutes().toString().padStart(2, '0')}`,
                            endTime: `${breakEndTime.getHours().toString().padStart(2, '0')}:${breakEndTime.getMinutes().toString().padStart(2, '0')}`,
                            type: ActivityType.BREAK,
                            link: breakLink,
                        };
                    }
                    
                    const newSession: ActiveSession = {
                        startTime: now,
                        endTime: studyEndTime,
                        subject: sessionSetup.file.context,
                        type: 'study',
                        fromSlot: { 
                            activity: sessionSetup.file.name,
                            startTime: '',
                            endTime: '',
                            type: ActivityType.STUDY,
                        },
                        nextSlot: nextBreakSlot,
                        isUntracked: true,
                    };
                    
                    setActiveSession(newSession);
                    setSessionSetup({ file: null, modalOpen: false });
                }}
            />
        </>}
      </div>
    );
};

export default UploadSlides;