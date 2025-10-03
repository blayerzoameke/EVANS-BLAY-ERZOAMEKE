import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { useDropzone } from 'react-dropzone';
import { generateQuiz, extractTextFromDocument, isStudyMaterial, solveProblem, isImageAProblem } from '../services/geminiService.ts';
import type { Toast, QuizQuestion, AnswerFeedback, QuizSummary, ImagePart, GenerationState, QuizState, Note, ExamPrepState, View } from '../types.ts';
import { QuizType } from '../types.ts';
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
import { AdvancedGraphPlotter, type GraphConfig } from '../utils/AdvancedGraphPlotter.ts';

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

const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    {...props}
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);


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

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
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
    return <>{elements}</>;
});

type SolutionBlock = {
    type: 'text' | 'code' | 'graph';
    content: string;
    title: string;
    lang?: string;
};

interface QuizRunnerProps {
    quiz: QuizQuestion[];
    currentQuestionIndex: number;
    userAnswers: string[];
    feedback: AnswerFeedback | null;
    onAnswerSubmit: (answer: string) => void;
    onNextQuestion: () => void;
}

const QuizRunner: React.FC<QuizRunnerProps> = ({ quiz, currentQuestionIndex, feedback, onAnswerSubmit, onNextQuestion }) => {
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

    const isMCQ = currentQuestion.type === QuizType.MCQ && currentQuestion.options && currentQuestion.options.length > 0;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('examprep.quiz.questionOf', { current: currentQuestionIndex + 1, total: quiz.length })}</p>
                <div className="prose dark:prose-invert max-w-none mb-6">
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
                                    <span className="ml-3"><FormattedContent content={option} /></span>
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
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
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
                        {!feedback.isCorrect && <p className="text-sm">Correct answer: <FormattedContent content={currentQuestion.correctAnswer} /></p>}
                        <div className="mt-2 text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"><FormattedContent content={feedback.explanation} /></div>
                        <button onClick={onNextQuestion} className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-black">
                            {currentQuestionIndex < quiz.length - 1 ? t('examprep.quiz.nextQuestion') : t('examprep.quiz.viewResults')} <ArrowRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface QuizSummaryViewProps {
    summary: QuizSummary;
    quiz: QuizQuestion[];
    userAnswers: string[];
    onStartNew: () => void;
    onRestart: () => void;
}

