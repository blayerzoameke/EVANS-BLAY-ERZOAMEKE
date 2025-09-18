import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';
import { analyzeDocument, isStudyMaterial, getDocumentContext, summarizeDocument, explainDocument, chatWithDocument } from '../services/geminiService';
import type { UploadedFile, UserDetails, Note, ImagePart, SmartPlan, ActiveSession, PlanSlot, DayPlan, Toast } from '../types.ts';
import { ActivityType } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import StudyModeSetupModal from './StudyModeSetupModal';
import SchedulePromptModal from './SchedulePromptModal.tsx';
import { View } from '../App.tsx';
import { PowerPointIcon } from './icons/PowerPointIcon.tsx';

interface UploadSlidesProps {
    userDetails?: UserDetails | null;
    notes?: Note[];
    setNotes?: (notes: Note[]) => void;
    file?: UploadedFile | null;
    setFile?: (file: UploadedFile | null) => void;
    smartPlan?: SmartPlan | null;
    setSmartPlan?: (plan: SmartPlan) => void;
    activeSession?: ActiveSession | null;
    setActiveSession?: (session: ActiveSession | null) => void;
    setIsStudyMode?: (isStudyMode: boolean) => void;
    setView?: (view: View) => void;
    addToast?: (message: string, type: Toast['type']) => void;
}

type StudyTool = 'summary' | 'explain' | 'read' | 'chat';

