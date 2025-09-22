import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDropzone } from 'react-dropzone';
import { generateQuiz, extractTextFromDocument, isStudyMaterial, solveProblem, isImageAProblem } from '../services/geminiService.ts';
import type { Toast, QuizQuestion, AnswerFeedback, QuizSummary, ImagePart, GenerationState, QuizState, Note, ExamPrepState } from '../types.ts';
import { QuizType } from '../types.ts';
import type { View } from '../App.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';
import { ArrowRightIcon } from './icons/ArrowRightIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { DocumentIcon } from './icons/DocumentIcon.tsx';
import { CameraIcon } from './icons/CameraIcon.tsx';
import { MicrophoneIcon } from './icons/MicrophoneIcon.tsx';
import katex from 'katex';
import CameraCaptureModal from './CameraCaptureModal.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { CopyIcon } from './icons/CopyIcon.tsx';

interface ExamPrepProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
    generationState: GenerationState;
    setGenerationState: React.Dispatch<React.SetStateAction<GenerationState>>;
    quizState: QuizState;
    setQuizState: React.Dispatch<React.SetStateAction<QuizState>>;
    notes: Note[];
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
    examPrepState: ExamPrepState;
    setExamPrepState: React.Dispatch<React.SetStateAction<ExamPrepState>>;
}

const LoadingOverlay: React.FC<{ isLoading: boolean; message: string }> = ({ isLoading, message }) => {
    if (!isLoading) return null;
    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex flex-col items-center justify-center z-30 rounded-2xl backdrop-blur-sm">
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
        return <code>{content}</code>;
    }
});

const GraphRenderer: React.FC<{ chartConfig: any }> = ({ chartConfig }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<any | null>(null); // Using any for Chart.js instance

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }

            const Chart = (window as any).Chart;
            if (Chart) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    try {
                        chartRef.current = new Chart(ctx, chartConfig);
                    } catch (e) {
                        console.error("Failed to create chart from config:", chartConfig, e);
                    }
                }
            } else {
                console.error("Chart.js not found on window object.");
            }
        }
        
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [chartConfig]);

    return <canvas ref={canvasRef} className="max-w-full" aria-label="Generated graph"></canvas>;
};


const FormattedContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    let chartConfig = null;
    try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && parsed.type && parsed.data && parsed.data.datasets) {
            chartConfig = parsed;
        }
    } catch (e) {
        // Not a JSON, or not a valid chart config, proceed as text
    }

    if (chartConfig) {
        return (
            <div className="my-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <GraphRenderer chartConfig={chartConfig} />
            </div>
        );
    }

    const renderInlineElements = (line: string) => {
        const inlineRegex = /(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\*\*.*?\*\*)/g;
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
                    } else if (line.trim() !== '') {
                        flushList();
                        elements.push(<p key={elements.length} className="my-2">{renderInlineElements(line)}</p>);
                    } else {
                        flushList();
                    }
                });

                flushList();
                return elements;
            })}
        </div>
    );
});