const QuizSummaryView: React.FC<QuizSummaryViewProps> = ({ summary, quiz, userAnswers, onStartNew, onRestart }) => {
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
                            <div className="prose dark:prose-invert max-w-none my-2"><FormattedContent content={q.question} /></div>
                            <p className="text-sm">Your answer: <span className="font-semibold">{userAnswer || 'Not answered'}</span></p>
                            {!isCorrect && <p className="text-sm">Correct answer: <span className="font-semibold"><FormattedContent content={q.correctAnswer} /></span></p>}
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
                        ) : <p className="text-sm text-gray-500 mt-2">{t('examprep.summary.weaknesses.placeholder')}</p>}
                    </div>
                </div>

                <div className="flex justify-center gap-4">
                    <button onClick={onRestart} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Restart Quiz</button>
                    <button onClick={() => setReviewMode(true)} className="px-6 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">Review Answers</button>
                    <button onClick={onStartNew} className="px-6 py-2 bg-primary text-primary-text rounded-md">{t('examprep.summary.newQuiz')}</button>
                </div>
            </div>
        </div>
    );
};

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
    const [solutionBlocks, setSolutionBlocks] = useState<SolutionBlock[]>([]);
    const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const baseTextOnMicStart = useRef('');
    const [graphPlotter] = useState(() => new AdvancedGraphPlotter());
    
    const { mode, topic, numQuestions, quizType, uploadedFiles, focusArea, isVerifying, questionImage, questionText, solution, outputFormat, programmingLanguage, graphInterval } = examPrepState;
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
    
    useEffect(() => {
        if (!solution) {
            setSolutionBlocks([]);
            return;
        }

        const newBlocks: SolutionBlock[] = [];
        
        if (outputFormat === 'graph') {
            try {
                const { explanation, graphFunction, suggestedTitle } = JSON.parse(solution);
                if (explanation) {
                    newBlocks.push({ type: 'text', content: explanation, title: t('examprep.solution.title') });
                }

                if (graphFunction) {
                    const expressions = graphFunction.split(',').map((e: string) => e.trim()).filter((e: string) => e);
                    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#ec4899', '#8b5cf6'];

                    const datasets = expressions.map((expr: string, index: number) => {
                        const intervalSettings = graphPlotter.parseInterval(graphInterval);
                        const smartInterval = graphPlotter.determineSmartInterval(expr);

                        const config: GraphConfig = {
                            expr: expr,
                            xMin: intervalSettings?.xMin ?? smartInterval.xMin,
                            xMax: intervalSettings?.xMax ?? smartInterval.xMax,
                            samples: intervalSettings?.samples ?? 100,
                            angleMode: intervalSettings?.angleMode ?? 'radians'
                        };
                        
                        const points = graphPlotter.generatePoints(config);

                        return {
                            label: `y = ${expr}`,
                            data: points,
                            borderColor: colors[index % colors.length],
                            fill: false,
                            tension: 0.1
                        };
                    });

                    const chartConfig = {
                        type: 'line',
                        data: {
                            datasets,
                        },
                        options: {
                           parsing: {
                              xAxisKey: 'x',
                              yAxisKey: 'y'
                           }
                        }
                    };
                    newBlocks.push({ type: 'graph', content: JSON.stringify(chartConfig), title: suggestedTitle || t('examprep.solver.format.graph') });
                }
                setSolutionBlocks(newBlocks);
                return;
            } catch (e) {
                console.warn("Could not parse graph solution as new format, falling back.", e);
            }
        }

        const codeRegex = /(```[\s\S]*?```)/g;
        const parts = solution.split(codeRegex).filter(Boolean);

        parts.forEach(part => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const codeContent = part.slice(3, -3);
                const langMatch = codeContent.match(/^([a-zA-Z]+)\n/);
                const lang = langMatch ? langMatch[1] : 'code';
                const code = langMatch ? codeContent.substring(langMatch[0].length) : codeContent;
                newBlocks.push({ type: 'code', content: code, title: t('examprep.solution.codeTitle', { lang }), lang });
            } else if (part.trim()) {
                newBlocks.push({ type: 'text', content: part, title: t('examprep.solution.explanationTitle') });
            }
        });
        setSolutionBlocks(newBlocks);

    }, [solution, t, outputFormat, graphInterval, graphPlotter]);

    const handleSolveQuestion = async () => {
        if (!questionText.trim() && !questionImage) {
            addToast(t('toasts.examprep.noQuestion'), 'error');
            return;
        }

        setGenerationState({ isLoading: true, message: t('examprep.solver.generatingSolution'), error: null, source: 'solve' });
        updateState('solution', null);
        
        let imagePart: ImagePart | null = null;
        if (questionImage) {
            const base64String = questionImage.split(',')[1];
            const mimeType = questionImage.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
            imagePart = { inlineData: { data: base64String, mimeType } };
        }

        try {
            const result = await solveProblem(questionText, imagePart, outputFormat, programmingLanguage, graphInterval);
            updateState('solution', result);
        } catch (error: any) {
            addToast(error.message || t('toasts.error.solveProblem'), 'error');
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
            graphInterval: '',
        }));
    };

    const onQuizFileDrop = useCallback(async (acceptedFiles: File[]) => {
        const files = acceptedFiles;
        if (files.length === 0) return;

        updateState('isVerifying', true);
        addToast(t('examprep.verifying'), 'info');

        const validFiles: File[] = [];
        for (const file of files) {
            if (file.size > 25 * 1024 * 1024) { // 25MB limit
                addToast(t('toasts.fileSizeTooLarge', { fileName: file.name, size: 25 }), 'warning');
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
                    addToast(t('examprep.error.notStudyMaterial', { fileName: file.name }), 'error');
                }
            } catch (e) {
                addToast(t('toasts.fileProcessingErrorNamed', { fileName: file.name }), 'error');
            }
        }

        updateState('uploadedFiles', [...uploadedFiles, ...validFiles]);
        if (validFiles.length > 0) {
            addToast(t('toasts.filesAdded', { count: validFiles.length }), 'success');
        }
        updateState('isVerifying', false);
    }, [addToast, t, uploadedFiles, updateState]);
    
    const { getRootProps: getQuizRootProps, getInputProps: getQuizInputProps, isDragActive: isQuizDragActive } = useDropzone({ onDrop: onQuizFileDrop, multiple: true });
    const { getRootProps: getSolverRootProps, getInputProps: getSolverInputProps, isDragActive: isSolverDragActive } = useDropzone({ onDrop: onSolverImageDrop, multiple: false, accept: { 'image/*': ['.jpeg', '.jpg', '.png'] } });

    async function onSolverImageDrop(acceptedFiles: File[]) {
        const file = acceptedFiles[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                addToast(t('toasts.imageSizeError5'), 'error');
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                const imagePart: ImagePart = { inlineData: { data: base64String, mimeType: file.type } };

                addToast(t('toasts.examprep.verifyingImage'), 'info');
                try {
                    const isValid = await isImageAProblem(imagePart);
                    if (isValid) {
                        updateState('questionImage', reader.result as string);
                        addToast(t('toasts.examprep.validImage'), 'success');
                    } else {
                        addToast(t('toasts.examprep.invalidImage'), 'warning');
                    }
                } catch (e) {
                     addToast(t('toasts.examprep.verifyImageFailed'), 'error');
                }
            };
        }
    }

    const removeQuizFile = (fileName: string) => {
        updateState('uploadedFiles', uploadedFiles.filter(f => f.name !== fileName));
    };

    const handleGenerateQuiz = async () => {
        if (uploadedFiles.length === 0) {
            addToast(t('toasts.examprep.noFiles'), 'error');
            return;
        }

        setGenerationState({ isLoading: true, message: t('examprep.extracting'), error: null, source: 'quiz' });
        
        try {
            let combinedContent = '';
            for (const file of uploadedFiles) {
                const base64String = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                });
                const filePart: ImagePart = { inlineData: { data: base64String, mimeType: file.type } };
                const text = await extractTextFromDocument(filePart);
                combinedContent += `\n\n--- Document: ${file.name} ---\n\n${text}`;
            }

            const MAX_CHARS = 100000;
            if (combinedContent.length > MAX_CHARS) {
                combinedContent = combinedContent.substring(0, MAX_CHARS);
                addToast(t('toasts.quizContentTruncated'), 'warning');
            }
            
            setGenerationState(prev => ({ ...prev, message: t('examprep.creatingQuiz') }));
            const questions = await generateQuiz(combinedContent, numQuestions, quizType, focusArea);
            
            if (questions && questions.length > 0) {
                setQuizState({ quiz: questions, currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });
            } else {
                 addToast(t('examprep.error.noQuestions'), 'error');
            }
        } catch (e: any) {
            addToast(e.message || t('examprep.error.generic'), 'error');
        } finally {
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    };
    
    const handleAnswerSubmit = (answer: string) => {
        const currentQuestion = quiz[currentQuestionIndex];
        const isCorrect = currentQuestion.correctAnswer === answer;
        const newFeedback: AnswerFeedback = { isCorrect, explanation: currentQuestion.explanation };
        
        setQuizState(prev => ({
            ...prev,
            userAnswers: [...prev.userAnswers, answer],
            feedback: newFeedback,
        }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quiz.length - 1) {
            setQuizState(prev => ({
                ...prev,
                currentQuestionIndex: prev.currentQuestionIndex + 1,
                feedback: null,
            }));
        } else { // Quiz finished
             setQuizState(prev => ({
                ...prev,
                summary: calculateSummary(),
                feedback: null,
            }));
        }
    };
    
    const calculateSummary = (): QuizSummary => {
        let score = 0;
        const correctTopics = new Set<string>();
        const incorrectTopics = new Set<string>();
        quiz.forEach((q, i) => {
            if (q.correctAnswer === userAnswers[i]) {
                score++;
                correctTopics.add(q.topic);
            } else {
                incorrectTopics.add(q.topic);
            }
        });
        
        const strengths = Array.from(correctTopics).filter(t => !incorrectTopics.has(t));
        
        return {
            score: (score / quiz.length) * 100,
            strengths,
            weaknesses: Array.from(incorrectTopics),
            recommendations: [],
        };
    };
    
    const startNewQuiz = () => {
        setQuizState({ quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });
        setExamPrepState(prev => ({
            ...prev,
            uploadedFiles: [],
            focusArea: '',
        }));
    };
    
    const handleCameraCapture = async (imageDataUrl: string) => {
        setIsCameraModalOpen(false);
        const base64String = imageDataUrl.split(',')[1];
        const imagePart: ImagePart = { inlineData: { data: base64String, mimeType: 'image/jpeg' } };
        
        addToast(t('toasts.examprep.verifyingImage'), 'info');
        try {
            const isValid = await isImageAProblem(imagePart);
            if (isValid) {
                updateState('questionImage', imageDataUrl);
                addToast(t('toasts.examprep.captureSuccess'), 'success');
            } else {
                addToast(t('toasts.examprep.captureInvalid'), 'warning');
            }
        } catch (e) {
             addToast(t('toasts.examprep.captureFailed'), 'error');
        }
    };
    
    const toggleSpeechRecognition = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addToast(t('toasts.examprep.speechUnsupported'), 'error');
            return;
        }
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; // Or dynamically set based on user's language
        
        recognition.onstart = () => {
            setIsListening(true);
            baseTextOnMicStart.current = questionText;
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognition.onerror = (event: any) => {
             addToast(t('toasts.examprep.speechError', { error: event.error }), 'error');
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    baseTextOnMicStart.current += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            updateState('questionText', baseTextOnMicStart.current + interimTranscript);
        };

        recognition.start();
        recognitionRef.current = recognition;
    };

    const copySolution = (content: string) => {
        navigator.clipboard.writeText(content).then(() => {
            addToast(t('toasts.solutionCopied'), 'success');
        }).catch(() => addToast(t('toasts.copyError'), 'error'));
    };

    const saveSolutionToNotes = (title: string, content: string) => {
        const newNote: Note = {
            id: Date.now().toString(),
            title: `Solution: ${title}`,
            content: content,
            subject: 'Problem Solving',
            createdAt: new Date().toISOString(),
            isFavourite: false,
        };
        setNotes([newNote, ...notes]);
        addToast(t('toasts.solutionSaved'), 'success');
    };
    
    const saveCanvasAsImage = () => {
        if (graphCanvasRef.current) {
            const link = document.createElement('a');
            link.download = 'graph.png';
            link.href = graphCanvasRef.current.toDataURL('image/png');
            link.click();
        }
    };

    if (quiz.length > 0 && !summary) {
        return <QuizRunner 
                    quiz={quiz} 
                    currentQuestionIndex={currentQuestionIndex} 
                    userAnswers={userAnswers} 
                    feedback={feedback} 
                    onAnswerSubmit={handleAnswerSubmit}
                    onNextQuestion={handleNextQuestion}
                />;
    }

    if (summary) {
        return <QuizSummaryView summary={summary} quiz={quiz} userAnswers={userAnswers} onStartNew={startNewQuiz} onRestart={() => setQuizState(prev => ({...prev, currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null}))}/>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white text-center">{t('examprep.main.title')}</h2>
            
            <div className="flex justify-center border-b-2 border-gray-200 dark:border-gray-700">
                <button onClick={() => updateState('mode', 'quiz')} className={`px-6 py-3 font-semibold text-lg border-b-4 ${mode === 'quiz' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>{t('examprep.tab.quiz')}</button>
                <button onClick={() => updateState('mode', 'solve')} className={`px-6 py-3 font-semibold text-lg border-b-4 ${mode === 'solve' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>{t('examprep.tab.solver')}</button>
            </div>
            
            <div className="relative">
                <LoadingOverlay isLoading={generationState.isLoading && (generationState.source === 'quiz' || generationState.source === 'solve')} message={generationState.message} />

                {mode === 'quiz' ? (
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg space-y-6">
                        <div className="text-center">
                            <h3 className="text-2xl font-bold">{t('examprep.quiz.title')}</h3>
                            <p className="text-gray-500 mt-1">{t('examprep.quiz.intro')}</p>
                        </div>

                        {/* File Upload */}
                        <div>
                            <h4 className="font-semibold mb-2">{t('examprep.quiz.step1')}</h4>
                             <div {...getQuizRootProps()} className={`p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isQuizDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} hover:border-green-500 dark:hover:border-green-400`}>
                                <input {...getQuizInputProps()} />
                                <div className="flex flex-col items-center text-center text-gray-500">
                                    <UploadIcon className="w-10 h-10 mb-2" />
                                    <p className="font-semibold">{t('examprep.quiz.dropzone.click')}</p>
                                    <p className="text-sm">{t('examprep.quiz.dropzone.hint')}</p>
                                </div>
                             </div>
                             {isVerifying && <p className="text-sm text-blue-500 mt-2">{t('examprep.quiz.verifyingFiles')}</p>}
                             {uploadedFiles.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {uploadedFiles.map(file => (
                                        <div key={file.name} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                            <div className="flex items-center gap-2">
                                                <DocumentIcon className="w-5 h-5 text-gray-500" />
                                                <span className="text-sm font-medium truncate">{file.name}</span>
                                            </div>
                                            <button onClick={() => removeQuizFile(file.name)}><CloseIcon className="w-4 h-4 text-gray-400 hover:text-red-500"/></button>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>

                        {/* Focus Area */}
                        <div>
                            <h4 className="font-semibold mb-2">{t('examprep.quiz.step2')}</h4>
                            <input type="text" value={focusArea} onChange={e => updateState('focusArea', e.target.value)} placeholder={t('examprep.quiz.focusPlaceholder')} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                        </div>
                        
                        {/* Configuration */}
                        <div>
                             <h4 className="font-semibold mb-2">{t('examprep.quiz.step3')}</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="num-questions" className="block text-sm font-medium mb-1">{t('examprep.quiz.numQuestions')}</label>
                                    <select id="num-questions" value={numQuestions} onChange={e => updateState('numQuestions', parseInt(e.target.value, 10))} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                        <option>5</option><option>10</option><option>15</option><option>20</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="quiz-type" className="block text-sm font-medium mb-1">{t('examprep.quiz.quizType')}</label>
                                    <select id="quiz-type" value={quizType} onChange={e => updateState('quizType', e.target.value as QuizType)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                        <option value={QuizType.MCQ}>{t('quizType.mcq')}</option>
                                        <option value={QuizType.CONCEPTUAL}>{t('quizType.conceptual')}</option>
                                        <option value={QuizType.THEORY}>{t('quizType.theory')}</option>
                                    </select>
                                </div>
                             </div>
                        </div>

                        <button onClick={handleGenerateQuiz} disabled={uploadedFiles.length === 0 || generationState.isLoading || isVerifying} className="w-full py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 transition-all">{t('examprep.quiz.generate')}</button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="text-center flex-1">
                                <h3 className="text-2xl font-bold">{t('examprep.solver.title')}</h3>
                                <p className="text-gray-500 mt-1">{t('examprep.solver.intro')}</p>
                            </div>
                            <button onClick={clearSolution} className="text-sm font-medium text-gray-500 hover:text-red-500">{t('examprep.solver.clear')}</button>
                        </div>
                        
                         <div>
                            <h4 className="font-semibold mb-2">{t('examprep.solver.step1')}</h4>
                            <div className="relative">
                                <textarea value={questionText} onChange={e => updateState('questionText', e.target.value)} placeholder={t('examprep.solver.questionPlaceholder')} rows={4} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 pr-10"></textarea>
                                <button type="button" onClick={toggleSpeechRecognition} className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${isListening ? 'bg-red-100 dark:bg-red-900/20 text-red-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                    <MicrophoneIcon className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                                </button>
                            </div>
                            {questionImage && (
                                <div className="relative mt-2 w-fit">
                                    <img src={questionImage} alt={t('examprep.solver.alt.questionPreview')} className="max-h-40 rounded-md shadow-md" />
                                    <button onClick={() => updateState('questionImage', null)} className="absolute -top-2 -right-2 bg-black/60 text-white rounded-full p-1 leading-none"><CloseIcon className="w-4 h-4" /></button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div {...getSolverRootProps()} className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isSolverDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:bg-primary/5'}`}>
                                    <input {...getSolverInputProps()} />
                                    <UploadIcon className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                                    <p className="text-sm font-semibold text-center text-gray-600 dark:text-gray-300">{t('examprep.solver.uploadImage')}</p>
                                </div>
                                <button type="button" onClick={() => setIsCameraModalOpen(true)} className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:bg-primary/5">
                                    <CameraIcon className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                                    <p className="text-sm font-semibold text-center text-gray-600 dark:text-gray-300">{t('examprep.solver.useCamera')}</p>
                                </button>
                            </div>
                         </div>
                         
                         <div>
                            <h4 className="font-semibold mb-2">{t('examprep.solver.step2')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="output-format" className="block text-sm font-medium mb-1">{t('examprep.solver.outputFormat')}</label>
                                    <select id="output-format" value={outputFormat} onChange={e => updateState('outputFormat', e.target.value as any)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                        <option value="steps">{t('examprep.solver.format.steps')}</option>
                                        <option value="latex">{t('examprep.solver.format.latex')}</option>
                                        <option value="code">{t('examprep.solver.format.code')}</option>
                                        <option value="graph">{t('examprep.solver.format.graph')}</option>
                                    </select>
                                </div>
                                {outputFormat === 'code' && (
                                     <div>
                                        <label htmlFor="language" className="block text-sm font-medium mb-1">{t('examprep.solver.language')}</label>
                                        <select id="language" value={programmingLanguage} onChange={e => updateState('programmingLanguage', e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                            <option>python</option><option>javascript</option><option>java</option><option>c++</option>
                                        </select>
                                    </div>
                                )}
                                 {outputFormat === 'graph' && (
                                     <div>
                                        <label htmlFor="graph-interval" className="block text-sm font-medium mb-1">{t('examprep.solver.graphInterval')}</label>
                                        <input type="text" id="graph-interval" value={graphInterval} onChange={e => updateState('graphInterval', e.target.value)} placeholder={t('examprep.solver.graphIntervalPlaceholder')} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                                    </div>
                                )}
                            </div>
                         </div>

                         <button onClick={handleSolveQuestion} disabled={generationState.isLoading} className="w-full py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 transition-all">{t('examprep.solver.solve')}</button>
                        
                        {solution && (
                             <div className="pt-6 border-t dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold">{t('examprep.solution.title')}</h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => copySolution(solution)} className="flex items-center gap-1 text-sm p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"><CopyIcon className="w-4 h-4"/> {t('examprep.solution.copyFull')}</button>
                                        <button onClick={() => saveSolutionToNotes(questionText.slice(0, 30), solution)} className="flex items-center gap-1 text-sm p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"><SaveIcon className="w-4 h-4"/> {t('examprep.solution.saveFull')}</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {solutionBlocks.map((block, index) => (
                                        <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-semibold text-gray-600 dark:text-gray-300">{block.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    {block.type === 'graph' ? (
                                                        <button onClick={() => copySolution(block.content)} title={t('examprep.solution.copyConfig')} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><CopyIcon className="w-4 h-4"/></button>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => copySolution(block.content)} title={t('examprep.copySolution')} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><CopyIcon className="w-4 h-4"/></button>
                                                            <button onClick={() => saveSolutionToNotes(block.title, block.content)} title={t('examprep.saveToNotes')} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><SaveIcon className="w-4 h-4"/></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {block.type === 'text' && <FormattedContent content={block.content} />}
                                            {block.type === 'code' && <pre className="whitespace-pre-wrap bg-gray-900 text-white p-3 rounded-md text-sm"><code>{block.content}</code></pre>}
                                            {block.type === 'graph' && (
                                                <>
                                                    <GraphRenderer chartConfig={JSON.parse(block.content)} canvasRef={graphCanvasRef} />
                                                    <div className="mt-4 flex justify-end">
                                                        <button onClick={saveCanvasAsImage} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary-dark">
                                                            <DownloadIcon className="w-4 h-4" />
                                                            {t('examprep.solution.saveAsImage')}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
             {isCameraModalOpen && <CameraCaptureModal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={handleCameraCapture} />}
        </div>
    );
};
export default ExamPrep;