import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDropzone } from 'react-dropzone';
import { generateQuiz, extractTextFromDocument, isStudyMaterial, solveProblem, isImageAProblem } from '../services/geminiService';
import type { Toast, QuizQuestion, AnswerFeedback, QuizSummary, ImagePart, GenerationState, QuizState, Note, ExamPrepState, View } from '../types';
import { QuizType } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';
import { UploadIcon } from './icons/UploadIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { CameraIcon } from './icons/CameraIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import katex from 'katex';
import CameraCaptureModal from './CameraCaptureModal';
import { SaveIcon } from './icons/SaveIcon';
import { CopyIcon } from './icons/CopyIcon';
import { AdvancedGraphPlotter, type GraphConfig } from '../utils/AdvancedGraphPlotter';
import { processAndResizeImage } from '../lib/utils';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ExamPrepProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
    generationState: GenerationState;
    setGenerationState: React.Dispatch<React.SetStateAction<GenerationState>>;
    quizState: QuizState;
    setQuizState: React.Dispatch<React.SetStateAction<QuizState>>;
    notes: Note[];
    setNotes: (notes: Note[]) => void;
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

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <button onClick={handleCopy} className="p-1.5 bg-gray-700/50 text-gray-300 rounded-md hover:bg-gray-600/70 hover:text-white transition-colors">
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

const GraphRenderer: React.FC<{ chartConfig: any; canvasRef: React.RefObject<HTMLCanvasElement | null> }> = ({ chartConfig, canvasRef }) => {
    const { t } = useLanguage();
    const chartInstanceRef = useRef<any | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }

            const Chart = (window as any).Chart;
            if (Chart) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    try {
                        const isDarkMode = document.documentElement.classList.contains('dark');
                        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                        const textColor = isDarkMode ? '#e5e7eb' : '#374151';
                        const axisLineColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
                        const zeroLineColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';

                        const defaultOptions = {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: { color: textColor, font: { size: 14 } }
                                },
                                tooltip: {
                                    mode: 'index',
                                    intersect: false,
                                    backgroundColor: isDarkMode ? '#374151' : '#fff',
                                    titleColor: isDarkMode ? '#fff' : '#333',
                                    bodyColor: isDarkMode ? '#ddd' : '#666',
                                    borderColor: gridColor,
                                    borderWidth: 1,
                                },
                            },
                            scales: {
                                x: {
                                    type: 'linear',
                                    grid: {
                                        color: (context: any) => context.tick.value === 0 ? zeroLineColor : gridColor,
                                        lineWidth: (context: any) => context.tick.value === 0 ? 2 : 1,
                                    },
                                    border: {
                                        display: true,
                                        color: axisLineColor,
                                        width: 2,
                                    },
                                    ticks: { color: textColor },
                                    title: {
                                        display: true,
                                        text: 'X-Axis',
                                        color: textColor,
                                        font: { size: 14 }
                                    }
                                },
                                y: {
                                    grid: {
                                        color: (context: any) => context.tick.value === 0 ? zeroLineColor : gridColor,
                                        lineWidth: (context: any) => context.tick.value === 0 ? 2 : 1,
                                    },
                                    border: {
                                        display: true,
                                        color: axisLineColor,
                                        width: 2,
                                    },
                                    ticks: { color: textColor },
                                    title: {
                                        display: true,
                                        text: 'Y-Axis',
                                        color: textColor,
                                        font: { size: 14 }
                                    }
                                },
                            },
                            elements: {
                                line: { tension: 0.4, borderWidth: 3 },
                                point: { radius: 0, hoverRadius: 6 },
                            },
                            animation: { duration: 1000, easing: 'easeInOutQuad' },
                        };

                        const finalConfig = {
                            ...chartConfig,
                            options: {
                                ...defaultOptions,
                                ...chartConfig.options, // AI can override some, but our base styles will apply
                                plugins: { ...defaultOptions.plugins, ...chartConfig.options?.plugins },
                                scales: { ...defaultOptions.scales, ...chartConfig.options?.scales },
                                elements: { ...defaultOptions.elements, ...chartConfig.options?.elements },
                            }
                        };
                        
                        chartInstanceRef.current = new Chart(ctx, finalConfig);
                    } catch (e) {
                        console.error("Failed to create chart from config:", chartConfig, e);
                    }
                }
            } else {
                console.error("Chart.js not found on window object.");
            }
        }
        
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [chartConfig, canvasRef]);

    return (
        <div className="relative h-96 w-full">
             <canvas ref={canvasRef} aria-label={t('examprep.solver.graphAriaLabel')}></canvas>
        </div>
    );
};


const FormattedContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    const renderInlineElements = (text: string) => {
        const inlineRegex = /(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\*\*.*?\*\*)|(`.*?`)/g;
        const parts = text.split(inlineRegex).filter(Boolean);
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
                        <div key={index} className="relative bg-black/70 text-gray-100 rounded-xl my-4 border border-gray-700 shadow-lg">
                            <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700 rounded-t-xl">
                                <span className="text-xs font-mono text-gray-400 capitalize">{lang || 'code'}</span>
                                <CopyButton textToCopy={code} />
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
                        const paragraphText = paragraphLines.join('\n');
                        elements.push(<p key={`p-${elements.length}`} className="my-2">{renderInlineElements(paragraphText)}</p>);
                        paragraphLines = [];
                    }
                };

                const flushList = () => {
                    flushParagraph();
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
                        flushParagraph();
                        flushList();
                        elements.push(<h4 key={elements.length} className="font-bold text-lg mt-4 mb-2">{renderInlineElements(line.replace(/^###\s/, ''))}</h4>);
                    } else if (line.match(/^##\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h3 key={elements.length} className="font-bold text-xl mt-5 mb-2">{renderInlineElements(line.replace(/^##\s/, ''))}</h3>);
                    } else if (line.match(/^#\s/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<h2 key={elements.length} className="font-bold text-2xl mt-6 mb-3">{renderInlineElements(line.replace(/^#\s/, ''))}</h2>);
                    } else if (line.match(/^\s*---\s*$/)) {
                        flushParagraph();
                        flushList();
                        elements.push(<hr key={elements.length} className="my-4" />);
                    } else if (line.match(/^\s*(\*|-)\s/)) {
                        flushParagraph();
                        listItems.push(line.replace(/^\s*(\*|-)\s/, ''));
                        inList = true;
                    } else if (line.trim() !== '') {
                        if (inList) flushList();
                        paragraphLines.push(line);
                    } else { // Empty line
                        flushParagraph();
                        flushList();
                    }
                });

                flushParagraph();
                flushList();
                
                return <React.Fragment key={index}>{elements}</React.Fragment>;
            })}
        </div>
    );
});