const ExamPrep: React.FC<ExamPrepProps> = ({ 
    addToast, 
    setView,
    generationState,
    setGenerationState,
    quizState,
    setQuizState,
    notes,
    setNotes,
    examPrepState,
    setExamPrepState,
}) => {
    const { t } = useLanguage();
    const recognitionRef = useRef<any>(null);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    
    const { mode, topic, numQuestions, quizType, uploadedFiles, focusArea, isVerifying, questionImage, questionText, solution, outputFormat, programmingLanguage } = examPrepState;
    const { quiz, currentQuestionIndex, userAnswers, feedback, summary } = quizState;

    const updateState = <K extends keyof ExamPrepState>(key: K, value: ExamPrepState[K]) => {
        setExamPrepState(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        // Cleanup speech recognition on component unmount or mode change
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [mode]);
    
    const handleSolveQuestion = async () => {
        if (!questionText.trim() && !questionImage) {
            addToast('Please provide a question to solve.', 'error');
            return;
        }

        setGenerationState({ isLoading: true, message: 'Solving problem...', error: null, source: 'solve' });
        updateState('solution', null);
        
        let imagePart: ImagePart | null = null;
        if (questionImage) {
            const base64String = questionImage.split(',')[1];
            const mimeType = questionImage.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
            imagePart = { inlineData: { data: base64String, mimeType } };
        }

        try {
            const result = await solveProblem(questionText, imagePart, outputFormat, programmingLanguage);
            updateState('solution', result);
        } catch (error: any) {
            addToast(error.message || "An error occurred while solving the problem.", 'error');
        } finally {
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    };
    
    const clearSolution = () => {
        setExamPrepState(prev => ({
            ...prev,
            questionImage: null,
            questionText: '',
            solution: null,
        }));
    };

    const onQuizFileDrop = useCallback(async (acceptedFiles: File[]) => {
        const files = acceptedFiles;
        if (files.length === 0) return;

        updateState('isVerifying', true);
// FIX: Changed translation key from 'examPrep.verifying' to 'examprep.verifying' to match key definition.
        addToast(t('examprep.verifying'), 'info');

        const validFiles: File[] = [];
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                addToast(`File "${file.name}" is too large (> 10MB).`, 'warning');
                continue;
            }

            try {
                const base64String = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                });

                const filePart: ImagePart = { inlineData: { data: base64String, mimeType: file.type } };
                const isMaterial = await isStudyMaterial(filePart);

                if (isMaterial) {
                    validFiles.push(file);
                } else {
// FIX: Changed translation key from 'examPrep.error.notStudyMaterial' to 'examprep.error.notStudyMaterial' to match key definition.
                    addToast(t('examprep.error.notStudyMaterial', { fileName: file.name }), 'error');
                }
            } catch (e) {
                addToast(`Could not process "${file.name}". It might be corrupted.`, 'error');
            }
        }

        updateState('uploadedFiles', [...uploadedFiles, ...validFiles]);
        if (validFiles.length > 0) {
            addToast(`${validFiles.length} valid file(s) added.`, 'success');
        }
        updateState('isVerifying', false);
    }, [addToast, t, uploadedFiles, updateState]);

    const { getRootProps: getQuizRootProps, getInputProps: getQuizInputProps, isDragActive: isQuizDragActive } = useDropzone({
        onDrop: onQuizFileDrop,
        multiple: true,
        disabled: isVerifying,
    });
    
    const onProblemImageDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                addToast('Image must be less than 5MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const imageDataUrl = reader.result as string;
                const base64String = imageDataUrl.split(',')[1];
                const mimeType = file.type;
                const imagePart: ImagePart = { inlineData: { data: base64String, mimeType } };

                addToast('Verifying image...', 'info');
                try {
                    const isProblem = await isImageAProblem(imagePart);
                    if (isProblem) {
                        updateState('questionImage', imageDataUrl);
                        addToast('Image is valid and has been attached.', 'success');
                    } else {
                        addToast('This image does not appear to contain a solvable problem.', 'error');
                    }
                } catch (e) {
                    addToast('Failed to verify the image.', 'error');
                }
            };
        }
    }, [addToast, updateState]);

    const { getRootProps: getProblemImageRootProps, getInputProps: getProblemImageInputProps, isDragActive: isProblemImageDragActive } = useDropzone({
        onDrop: onProblemImageDrop,
        accept: { 'image/*': [] },
        multiple: false
    });

    const handleCameraClick = () => setIsCameraModalOpen(true);

    const handleMicClick = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addToast('Speech recognition is not supported in your browser.', 'error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; 

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            if (recognitionRef.current) recognitionRef.current = null;
        };
        recognition.onerror = (event: any) => {
            addToast(`Speech recognition error: ${event.error}`, 'error');
            setIsListening(false);
        };
        
        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript) updateState('questionText', (examPrepState.questionText.trim() ? `${examPrepState.questionText} ${finalTranscript.trim()}` : finalTranscript.trim()).trim());
        };

        recognition.start();
        recognitionRef.current = recognition;
    };
    
    const handleCapture = async (imageDataUrl: string) => {
        setIsCameraModalOpen(false);
        const base64String = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
        const imagePart: ImagePart = { inlineData: { data: base64String, mimeType } };

        addToast('Verifying image...', 'info');
        try {
            const isProblem = await isImageAProblem(imagePart);
            if (isProblem) {
                updateState('questionImage', imageDataUrl);
                addToast('Image captured and attached.', 'success');
            } else {
                addToast('The captured image does not appear to contain a solvable problem.', 'error');
            }
        } catch (e) {
            addToast('Failed to verify the captured image.', 'error');
        }
    };

    const removeFile = (index: number) => {
        updateState('uploadedFiles', uploadedFiles.filter((_, i) => i !== index));
    };

    const handleGenerateQuiz = async () => {
        if (uploadedFiles.length === 0) {
            addToast('Please upload at least one study material file.', 'error');
            return;
        }
        setQuizState({ quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });

        try {
// FIX: Changed translation key from 'examPrep.extracting' to 'examprep.extracting' to match key definition.
            setGenerationState({ isLoading: true, message: t('examprep.extracting'), error: null, source: 'quiz' });
            const fileContents = await Promise.all(
                uploadedFiles.map(file => 
                    new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onloadend = async () => {
                            try {
                                const base64String = (reader.result as string).split(',')[1];
                                const filePart: ImagePart = { inlineData: { data: base64String, mimeType: file.type } };
                                resolve(await extractTextFromDocument(filePart));
                            } catch (e) { reject(e); }
                        };
                        reader.onerror = (error) => reject(error);
                    })
                )
            );
            
            const contentForQuiz = fileContents.join('\n\n---\n\n');
            if (!contentForQuiz.trim()) {
                addToast('Could not extract text from uploaded files. They might be empty or corrupted.', 'error');
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
                return;
            }