const UploadSlides: React.FC<UploadSlidesProps> = ({ 
    userDetails, notes, setNotes, 
    file: controlledFile, setFile: setControlledFile,
    smartPlan, setSmartPlan, activeSession, setActiveSession, setIsStudyMode, setView,
    addToast
}) => {
    const { t } = useLanguage();
    
    const [internalFile, setInternalFile] = useState<UploadedFile | null>(null);
    const isControlled = controlledFile !== undefined;
    const file = isControlled ? controlledFile : internalFile;
    const setFile = controlledFile !== undefined && setControlledFile !== undefined ? setControlledFile : setInternalFile;

    const [activeTool, setActiveTool] = useState<StudyTool | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [output, setOutput] = useState('');
    const [chatHistory, setChatHistory] = useState<{ user: string; blay: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isReading, setIsReading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sessionSlots, setSessionSlots] = useState<{ study: PlanSlot, break: PlanSlot | null } | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [showSchedulePrompt, setShowSchedulePrompt] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0];
        if (selectedFile) {
            setIsVerifying(true);
            setVerificationError(null);
            setFile(null); 

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const base64 = (e.target?.result as string).split(',')[1];
                    const filePart: ImagePart = { inlineData: { data: base64, mimeType: selectedFile.type } };

                    const isMaterial = await isStudyMaterial(filePart);

                    if (isMaterial) {
                        const context = await getDocumentContext(filePart);
                        setFile({
                            file: selectedFile, name: selectedFile.name, size: selectedFile.size,
                            type: selectedFile.type, base64: base64, context: context,
                        });
                    } else {
                        setVerificationError(t('uploadslides.verificationError'));
                    }
                } catch (error) {
                    console.error(error);
                    setVerificationError("An error occurred during verification.");
                } finally {
                    setIsVerifying(false);
                }
            };
            reader.readAsDataURL(selectedFile);
        }
    }, [setFile, t]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 
            'application/pdf': ['.pdf'], 
            'image/*': ['.jpeg', '.jpg', '.png'],
            'application/vnd.ms-powerpoint': ['.ppt'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
        },
        multiple: false,
    });
    
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);
    
    const timeToMinutes = (time: string): number => {
        const [timePart, ampm] = time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const handleToolClick = async (tool: StudyTool) => {
        if (!file) return;
        setActiveTool(tool);
        setOutput('');
        setChatHistory([]);
        setIsLoading(true);
        window.speechSynthesis.cancel();
        setIsReading(false);

        switch (tool) {
            case 'summary':
                setLoadingMessage(t('uploadslides.loading.summary'));
                break;
            case 'explain':
                setLoadingMessage(t('uploadslides.loading.explain'));
                break;
            case 'read':
                setLoadingMessage(t('uploadslides.loading.read'));
                break;
            case 'chat':
                setIsLoading(false); // Chat has its own loading indicator
                return;
        }
        
        const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
        const context = file.context || 'General';
        
        try {
            let result = '';
            switch (tool) {
                case 'summary':
                    result = await summarizeDocument(filePart, context);
                    break;
                case 'explain':
                    result = await explainDocument(filePart, context);
                    break;
                case 'read':
                    const prompt = 'Extract all the text from this document for text-to-speech.';
                    result = await analyzeDocument(prompt, filePart);
                    break;
            }
            setOutput(result);
            if (tool === 'read') {
                const utterance = new SpeechSynthesisUtterance(result);
                window.speechSynthesis.speak(utterance);
                setIsReading(true);
            }
        } catch (error) {
            console.error(error);
            setOutput('Sorry, I encountered an error. Please try again.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !file) return;
        
        if (chatInput.toLowerCase().includes('quiz')) {
            setChatHistory(prev => [...prev, {user: chatInput, blay: t('uploadslides.quizRedirect')}]);
            setChatInput('');
            return;
        }

        setIsLoading(true);
        setLoadingMessage(t('uploadslides.loading.chat'));
        const currentInput = chatInput;
        setChatInput('');
        
        try {
            const filePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const context = file.context || 'General';
            const result = await chatWithDocument(filePart, currentInput, context);
            setChatHistory(prev => [...prev, { user: currentInput, blay: result }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { user: currentInput, blay: 'Sorry, I ran into an error.' }]);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }
    
    const handleSaveNote = () => {
        if (!notes || !setNotes || !activeTool || !file) return;
        const newNote: Note = {
            id: Date.now().toString(),
            title: `${activeTool?.charAt(0).toUpperCase()}${activeTool?.slice(1)} of ${file?.name}`,
            content: output,
            subject: 'Generated Note',
            createdAt: new Date().toISOString(),
            isFavourite: false,
        };
        setNotes([newNote, ...notes]);
        if (addToast) {
            addToast(t('toasts.noteSaved'), 'success');
        } else {
            alert(t('uploadslides.noteSaved'));
        }
    }

    const handleLearnSlidesClick = () => {
        if (activeSession) {
            alert(t('uploadslides.sessionActiveAlert'));
            return;
        }
        
        const now = new Date();
        const currentDayName = now.toLocaleString('en-US', { weekday: 'long' });
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const todayPlan = smartPlan?.find(p => p.day === currentDayName);
        
        const currentStudySlotIndex = todayPlan ? todayPlan.slots.findIndex(slot => 
            slot.type === ActivityType.STUDY && timeToMinutes(slot.startTime) >= nowMinutes
        ) : -1;
        
        if (!smartPlan || currentStudySlotIndex === -1) {
            setShowSchedulePrompt(true);
            return;
        }
        
        const studySlot = todayPlan.slots[currentStudySlotIndex];
        const nextSlot = todayPlan.slots[currentStudySlotIndex + 1];
        const breakSlot = nextSlot?.type === ActivityType.BREAK ? nextSlot : null;
        
        setSessionSlots({ study: studySlot, break: breakSlot });
        setIsModalOpen(true);
    };

    const handleStartSession = ({ breakActivity, breakLink }: { breakActivity: string, breakLink: string }) => {
        if (!sessionSlots || !smartPlan || !setSmartPlan || !setActiveSession || !setIsStudyMode || !file) return;
        
        // 1. Update the smart plan if there's a break to configure
        if (sessionSlots.break && (breakActivity || breakLink)) {
            const newPlan = JSON.parse(JSON.stringify(smartPlan)) as SmartPlan;
            const now = new Date();
            const currentDayName = now.toLocaleString('en-US', { weekday: 'long' });
            const dayPlan = newPlan.find((p: DayPlan) => p.day === currentDayName);
            
            if (dayPlan) {
                const breakSlotInPlan = dayPlan.slots.find((s: PlanSlot) => s.startTime === sessionSlots.break?.startTime && s.endTime === sessionSlots.break?.endTime);
                if (breakSlotInPlan) {
                    breakSlotInPlan.activity = breakActivity || breakSlotInPlan.activity;
                    breakSlotInPlan.link = breakLink;
                }
            }
            setSmartPlan(newPlan);
        }

        // 2. Set the active session
        const { study: studySlot } = sessionSlots;
        const slotStartMinutes = timeToMinutes(studySlot.startTime);
        const slotEndMinutes = timeToMinutes(studySlot.endTime);
        
        const startTime = new Date();
        startTime.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);
        
        const endTime = new Date();
        endTime.setHours(Math.floor(slotEndMinutes / 60), slotEndMinutes % 60, 0, 0);

        setActiveSession({
            type: 'study',
            subject: studySlot.activity,
            startTime: startTime.getTime(),
            endTime: endTime.getTime(),
            fromSlot: studySlot,
            studyModeFile: file,
        });

        // 3. Activate study mode view
        setIsStudyMode(true);
        
        // 4. Close modal
        setIsModalOpen(false);
    };
    
    const handleContinueWithoutSchedule = () => {
        if (!file || !setActiveSession || !setIsStudyMode) return;
        setShowSchedulePrompt(false);
        
        const now = Date.now();
        const startTime = new Date(now);
        const endTime = new Date(now + 60 * 60 * 1000); // Default 1 hour session

        const dummySlot: PlanSlot = {
            activity: file.name,
            startTime: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            endTime: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: ActivityType.STUDY,
        };

        setActiveSession({
            type: 'study',
            subject: file.name,
            startTime: startTime.getTime(),
            endTime: endTime.getTime(),
            fromSlot: dummySlot,
            studyModeFile: file,
            isUntracked: true,
        });

        setIsStudyMode(true);
    };

    if (!file) {
        return (
             <div className="max-w-4xl mx-auto text-center">
                {!isControlled && (
                    <>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('uploadslides.title')}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 mb-8">{t('uploadslides.subtitle')}</p>
                    </>
                )}
                <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                    <input {...getInputProps()} />
                     {isVerifying ? (
                        <div>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
                            <p className="mt-4 font-semibold text-gray-600 dark:text-gray-300">{t('uploadslides.verifying')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                            <UploadIcon className="w-12 h-12 mb-4" />
                            <p className="font-semibold">{t('uploadslides.upload.prompt')}</p>
                            <p className="text-sm">{t('uploadslides.upload.supported')}</p>
                        </div>
                    )}
                </div>
                {verificationError && <p className="mt-4 text-red-500">{verificationError}</p>}
            </div>
        );
    }

    const isStudyModeActiveForThisFile = activeSession?.studyModeFile?.name === file.name;
    const isPowerPoint = file.type.includes('powerpoint') || file.type.includes('presentationml');

    const previewPane = (
        <div className="flex flex-col gap-4 h-full">
            {!isControlled && (
                 <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold truncate">{file.name}</h3>
                        {file.context && <p className="text-sm font-semibold text-blue-700 dark:text-blue-500 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full inline-block mt-1">{file.context}</p>}
                    </div>
                    <button onClick={() => setFile(null)} className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
            <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file.file)} alt="Preview" className="w-full h-full object-contain" />
                ) : isPowerPoint ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-gray-100 dark:bg-gray-700">
                        <PowerPointIcon className="w-24 h-24 text-orange-600 dark:text-orange-500" />
                        <p className="mt-4 font-semibold text-lg text-gray-700 dark:text-gray-200 truncate">{file.name}</p>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {isControlled ? t('uploadslides.powerpointStudyMode') : t('uploadslides.powerpointPreview')}
                        </p>
                    </div>
                ) : ( // Assume PDF
                    <iframe
                        src={`${URL.createObjectURL(file.file)}#toolbar=0&navpanes=0${isControlled ? '' : '&scrollbar=0'}`}
                        title={file.name}
                        className="w-full h-full border-0"
                    />
                )}
            </div>
        </div>
    );

    if (isControlled) {
        return (
            <div className="w-full h-full">
                {previewPane}
            </div>
        );
    }

    return (
        <>
        <div className="flex h-[calc(100vh-10rem)] max-w-7xl mx-auto gap-6">
            <div className="w-1/2">
                {previewPane}
            </div>

            <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
                 <div className="p-4 border-b dark:border-gray-700">
                    <p className="text-center font-semibold">{t('uploadslides.greeting', {name: userDetails?.name || 'there'})}</p>
                 </div>
                 <div className="p-4 flex gap-2 border-b dark:border-gray-700">
                     {(['summary', 'explain', 'read', 'chat'] as StudyTool[]).map(tool => (
                        <button key={tool} onClick={() => handleToolClick(tool)} className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${activeTool === tool ? 'bg-blue-700 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'}`}>
                            {t(`uploadslides.tool.${tool}` as any)}
                        </button>
                     ))}
                 </div>
                 <div className="flex-1 p-4 overflow-y-auto">
                    {isLoading && (
                        <div className="text-center flex flex-col items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto mb-3"></div>
                            <p className="font-semibold text-gray-600 dark:text-gray-300">{loadingMessage}</p>
                        </div>
                    )}
                    
                    {!isLoading && (activeTool === 'summary' || activeTool === 'explain') && output && (
                        <div className="prose dark:prose-invert max-w-none">
                            <p>{output}</p>
                        </div>
                    )}

                    {!isLoading && activeTool === 'read' && output && (
                        <div className="prose dark:prose-invert max-w-none">
                            <p>{output}</p>
                        </div>
                    )}
                    
                    {activeTool === 'chat' && (
                        <div className="space-y-4">
                             {chatHistory.map((chat, index) => (
                                <div key={index}>
                                    <p className="font-semibold text-gray-600 dark:text-gray-400">You:</p>
                                    <p className="mb-2">{chat.user}</p>
                                    <p className="font-semibold text-blue-700 dark:text-blue-500">Blay:</p>
                                    <p>{chat.blay}</p>
                                </div>
                             ))}
                             <div ref={chatEndRef} />
                        </div>
                    )}
                 </div>
                 
                {isStudyModeActiveForThisFile && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-center text-sm font-semibold">
                       {t('uploadslides.studyModeActive')}
                    </div>
                )}

                {!isControlled && setActiveSession && (
                    <div className="p-4 border-t dark:border-gray-700">
                        <button 
                            onClick={handleLearnSlidesClick}
                            className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                        >
                            {t('uploadslides.learnSlides')}
                        </button>
                    </div>
                )}
                 
                 {(activeTool === 'summary' || activeTool === 'explain') && output && addToast && (
                    <div className="p-2 border-t dark:border-gray-700">
                         <button onClick={handleSaveNote} className="w-full text-sm py-2 px-4 rounded-md bg-green-600 text-white hover:bg-green-700">{t('uploadslides.saveToNotes')}</button>
                    </div>
                 )}
                 
                 {activeTool === 'chat' && (
                    <form onSubmit={handleChatSubmit} className="p-4 border-t dark:border-gray-700 flex gap-2">
                        <input 
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            placeholder={t('uploadslides.chat.placeholder')}
                            className="flex-1 w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600"
                            disabled={isLoading}
                        />
                        <button type="submit" className="px-4 py-2 bg-blue-700 text-white rounded-md" disabled={isLoading}>{t('uploadslides.chat.send')}</button>
                    </form>
                 )}
            </div>
        </div>
        
        {sessionSlots && (
            <StudyModeSetupModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStart={handleStartSession}
                studySlot={sessionSlots.study}
                breakSlot={sessionSlots.break}
            />
        )}
        {showSchedulePrompt && setView && (
            <SchedulePromptModal
                isOpen={showSchedulePrompt}
                onClose={() => setShowSchedulePrompt(false)}
                onCreateSchedule={() => {
                    setView('dashboard');
                    setShowSchedulePrompt(false);
                }}
                onContinue={handleContinueWithoutSchedule}
            />
        )}
        </>
    );
};

export default UploadSlides;