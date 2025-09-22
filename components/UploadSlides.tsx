
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import katex from 'katex';
import type { SmartPlan, ActiveSession, Toast, LearningHubState, UploadedFile, ImagePart, Note } from '../types.ts';
import { ActivityType } from '../types.ts';
import type { View } from '../App.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { getDocumentContext, isStudyMaterial, summarizeDocument, explainDocument, extractTextFromDocument, chatWithDocumentStream } from '../services/geminiService.ts';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import AdvancedStudySetupModal from './AdvancedStudySetupModal.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { StopIcon } from './icons/StopIcon.tsx';

interface UploadSlidesProps {
  smartPlan: SmartPlan | null;
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
}

const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-8 h-full">
        <div className="animate-spin w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full"></div>
        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{message}</p>
    </div>
);

const KatexRenderer: React.FC<{ content: string; displayMode: boolean }> = React.memo(({ content, displayMode }) => {
    try {
        const html = katex.renderToString(content, { throwOnError: false, displayMode });
        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
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
                const elements: JSX.Element[] = [];
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
                return elements;
            })}
        </div>
    );
});


const UploadSlides: React.FC<UploadSlidesProps> = ({
  smartPlan, activeSession, setActiveSession, setView, addToast,
  learningHubState, setLearningHubState, notes, setNotes,
  showTitle = true, isStudyModeView = false,
}) => {
  const { t } = useLanguage();
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isReading, setIsReading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0];
    if (!droppedFile) return;

    if (droppedFile.size > 25 * 1024 * 1024) { // 25MB limit
        addToast('File size must be under 25MB.', 'error');
        return;
    }

    setIsProcessing(true);
    setLoadingMessage(t('uploadslides.verifying'));

    try {
        const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(droppedFile);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const filePart: ImagePart = { inlineData: { data: base64String, mimeType: droppedFile.type } };

        if (!await isStudyMaterial(filePart)) {
            addToast(t('examprep.error.notStudyMaterial', { fileName: droppedFile.name }), 'error');
            setIsProcessing(false);
            return;
        }

        setLoadingMessage(t('uploadslides.extractingContext'));
        const context = await getDocumentContext(filePart);

        setFile({
            name: droppedFile.name,
            type: droppedFile.type,
            size: droppedFile.size,
            base64: base64String,
            context: context
        });
        setAnalysisMode('none');
        addToast(t('uploadslides.fileReady'), 'success');

    } catch (error: any) {
        addToast(error.message || 'Failed to process file.', 'error');
    } finally {
        setIsProcessing(false);
    }
  }, [addToast, setFile, t]);

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
          const stream = await chatWithDocumentStream(filePart, userMessage, chatHistory, file.context);
          
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
          setLearningHubState(prev => ({...prev, chatHistory: prev.chatHistory.slice(0, -1)}));
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
{/* FIX: Removed redundant check for 'read-focus'. The component logic already handles this case with an early return, making the check unnecessary and fixing a type comparison error. */}
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
            <div {...getRootProps()} className={`h-full flex flex-col items-center justify-center p-8 border-4 border-dashed rounded-2xl transition-colors ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer`}>
                <input {...getInputProps()} />
                <UploadIcon className="w-16 h-16 mb-4 text-gray-400" />
                <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">{t('uploadslides.dropzone')}</p>
                <p className="text-gray-500">PDF, PPTX, DOCX, JPG, PNG (Max 25MB)</p>
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
    </div>
  );
};

export default UploadSlides;