// FIX: Changed translation key from 'examPrep.creatingQuiz' to 'examprep.creatingQuiz' to match key definition.
            setGenerationState({ isLoading: true, message: t('examprep.creatingQuiz'), error: null, source: 'quiz' });
            const questions = await generateQuiz(contentForQuiz, numQuestions, quizType, focusArea);
            if (questions && questions.length > 0) {
                setQuizState(prev => ({ ...prev, quiz: questions, userAnswers: new Array(questions.length).fill(null) }));
            } else {
// FIX: Changed translation key from 'examPrep.error.noQuestions' to 'examprep.error.noQuestions' to match key definition.
                addToast(t('examprep.error.noQuestions'), 'warning');
            }
        } catch (error: any) {
// FIX: Changed translation key from 'examPrep.error.generic' to 'examprep.error.generic' to match key definition.
            addToast(error.message || t('examprep.error.generic'), 'error');
        } finally {
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    };

    const handleAnswerSubmit = (answer: string) => {
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = answer;
        const currentQuestion = quiz[currentQuestionIndex];
        const isCorrect = answer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
        setQuizState(prev => ({ ...prev, userAnswers: newAnswers, feedback: { isCorrect, explanation: currentQuestion.explanation } }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quiz.length - 1) {
            setQuizState(prev => ({ ...prev, feedback: null, currentQuestionIndex: prev.currentQuestionIndex + 1 }));
        } else {
            calculateSummary();
        }
    };

    const calculateSummary = () => {
        const score = userAnswers.reduce((correctCount, answer, index) => (answer?.toLowerCase() === quiz[index].correctAnswer.toLowerCase() ? correctCount + 1 : correctCount), 0);
        const topicCounts: { [topic: string]: { correct: number, total: number } } = {};
        quiz.forEach((q, i) => {
            if (!topicCounts[q.topic]) topicCounts[q.topic] = { correct: 0, total: 0 };
            topicCounts[q.topic].total++;
            if (userAnswers[i]?.toLowerCase() === q.correctAnswer.toLowerCase()) topicCounts[q.topic].correct++;
        });
        const strengths = Object.entries(topicCounts).filter(([, v]) => v.correct / v.total >= 0.7).map(([k]) => k);
        const weaknesses = Object.entries(topicCounts).filter(([, v]) => v.correct / v.total < 0.7).map(([k]) => k);
        setQuizState(prev => ({ ...prev, feedback: null, summary: { score: (score / quiz.length) * 100, strengths, weaknesses, recommendations: [`Focus on reviewing these topics: ${weaknesses.join(', ')}`] } }));
    };

    const handleChangeSettings = () => setQuizState(prev => ({ ...prev, quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null }));
    const handleStartNewQuiz = () => {
        handleChangeSettings();
        setExamPrepState(prev => ({ ...prev, uploadedFiles: [], focusArea: '' }));
    };
    
    const handleCopyToClipboard = () => {
        if (!solution) return;
// FIX: Changed translation key from 'examPrep.copySolution' to 'examprep.copySolution' to match key definition.
        navigator.clipboard.writeText(solution).then(() => addToast(t('toasts.solutionCopied'), 'success')).catch(() => addToast('Failed to copy solution.', 'error'));
    };
    const handleSaveToNotes = () => {
        if (!solution) return;
        const noteTitle = `Problem Solution: ${questionText.substring(0, 40)}${questionText.length > 40 ? '...' : ''}` || 'Problem Solution';
        const newNote: Note = { id: Date.now().toString(), title: noteTitle, content: `**Question:**\n${questionText}\n\n**Solution:**\n${solution}`, subject: 'Problem Solver', createdAt: new Date().toISOString(), isFavourite: false };
        setNotes(prevNotes => [newNote, ...prevNotes]);
// FIX: Changed translation key from 'examPrep.saveToNotes' to 'examprep.saveToNotes' to match key definition.
        addToast(t('toasts.solutionSaved'), 'success');
    };
    
    if (summary) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 text-gray-800 dark:text-white">
                    <h2 className="text-4xl font-bold text-center mb-6">Quiz Complete!</h2>
                    <div className="text-center mb-8">
                        <p className="text-7xl font-bold mb-4 text-primary">{summary.score.toFixed(0)}%</p>
                        <div className="w-32 h-2 bg-primary/20 rounded-full mx-auto"><div className="h-2 bg-primary rounded-full transition-all duration-1000" style={{ width: `${summary.score}%` }}></div></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                            <h3 className="font-bold text-xl mb-3 text-green-600 dark:text-green-400">Strengths</h3>
                            <p className="text-gray-700 dark:text-gray-300">{summary.strengths.join(', ') || 'Keep practicing to identify your strengths!'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                            <h3 className="font-bold text-xl mb-3 text-orange-600 dark:text-orange-400">Areas to Improve</h3>
                            <p className="text-gray-700 dark:text-gray-300">{summary.weaknesses.join(', ') || 'No major weaknesses identified.'}</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl mb-8">
                        <h3 className="font-bold text-xl mb-3 text-primary dark:text-primary-light">Recommendations</h3>
                        <p className="text-gray-700 dark:text-gray-300">{summary.recommendations.join(', ')}</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                        <button onClick={handleChangeSettings} className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-lg rounded-xl shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">Change Quiz Settings</button>
                        <button onClick={handleStartNewQuiz} className="w-full py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark transition-all">Start a New Quiz</button>
                    </div>
                </div>
            </div>
        );
    }
    
    if (quiz.length > 0) {
        const currentQuestion = quiz[currentQuestionIndex];
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-gray-800 dark:text-white">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-lg font-bold">Question {currentQuestionIndex + 1} of {quiz.length}</span>
                        <span className="bg-primary/10 text-primary-dark dark:bg-primary/20 dark:text-primary-light px-4 py-2 rounded-full text-sm font-semibold">{currentQuestion.topic}</span>
                    </div>
                    <div className="w-full bg-primary/20 rounded-full h-2 mb-8"><div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div></div>
                    <h3 className="text-2xl font-bold mb-8">{currentQuestion.question}</h3>
                    <div className="space-y-4 mb-8">
                        {currentQuestion.options ? (
                            currentQuestion.options.map((opt, i) => (
                                <button key={i} onClick={() => handleAnswerSubmit(opt)} disabled={!!feedback} className={`w-full text-left p-4 rounded-xl transition-all duration-300 ${ feedback && opt === currentQuestion.correctAnswer ? 'bg-green-500 text-white shadow-lg' : feedback && opt === userAnswers[currentQuestionIndex] && !feedback.isCorrect ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                    <span className="font-medium">{opt}</span>
                                </button>
                            ))
                        ) : (
                            <textarea rows={4} onBlur={(e) => handleAnswerSubmit(e.target.value)} disabled={!!feedback} className="w-full p-4 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" placeholder="Type your answer here..." />
                        )}
                    </div>
                    {feedback && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                            <div className="flex items-center gap-3 mb-4">{feedback.isCorrect ? <CheckIcon className="w-8 h-8 text-green-500" /> : <CloseIcon className="w-8 h-8 text-red-500" />}<h4 className="font-bold text-2xl">{feedback.isCorrect ? 'Correct!' : 'Incorrect'}</h4></div>
                            <p className="text-gray-700 dark:text-gray-300 mb-6 text-lg">{feedback.explanation}</p>
                            <button onClick={handleNextQuestion} className="w-full py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark transition-all">{currentQuestionIndex < quiz.length - 1 ? 'Next Question' : 'View Results'}</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const buttonGroupClasses = `flex-1 group p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/50 border-gray-300 dark:border-gray-600 text-center`;
    
    return (
        <div className="max-w-4xl mx-auto space-y-8 relative">
            <LoadingOverlay isLoading={generationState.isLoading && (generationState.source === 'quiz' || generationState.source === 'solve')} message={generationState.message} />
            <div className="text-center">
                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-3">{t('examprep.title')}</h2>
            </div>
            <div className="flex justify-center border-b dark:border-gray-700 mb-6">
                <button onClick={() => updateState('mode', 'quiz')} className={`px-6 py-3 font-semibold transition-colors ${mode === 'quiz' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Quiz Generation</button>
                <button onClick={() => updateState('mode', 'solve')} className={`px-6 py-3 font-semibold transition-colors ${mode === 'solve' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Problem Solver</button>
            </div>

            {mode === 'quiz' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">{t('examprep.subtitleV2')}</h3>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleStartNewQuiz(); }} className="text-sm text-primary dark:text-primary-light hover:underline">Start Over</a>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Blay is your personal study assistant. Upload your materials, and I'll create a quiz to help you prepare.</p>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-lg font-semibold mb-3">1. Upload Your Study Materials</label>
                            <div {...getQuizRootProps()} className={`group p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isVerifying ? 'opacity-50' : 'hover:border-primary'} border-gray-300 dark:border-gray-600 text-center ${isQuizDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : ''} hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20`}>
                                <input {...getQuizInputProps()} />
                                <UploadIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Click to select files</p>
                                <p className="text-xs text-gray-500">PDF, PPTX, JPG, PNG (Max 10MB each)</p>
                            </div>
                            <div className="mt-4 space-y-2">
                                {uploadedFiles.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                        <div className="flex items-center gap-2 overflow-hidden"><DocumentIcon className="w-5 h-5 text-gray-500 shrink-0" /><span className="text-sm font-medium truncate" title={file.name}>{file.name}</span></div>
                                        <button onClick={() => removeFile(index)} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><CloseIcon className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="focusArea" className="block text-lg font-semibold mb-3">2. Focus Area (Optional)</label>
                            <input id="focusArea" type="text" value={focusArea} onChange={e => updateState('focusArea', e.target.value)} placeholder="e.g., 'Chapter 3, pages 20-25' or 'Key formulas'" className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/20 dark:focus:ring-primary/30" />
                        </div>
                        <div>
                            <label className="block text-lg font-semibold mb-3">3. Customize Quiz</label>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div><label htmlFor="numQuestions" className="block font-medium mb-1">Number of Questions</label><input id="numQuestions" type="number" value={numQuestions} onChange={e => updateState('numQuestions', parseInt(e.target.value, 10))} min="1" max="20" className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700" /></div>
                                <div><label htmlFor="quizType" className="block font-medium mb-1">Quiz Type</label><select id="quizType" value={quizType} onChange={e => updateState('quizType', e.target.value as QuizType)} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">{Object.values(QuizType).map(type => (<option key={type} value={type}>{type}</option>))}</select></div>
                            </div>
                        </div>
                        <div className="mt-8"><button onClick={handleGenerateQuiz} disabled={generationState.isLoading || isVerifying} className="w-full py-4 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed transition-all">{isVerifying ? 'Verifying Files...' : 'Generate Quiz'}</button></div>
                    </div>
                </div>
            )}
            {mode === 'solve' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                    <div className="flex justify-between items-center"><h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">Problem Solver</h3><a href="#" onClick={(e) => { e.preventDefault(); clearSolution(); }} className="text-sm text-primary dark:text-primary-light hover:underline">Clear</a></div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Stuck on a problem? Type it, upload a picture, or even say it out loud.</p>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="questionText" className="block text-lg font-semibold mb-3">1. Your Question</label>
                            <textarea id="questionText" value={questionText} onChange={e => updateState('questionText', e.target.value)} placeholder="Type your question here..." rows={4} className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/20 dark:focus:ring-primary/30" />
                            <div className="flex items-center gap-4 mt-2">
                                <div {...getProblemImageRootProps()} className={`${buttonGroupClasses} ${isProblemImageDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : ''}`}><input {...getProblemImageInputProps()} /><UploadIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Upload Image</p></div>
                                <button onClick={handleCameraClick} className={buttonGroupClasses}><CameraIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Use Camera</p></button>
                                <button onClick={handleMicClick} className={`${buttonGroupClasses} ${isListening ? 'border-red-500 bg-red-50 dark:bg-red-900/50' : ''}`}><MicrophoneIcon className={`w-6 h-6 mx-auto mb-1 transition-colors ${isListening ? 'text-red-500' : 'text-gray-400'}`} /><p className={`text-sm font-semibold transition-colors ${isListening ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{isListening ? 'Stop' : 'Use Mic'}</p></button>
                            </div>
                             {questionImage && <div className="mt-4"><img src={questionImage} alt="Question preview" className="max-h-40 mx-auto rounded-lg shadow-md" /></div>}
                        </div>
                        <div>
                            <label className="block text-lg font-semibold mb-3">2. Customize Output</label>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="outputFormat" className="block font-medium mb-1">Solution Format</label>
                                    <select id="outputFormat" value={outputFormat} onChange={e => updateState('outputFormat', e.target.value as any)} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">
                                        <option value="steps">Step-by-step</option>
                                        <option value="latex">LaTeX</option>
                                        <option value="code">Code</option>
                                        <option value="graph">Graph</option>
                                    </select>
                                </div>
                                {outputFormat === 'code' && (<div><label htmlFor="programmingLanguage" className="block font-medium mb-1">Language</label><select id="programmingLanguage" value={programmingLanguage} onChange={e => updateState('programmingLanguage', e.target.value)} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"><option value="python">Python</option><option value="javascript">JavaScript</option><option value="java">Java</option><option value="cpp">C++</option><option value="csharp">C#</option></select></div>)}
                            </div>
                        </div>
                        <div className="mt-8"><button onClick={handleSolveQuestion} disabled={generationState.isLoading} className="w-full py-4 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed transition-all">Solve Problem</button></div>
                        {solution && (
                            <div className="mt-8 pt-6 border-t dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-2xl font-bold">Solution</h3>
                                    <div className="flex gap-2">
                                        <button onClick={handleCopyToClipboard} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><CopyIcon className="w-4 h-4" /> {t('examprep.copySolution')}</button>
                                        <button onClick={handleSaveToNotes} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><SaveIcon className="w-4 h-4" /> {t('examprep.saveToNotes')}</button>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"><FormattedContent content={solution} /></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
             <CameraCaptureModal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={handleCapture} />
        </div>
    );
};

export default ExamPrep;