const QuizRunner: React.FC<{
    quiz: QuizQuestion[];
    currentQuestionIndex: number;
    feedback: AnswerFeedback | null;
    onAnswerSubmit: (answer: string) => void;
    onNextQuestion: () => void;
}> = ({ quiz, currentQuestionIndex, feedback, onAnswerSubmit, onNextQuestion }) => {
    const { t } = useLanguage();
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const currentQuestion = quiz[currentQuestionIndex];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAnswer.trim()) {
            onAnswerSubmit(selectedAnswer);
        }
    };

    useEffect(() => {
        setSelectedAnswer(''); // Reset when question changes
    }, [currentQuestionIndex]);

    const isMCQ = !!currentQuestion.options && currentQuestion.options.length > 0;
    const inputClasses = "block w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-500 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 text-white dark:text-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('examprep.quiz.questionOf', { current: currentQuestionIndex + 1, total: quiz.length })}</p>
                <div className="prose-lg dark:prose-invert max-w-none mb-6">
                    <FormattedContent content={currentQuestion.question} />
                </div>
                
                <form onSubmit={handleSubmit}>
                    {isMCQ ? (
                        <div className="space-y-3">
                            {currentQuestion.options?.map((option, index) => (
                                <label key={index} className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                                    selectedAnswer === option ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}>
                                    <input 
                                        type="radio"
                                        name="quiz-option"
                                        value={option}
                                        checked={selectedAnswer === option}
                                        onChange={(e) => setSelectedAnswer(e.target.value)}
                                        disabled={!!feedback}
                                        className="h-4 w-4 text-primary focus:ring-primary"
                                    />
                                    <span className="ml-3 prose-lg dark:prose-invert max-w-none"><FormattedContent content={option} /></span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <textarea 
                            value={selectedAnswer}
                            onChange={(e) => setSelectedAnswer(e.target.value)}
                            disabled={!!feedback}
                            placeholder={t('examprep.quiz.answerPlaceholder')}
                            rows={4}
                            className={inputClasses}
                        />
                    )}
                    
                    {!feedback && (
                        <button type="submit" disabled={!selectedAnswer.trim()} className="mt-6 w-full py-3 bg-primary text-primary-text font-bold rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 transition-all">
                            <CheckIcon className="inline w-5 h-5 mr-2" /> Submit Answer
                        </button>
                    )}
                </form>

                {feedback && (
                    <div className={`mt-6 p-4 rounded-lg border-l-4 ${feedback.isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'}`}>
                        <h4 className={`font-bold text-lg ${feedback.isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                            {feedback.isCorrect ? t('examprep.quiz.correct') : t('examprep.quiz.incorrect')}
                        </h4>
                        {!feedback.isCorrect && <p className="text-sm prose-lg dark:prose-invert max-w-none">Correct answer: <FormattedContent content={currentQuestion.correctAnswer} /></p>}
                        <div className="mt-2 text-gray-700 dark:text-gray-300 prose-lg dark:prose-invert max-w-none"><FormattedContent content={feedback.explanation} /></div>
                        <button onClick={onNextQuestion} className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-black">
                            {currentQuestionIndex < quiz.length - 1 ? t('examprep.quiz.nextQuestion') : t('examprep.quiz.viewResults')} <ArrowRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const QuizSummaryView: React.FC<{
    summary: QuizSummary;
    quiz: QuizQuestion[];
    userAnswers: string[];
    onStartNew: () => void;
    onRestart: () => void;
}> = ({ summary, quiz, userAnswers, onStartNew, onRestart }) => {
    const { t } = useLanguage();
    const [reviewMode, setReviewMode] = useState(false);
    
    if (reviewMode) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <button onClick={() => setReviewMode(false)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                    <ArrowLeftIcon className="w-4 h-4"/> Back to Summary
                </button>
                {quiz.map((q, index) => {
                    const userAnswer = userAnswers[index];
                    const isCorrect = userAnswer === q.correctAnswer;
                    return (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'}`}>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Question {index + 1}</p>
                            <div className="prose-lg dark:prose-invert max-w-none my-2"><FormattedContent content={q.question} /></div>
                            <p className="text-sm prose-lg dark:prose-invert max-w-none">Your answer: <span className="font-semibold">{userAnswer || 'Not answered'}</span></p>
                            {!isCorrect && <p className="text-sm prose-lg dark:prose-invert max-w-none">Correct answer: <span className="font-semibold"><FormattedContent content={q.correctAnswer} /></span></p>}
                        </div>
                    );
                })}
                 <button onClick={() => setReviewMode(false)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                    <ArrowLeftIcon className="w-4 h-4"/> Back to Summary
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 text-center">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold mb-2">{t('examprep.summary.title')}</h2>
                <p className="text-6xl font-bold my-4 text-primary">{summary.score.toFixed(0)}%</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left my-8">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <h3 className="font-bold text-lg text-green-700 dark:text-green-300">{t('examprep.summary.strengths')}</h3>
                        {summary.strengths.length > 0 ? (
                            <ul className="list-disc list-inside mt-2 text-sm">
                                {summary.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        ) : <p className="text-sm text-gray-500 mt-2">{t('examprep.summary.strengths.placeholder')}</p>}
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <h3 className="font-bold text-lg text-red-700 dark:text-red-300">{t('examprep.summary.weaknesses')}</h3>
                        {summary.weaknesses.length > 0 ? (
                            <ul className="list-disc list-inside mt-2 text-sm">
                                {summary.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        ) : 
                        <p className="text-sm text-gray-500 mt-2">{t('examprep.summary.weaknesses.placeholder')}</p>}
                    </div>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="font-bold text-lg text-blue-700 dark:text-blue-300">{t('examprep.summary.recommendations')}</h3>
                    {summary.recommendations.length > 0 ? (
                        <p className="mt-2 text-sm">{t('examprep.summary.recommendations.body', { topics: summary.recommendations.join(', ') })}</p>
                    ) : null}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <button onClick={() => setReviewMode(true)} className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-gray-200 dark:bg-gray-600">Review Answers</button>
                    <button onClick={onRestart} className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-gray-200 dark:bg-gray-600">Restart Quiz</button>
                    <button onClick={onStartNew} className="flex-1 py-2 px-4 rounded-md text-md font-semibold transition-colors bg-primary text-primary-text">
                        {t('examprep.summary.newQuiz')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ExamPrep: React.FC<ExamPrepProps> = ({
    addToast,
    setView,
    generationState,
    setGenerationState,
    quizState,
    setQuizState,
    notes,
    setNotes,
    examPrepState,
    setExamPrepState
}) => {
    const { t } = useLanguage();
    const { mode, numQuestions, quizType, uploadedFiles, focusArea, questionImage, questionText, solution, outputFormat, programmingLanguage, graphInterval, graphYInterval } = examPrepState;
    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [graphConfig, setGraphConfig] = useState<any>(null);
    
    const updateState = <K extends keyof ExamPrepState>(key: K, value: ExamPrepState[K]) => {
        setExamPrepState(prev => ({...prev, [key]: value}));
    }

    useEffect(() => {
        // This effect sets up the SpeechRecognition API and cleans it up when the mode changes.
        if (mode === 'solve') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                const recognition = recognitionRef.current;
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalTranscript) {
                        // Append the final transcript with a trailing space for better formatting.
                        setExamPrepState(prev => ({...prev, questionText: prev.questionText + finalTranscript.trim() + ' '}));
                    }
                };

                // This handles both automatic stops (e.g., silence) and manual stops.
                recognition.onend = () => {
                    setIsListening(false);
                };
                
                recognition.onerror = (event: any) => {
                    addToast(t('toasts.examprep.speechError', { error: event.error }), 'error');
                    setIsListening(false);
                };
            } else {
                recognitionRef.current = null;
            }

            // Cleanup function to stop recognition when the component unmounts or mode changes.
            return () => {
                if (recognitionRef.current) {
                    recognitionRef.current.stop();
                }
            };
        }
    }, [mode, addToast, t]);

    const handleMicClick = () => {
        if (!recognitionRef.current) {
            addToast(t('toasts.examprep.speechUnsupported'), 'error');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false); // Stop listening and update UI immediately
        } else {
            // Add a space if there's text and it doesn't end with a space
            if (questionText.trim() && !questionText.endsWith(' ')) {
                setExamPrepState(prev => ({...prev, questionText: prev.questionText + ' '}));
            }
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (mode === 'quiz') {
            const validFiles = acceptedFiles.filter(file => {
                if (file.size > 25 * 1024 * 1024) { // 25MB limit
                    addToast(t('toasts.fileSizeTooLarge', {fileName: file.name, size: 25}), 'error');
                    return false;
                }
                return true;
            });
            if (validFiles.length > 0) {
                updateState('uploadedFiles', [...uploadedFiles, ...validFiles]);
                addToast(t('toasts.filesAdded', {count: validFiles.length}), 'success');
            }
        } else { // solver mode
            const file = acceptedFiles[0];
            if (file && file.type.startsWith('image/')) {
                if (file.size > 25 * 1024 * 1024) { // 25MB limit
                    addToast(t('toasts.fileSizeTooLarge', {fileName: file.name, size: 25}), 'error');
                    return;
                }
                try {
                    const { dataUrl } = await processAndResizeImage(file);
                    updateState('questionImage', dataUrl);
                } catch(e: any) {
                    addToast(e.message || 'Failed to process image.', 'error');
                }
            } else if (file) {
                addToast(t('toasts.invalidImageFile'), 'error');
            }
        }
    }, [mode, uploadedFiles, addToast, t, updateState]);
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

    const removeFile = (index: number) => {
        const newFiles = [...uploadedFiles];
        newFiles.splice(index, 1);
        updateState('uploadedFiles', newFiles);
    };

    const handleGenerateQuiz = async () => {
        if (uploadedFiles.length === 0) {
            addToast(t('toasts.examprep.noFiles'), 'warning');
            return;
        }

        setGenerationState({ isLoading: true, message: t('examprep.verifying'), error: null, source: 'quiz' });

        try {
            let combinedContent = '';
            for (const file of uploadedFiles) {
                const base64String = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
                const filePart: ImagePart = { inlineData: { data: base64String, mimeType: file.type } };
                
                const isMaterial = await isStudyMaterial(filePart, { fast: true });
                if (isMaterial) {
                    const text = await extractTextFromDocument(filePart, { fast: true });
                    combinedContent += text + '\n\n';
                } else {
                    addToast(t('examprep.error.notStudyMaterial', { fileName: file.name }), 'warning');
                }
            }
            
            const MAX_CONTEXT = 30000;
            if(combinedContent.length > MAX_CONTEXT) {
                combinedContent = combinedContent.substring(0, MAX_CONTEXT);
                addToast(t('toasts.quizContentTruncated'), 'warning');
            }

            if (!combinedContent.trim()) {
                throw new Error(t('toasts.examprep.textExtractFailed'));
            }

            setGenerationState(prev => ({ ...prev, message: t('examprep.creatingQuiz') }));
            const questions = await generateQuiz(combinedContent, numQuestions, quizType, focusArea);
            
            if (questions && questions.length > 0) {
                 setQuizState({ quiz: questions, currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });
                 setGenerationState({ isLoading: false, message: '', error: null, source: null });
            } else {
                 throw new Error(t('examprep.error.noQuestions'));
            }
        } catch (error: any) {
            addToast(error.message || t('examprep.error.generic'), 'error');
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    };

    const handleAnswerSubmit = (answer: string) => {
        const currentQuestion = quizState.quiz[quizState.currentQuestionIndex];
        const isCorrect = currentQuestion.correctAnswer.toLowerCase().trim() === answer.toLowerCase().trim();
        setQuizState(prev => ({
            ...prev,
            userAnswers: [...prev.userAnswers, answer],
            feedback: { isCorrect, explanation: currentQuestion.explanation }
        }));
    };

    const handleNextQuestion = () => {
        if (quizState.currentQuestionIndex < quizState.quiz.length - 1) {
            setQuizState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1, feedback: null }));
        } else {
            const correctAnswers = quizState.userAnswers.filter((answer, index) => quizState.quiz[index].options ? answer === quizState.quiz[index].correctAnswer : answer.toLowerCase().trim() === quizState.quiz[index].correctAnswer.toLowerCase().trim()).length;
            const score = (correctAnswers / quizState.quiz.length) * 100;
            
            const topics = quizState.quiz.map(q => q.topic);
            const topicPerformance = topics.reduce((acc, topic, i) => {
                if(!acc[topic]) acc[topic] = { correct: 0, total: 0 };
                acc[topic].total++;
                if (quizState.userAnswers[i] === quizState.quiz[i].correctAnswer) {
                    acc[topic].correct++;
                }
                return acc;
            }, {} as Record<string, {correct: number, total: number}>);
            
            const strengths = Object.keys(topicPerformance).filter(t => topicPerformance[t].correct / topicPerformance[t].total > 0.7);
            const weaknesses = Object.keys(topicPerformance).filter(t => topicPerformance[t].correct / topicPerformance[t].total <= 0.7);

            const summary: QuizSummary = { score, strengths, weaknesses, recommendations: weaknesses };
            setQuizState(prev => ({ ...prev, summary, feedback: null }));
        }
    };
    
    const resetQuiz = () => {
        setQuizState({ quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });
    };

    const handleSolveProblem = async () => {
        if (!questionText.trim() && !questionImage) {
            addToast(t('toasts.examprep.noQuestion'), 'warning');
            return;
        }

        setGenerationState({ isLoading: true, message: t('examprep.solver.generatingSolution'), error: null, source: 'solve' });

        try {
            let imagePart: ImagePart | null = null;
            if (questionImage) {
                const base64String = questionImage.split(',')[1];
                const mimeType = questionImage.match(/data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
                imagePart = { inlineData: { data: base64String, mimeType } };
                
                if (!examPrepState.isVerifying) {
                    const isProblem = await isImageAProblem(imagePart);
                    if (!isProblem) {
                        addToast(t('toasts.examprep.invalidImage'), 'warning');
                        setGenerationState({ isLoading: false, message: '', error: null, source: null });
                        return;
                    }
                }
            }
            
            const result = await solveProblem(
                questionText,
                imagePart,
                outputFormat,
                programmingLanguage,
                graphInterval,
                graphYInterval
            );

            if (outputFormat === 'graph') {
                try {
                    const graphData = JSON.parse(result);
                    updateState('solution', graphData.explanation);
                    
                    const plotter = new AdvancedGraphPlotter();
                    
                    let functions: string[] = [];
                    if (typeof graphData.graphFunction === 'string') {
                        const rawFunc = graphData.graphFunction.trim();
                        if (rawFunc.startsWith('[') && rawFunc.endsWith(']')) {
                            try {
                                const parsed = JSON.parse(rawFunc);
                                if (Array.isArray(parsed)) {
                                    functions = parsed.filter(item => typeof item === 'string');
                                } else {
                                     functions = [String(parsed)];
                                }
                            } catch (e) {
                                functions = rawFunc.replace(/[\[\]"']/g, '').split(',').map(f => f.trim()).filter(f => f);
                            }
                        } else {
                            functions = rawFunc.split(',').map(f => f.trim()).filter(f => f);
                        }
                    } else if (Array.isArray(graphData.graphFunction)) {
                        functions = graphData.graphFunction.filter(item => typeof item === 'string');
                    }

                    if (functions.length === 0) {
                        throw new Error("Could not parse function expression from AI response.");
                    }

                    const intervalConfig = plotter.parseInterval(graphInterval);
                    const smartInterval = plotter.determineSmartInterval(functions[0]);
                    
                    const xMin = intervalConfig?.xMin ?? smartInterval.xMin;
                    const xMax = intervalConfig?.xMax ?? smartInterval.xMax;
                    const samples = intervalConfig?.samples ?? 200;
                    
                    const datasets = functions.map((func: string, index: number) => {
                        const points = plotter.generatePoints({
                            expr: func,
                            xMin,
                            xMax,
                            samples,
                            angleMode: intervalConfig?.angleMode || 'radians'
                        });
                        
                        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#ec4899'];
                        
                        return {
                            label: func.replace(/Math\./g, ''),
                            data: points,
                            borderColor: colors[index % colors.length],
                            fill: false,
                            pointRadius: 0
                        };
                    });
                    
                    setGraphConfig({
                        type: 'line',
                        data: {
                            datasets
                        },
                        options: {
                            plugins: {
                                title: {
                                    display: !!graphData.suggestedTitle,
                                    text: graphData.suggestedTitle
                                }
                            }
                        }
                    });

                } catch (e) {
                    console.error("Failed to parse or plot graph data", e);
                    addToast('Failed to render graph from AI response.', 'error');
                    updateState('solution', result); // Show raw JSON as fallback
                    setGraphConfig(null);
                }
            } else {
                updateState('solution', result);
                setGraphConfig(null);
            }
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        } catch (error: any) {
            addToast(error.message || t('toasts.error.solveProblem'), 'error');
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    };

    if (quizState.summary) {
        return <QuizSummaryView summary={quizState.summary} quiz={quizState.quiz} userAnswers={quizState.userAnswers} onStartNew={resetQuiz} onRestart={() => setQuizState(prev => ({ ...prev, summary: null, currentQuestionIndex: 0, userAnswers: [], feedback: null }))} />;
    }

    if (quizState.quiz.length > 0) {
        return <QuizRunner quiz={quizState.quiz} currentQuestionIndex={quizState.currentQuestionIndex} feedback={quizState.feedback} onAnswerSubmit={handleAnswerSubmit} onNextQuestion={handleNextQuestion} />;
    }
    
    const inputClasses = "block w-full px-3 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-center">{t('examprep.main.title')}</h2>
             <div className="flex justify-center border-b-2 border-gray-200 dark:border-gray-700">
                <button onClick={() => updateState('mode', 'quiz')} className={`px-6 py-2 font-semibold ${mode === 'quiz' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('examprep.tab.quiz')}</button>
                <button onClick={() => updateState('mode', 'solve')} className={`px-6 py-2 font-semibold ${mode === 'solve' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('examprep.tab.solver')}</button>
            </div>
            
            {mode === 'quiz' ? (
                // QUIZ GENERATOR UI
                <div className="relative bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg animate-fade-in">
                   <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'quiz'} message={generationState.message} />
                   <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold">{t('examprep.quiz.title')}</h3>
                        <button onClick={resetQuiz} className="text-sm font-semibold text-gray-500 hover:text-primary">{t('examprep.quiz.startOver')}</button>
                   </div>
                   <p className="text-gray-500 dark:text-gray-400 mt-1 mb-6">{t('examprep.quiz.intro')}</p>
                   
                   <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold mb-2">{t('examprep.quiz.step1')}</label>
                            <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20`}>
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                                    <UploadIcon className="w-8 h-8 mb-2" />
                                    <p className="font-semibold">{t('examprep.quiz.dropzone.click')}</p>
                                    <p className="text-xs">{t('examprep.quiz.dropzone.hint')}</p>
                                </div>
                            </div>
                            <div className="mt-2 space-y-1">
                                {uploadedFiles.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                        <span className="truncate">{file.name}</span>
                                        <button onClick={() => removeFile(i)}><CloseIcon className="w-4 h-4 text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="focus-area" className="block text-sm font-semibold mb-2">{t('examprep.quiz.step2')}</label>
                            <input id="focus-area" type="text" value={focusArea} onChange={e => updateState('focusArea', e.target.value)} placeholder={t('examprep.quiz.focusPlaceholder')} className={inputClasses} />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-semibold mb-2">{t('examprep.quiz.step3')}</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="num-questions" className="block text-xs font-medium text-gray-500 mb-1">{t('examprep.quiz.numQuestions')}</label>
                                    <input id="num-questions" type="number" value={numQuestions} onChange={e => updateState('numQuestions', parseInt(e.target.value, 10))} className={inputClasses} min="1" max="20" />
                                </div>
                                <div>
                                    <label htmlFor="quiz-type" className="block text-xs font-medium text-gray-500 mb-1">{t('examprep.quiz.quizType')}</label>
                                    <select id="quiz-type" value={quizType} onChange={e => updateState('quizType', e.target.value as QuizType)} className={inputClasses}>
                                        <option value={QuizType.MCQ}>{t('quizType.mcq')}</option>
                                        <option value={QuizType.CONCEPTUAL}>{t('quizType.conceptual')}</option>
                                        <option value={QuizType.THEORY}>{t('quizType.theory')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                   </div>

                   <button onClick={handleGenerateQuiz} className="w-full py-3 bg-primary text-primary-text font-bold rounded-xl mt-8 hover:bg-primary-dark transition-colors" disabled={generationState.isLoading}>
                     {t('examprep.quiz.generate')}
                   </button>
                </div>
            ) : (
                // PROBLEM SOLVER UI
                <div className="relative animate-fade-in space-y-6">
                    <div className="relative bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
                        <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'solve'} message={generationState.message} />
                         <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-bold">{t('examprep.solver.title')}</h3>
                            <button onClick={() => { updateState('solution', null); updateState('questionText', ''); updateState('questionImage', null); setGraphConfig(null); }} className="text-sm font-semibold text-gray-500 hover:text-primary">{t('examprep.solver.clear')}</button>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 mb-6">{t('examprep.solver.intro')}</p>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold mb-2">{t('examprep.solver.step1')}</label>
                                {questionImage && (
                                    <div className="relative my-4">
                                        <img src={questionImage} alt={t('examprep.solver.alt.questionPreview')} className="max-h-60 w-auto mx-auto rounded-lg shadow-md" />
                                        <button onClick={() => updateState('questionImage', null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg leading-none">&times;</button>
                                    </div>
                                )}
                                <textarea value={questionText} onChange={e => updateState('questionText', e.target.value)} placeholder={t('examprep.solver.questionPlaceholder')} rows={4} className={`${inputClasses} h-auto`} />
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                     <div {...getRootProps({ className: "p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300" })}>
                                        <input {...getInputProps()} />
                                        <UploadIcon className="w-8 h-8 mb-2 text-gray-500" />
                                        <span className="text-sm font-semibold">{t('examprep.solver.uploadImage')}</span>
                                    </div>
                                    <button onClick={() => setIsCameraModalOpen(true)} className="p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300">
                                        <CameraIcon className="w-8 h-8 mb-2 text-gray-500" />
                                        <span className="text-sm font-semibold">{t('examprep.solver.useCamera')}</span>
                                    </button>
                                    <button onClick={handleMicClick} className="p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300">
                                        <MicrophoneIcon className={`w-8 h-8 mb-2 transition-colors ${isListening ? 'text-red-500' : 'text-gray-500'}`} />
                                        <span className="text-sm font-semibold">{isListening ? t('examprep.solver.stopMic') : t('examprep.solver.useMic')}</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold mb-2">{t('examprep.solver.step2')}</label>
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label htmlFor="output-format" className="block text-xs font-medium text-gray-500 mb-1">{t('examprep.solver.outputFormat')}</label>
                                        <select id="output-format" value={outputFormat} onChange={e => updateState('outputFormat', e.target.value as ExamPrepState['outputFormat'])} className={inputClasses}>
                                            <option value="steps">{t('examprep.solver.format.steps')}</option>
                                            <option value="latex">{t('examprep.solver.format.latex')}</option>
                                            <option value="code">{t('examprep.solver.format.code')}</option>
                                            <option value="graph">{t('examprep.solver.format.graph')}</option>
                                        </select>
                                    </div>
                                    {outputFormat === 'code' && (
                                        <div>
                                            <label htmlFor="language" className="block text-xs font-medium text-gray-500 mb-1">{t('examprep.solver.language')}</label>
                                            <input id="language" type="text" value={programmingLanguage} onChange={e => updateState('programmingLanguage', e.target.value)} className={inputClasses}/>
                                        </div>
                                    )}
                                </div>
                                {outputFormat === 'graph' && (
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <label htmlFor="graph-interval" className="block text-xs font-medium text-gray-500 mb-1">{t('examprep.solver.graphInterval')}</label>
                                            <input id="graph-interval" type="text" value={graphInterval} onChange={e => updateState('graphInterval', e.target.value)} placeholder={t('examprep.solver.graphIntervalPlaceholder')} className={inputClasses}/>
                                        </div>
                                        <div>
                                            <label htmlFor="graph-y-interval" className="block text-xs font-medium text-gray-500 mb-1">{t('examprep.solver.graphYInterval')}</label>
                                            <input id="graph-y-interval" type="text" value={graphYInterval} onChange={e => updateState('graphYInterval', e.target.value)} placeholder={t('examprep.solver.graphYIntervalPlaceholder')} className={inputClasses}/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button onClick={handleSolveProblem} className="w-full py-3 bg-primary text-primary-text font-bold rounded-xl mt-8 hover:bg-primary-dark transition-colors" disabled={generationState.isLoading}>
                            {t('examprep.solver.solve')}
                        </button>
                    </div>

                    {solution && (
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold">{t('examprep.solution.title')}</h3>
                                <div className="flex items-center gap-2">
                                     <button onClick={() => { navigator.clipboard.writeText(solution); addToast(t('toasts.solutionCopied'), 'success'); }} className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200" title={t('examprep.solution.copyFull')}>
                                        <CopyIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => {
                                        const newNote = { id: Date.now().toString(), title: `Solution for: ${questionText.substring(0, 30)}...`, content: solution, subject: 'Problem Solving', createdAt: new Date().toISOString(), isFavourite: false };
                                        setNotes([newNote, ...notes]);
                                        addToast(t('toasts.solutionSaved'), 'success');
                                    }} className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200" title={t('examprep.solution.saveFull')}>
                                        <SaveIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="prose-lg dark:prose-invert max-w-none"><FormattedContent content={solution} /></div>
                            {graphConfig && <GraphRenderer chartConfig={graphConfig} canvasRef={graphCanvasRef} />}
                        </div>
                    )}
                </div>
            )}
            {isCameraModalOpen && (
                <CameraCaptureModal
                    isOpen={isCameraModalOpen}
                    onClose={() => setIsCameraModalOpen(false)}
                    onCapture={async (imageDataUrl) => {
                        setIsCameraModalOpen(false);
                        updateState('questionImage', imageDataUrl);
                        updateState('isVerifying', true);
                        setGenerationState({ isLoading: true, message: t('toasts.examprep.verifyingImage'), error: null, source: 'solve' });
                        try {
                            const base64String = imageDataUrl.split(',')[1];
                            const mimeType = imageDataUrl.match(/data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
                            const imagePart: ImagePart = { inlineData: { data: base64String, mimeType } };
                            const isProblem = await isImageAProblem(imagePart);
                            if (isProblem) {
                                addToast(t('toasts.examprep.captureSuccess'), 'success');
                            } else {
                                addToast(t('toasts.examprep.captureInvalid'), 'warning');
                                updateState('questionImage', null);
                            }
                            setGenerationState({ isLoading: false, message: '', error: null, source: null });
                        } catch (error: any) {
                            addToast(t('toasts.examprep.captureFailed'), 'error');
                            updateState('questionImage', null);
                            setGenerationState({ isLoading: false, message: '', error: error.message, source: 'solve' });
                        } finally {
                            updateState('isVerifying', false);
                        }
                    }}
                />
            )}
        </div>
    );
};

// No default export was provided. Adding one.
export default ExamPrep;