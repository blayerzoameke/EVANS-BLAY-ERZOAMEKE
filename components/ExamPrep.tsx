

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { useDropzone } from 'react-dropzone';
// FIX: Added .ts extension to import path.
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
    viewBox="0 0 24 24" 
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
        // FIX: Corrected JSX syntax for the code tag.
        return <code>{content}</code>;
    }
});

const GraphRenderer: React.FC<{ chartConfig: any; canvasRef: React.RefObject<HTMLCanvasElement | null> }> = ({ chartConfig, canvasRef }) => {
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
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor },
                                },
                            },
                            elements: {
                                line: { tension: 0.4, borderWidth: 3 },
                                point: { radius: 3, hoverRadius: 6 },
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
             <canvas ref={canvasRef} aria-label="Generated graph"></canvas>
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
    // FIX: Changed type from JSX.Element[] to React.ReactNode[] to resolve "Cannot find namespace 'JSX'" error.
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
                newBlocks.push({ type: 'text', content: part, title: 'Explanation' });
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
                addToast(`File "${file.name}" is too large (> 25MB).`, 'warning');
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

                setGenerationState({ isLoading: true, message: t('toasts.examprep.verifyingImage'), error: null, source: 'solve' });
                try {
                    const isProblem = await isImageAProblem(imagePart);
                    if (isProblem) {
                        updateState('questionImage', imageDataUrl);
                        addToast(t('toasts.examprep.validImage'), 'success');
                    } else {
                        addToast(t('toasts.examprep.invalidImage'), 'error');
                    }
                } catch (e) {
                    addToast(t('toasts.examprep.verifyImageFailed'), 'error');
                } finally {
                    setGenerationState({ isLoading: false, message: '', error: null, source: null });
                }
            };
        }
    }, [addToast, updateState, t, setGenerationState]);

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
            addToast(t('toasts.examprep.speechUnsupported'), 'error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; 

        baseTextOnMicStart.current = questionText;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };
        recognition.onerror = (event: any) => {
            addToast(t('toasts.examprep.speechError', { error: event.error }), 'error');
            setIsListening(false);
        };
        
        recognition.onresult = (event: any) => {
            let final_transcript_so_far = '';
            let interim_transcript_so_far = '';

            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript_so_far += event.results[i][0].transcript;
                } else {
                    interim_transcript_so_far += event.results[i][0].transcript;
                }
            }

            const newText = (baseTextOnMicStart.current.trim() ? baseTextOnMicStart.current.trim() + ' ' : '') + final_transcript_so_far + interim_transcript_so_far;
            updateState('questionText', newText.trim());
        };

        recognition.start();
        recognitionRef.current = recognition;
    };
    
    const handleCapture = async (imageDataUrl: string) => {
        setIsCameraModalOpen(false);
        const base64String = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.match(/data:(.*);base64,/)?.[1] || 'image/jpeg';
        const imagePart: ImagePart = { inlineData: { data: base64String, mimeType } };

        setGenerationState({ isLoading: true, message: t('toasts.examprep.verifyingImage'), error: null, source: 'solve' });
        try {
            const isProblem = await isImageAProblem(imagePart);
            if (isProblem) {
                updateState('questionImage', imageDataUrl);
                addToast(t('toasts.examprep.captureSuccess'), 'success');
            } else {
                addToast(t('toasts.examprep.captureInvalid'), 'error');
            }
        } catch (e) {
            addToast(t('toasts.examprep.captureFailed'), 'error');
        } finally {
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    };

    const removeFile = (index: number) => {
        updateState('uploadedFiles', uploadedFiles.filter((_, i) => i !== index));
    };

    const handleGenerateQuiz = async () => {
        if (uploadedFiles.length === 0) {
            addToast(t('toasts.examprep.noFiles'), 'error');
            return;
        }
        setQuizState({ quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null });

        try {
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
                addToast(t('toasts.examprep.textExtractFailed'), 'error');
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
                return;
            }

            // Safeguard against exceeding the token limit for quiz generation.
            const MAX_CONTENT_LENGTH = 2500000; // A safe character limit to stay under the ~1M token limit.
            let contentToSend = contentForQuiz;
            if (contentForQuiz.length > MAX_CONTENT_LENGTH) {
                contentToSend = contentForQuiz.substring(0, MAX_CONTENT_LENGTH);
                addToast(t('toasts.quizContentTruncated' as any), 'warning');
            }

            setGenerationState({ isLoading: true, message: t('examprep.creatingQuiz'), error: null, source: 'quiz' });
            const questions = await generateQuiz(contentToSend, numQuestions, quizType, focusArea);
            if (questions && questions.length > 0) {
                setQuizState(prev => ({ ...prev, quiz: questions, userAnswers: new Array(questions.length).fill(null) }));
            } else {
                addToast(t('examprep.error.noQuestions'), 'warning');
            }
        } catch (error: any) {
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
        setQuizState(prev => ({ ...prev, feedback: null, summary: { score: (score / quiz.length) * 100, strengths, weaknesses, recommendations: [t('examprep.summary.recommendations.body', { topics: weaknesses.join(', ') })] } }));
    };

    const handleChangeSettings = () => setQuizState(prev => ({ ...prev, quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null }));
    const handleStartNewQuiz = () => {
        handleChangeSettings();
        setExamPrepState(prev => ({ ...prev, uploadedFiles: [], focusArea: '' }));
    };
    
    const handleCopyBlock = (content: string) => {
        navigator.clipboard.writeText(content).then(() => addToast(t('toasts.solutionCopied'), 'success')).catch(() => addToast('Failed to copy.', 'error'));
    };
    
    const handleSaveBlockToNotes = (block: SolutionBlock) => {
        const noteTitle = `${t('examprep.solution.title')}: ${block.title}`;
        const newNote: Note = { 
            id: Date.now().toString(), 
            title: noteTitle, 
            content: block.content, 
            subject: t('examprep.tab.solver'), 
            createdAt: new Date().toISOString(), 
            isFavourite: false 
        };
        // FIX: Correctly update notes state without using a function, as per the prop type definition.
        setNotes([newNote, ...notes]);
        addToast(t('toasts.solutionSaved'), 'success');
    };
    
    const handleSaveGraphAsImage = () => {
        if (graphCanvasRef.current) {
            const link = document.createElement('a');
            link.download = 'graph-solution.png';
            link.href = graphCanvasRef.current.toDataURL('image/png');
            link.click();
        }
    };
    
    if (summary) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 text-gray-800 dark:text-white">
                    <h2 className="text-4xl font-bold text-center mb-6">{t('examprep.summary.title')}</h2>
                    <div className="text-center mb-8">
                        <p className="text-7xl font-bold mb-4 text-primary">{summary.score.toFixed(0)}%</p>
                        <div className="w-32 h-2 bg-primary/20 rounded-full mx-auto"><div className="h-2 bg-primary rounded-full transition-all duration-1000" style={{ width: `${summary.score}%` }}></div></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                            <h3 className="font-bold text-xl mb-3 text-green-600 dark:text-green-400">{t('examprep.summary.strengths')}</h3>
                            <p className="text-gray-700 dark:text-gray-300">{summary.strengths.join(', ') || t('examprep.summary.strengths.placeholder')}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                            <h3 className="font-bold text-xl mb-3 text-orange-600 dark:text-orange-400">{t('examprep.summary.weaknesses')}</h3>
                            <p className="text-gray-700 dark:text-gray-300">{summary.weaknesses.join(', ') || t('examprep.summary.weaknesses.placeholder')}</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl mb-8">
                        <h3 className="font-bold text-xl mb-3 text-primary dark:text-primary-light">{t('examprep.summary.recommendations')}</h3>
                        <p className="text-gray-700 dark:text-gray-300">{summary.recommendations.join(', ')}</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                        <button onClick={handleChangeSettings} className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-lg rounded-xl shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">{t('examprep.summary.changeSettings')}</button>
                        <button onClick={handleStartNewQuiz} className="w-full py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark transition-all">{t('examprep.summary.newQuiz')}</button>
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
                        <span className="text-lg font-bold">{t('examprep.quiz.questionOf', { current: currentQuestionIndex + 1, total: quiz.length })}</span>
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
                            <textarea rows={4} onBlur={(e) => handleAnswerSubmit(e.target.value)} disabled={!!feedback} className="w-full p-4 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" placeholder={t('examprep.quiz.answerPlaceholder')} />
                        )}
                    </div>
                    {feedback && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                            <div className="flex items-center gap-3 mb-4">{feedback.isCorrect ? <CheckIcon className="w-8 h-8 text-green-500" /> : <CloseIcon className="w-8 h-8 text-red-500" />}<h4 className="font-bold text-2xl">{feedback.isCorrect ? t('examprep.quiz.correct') : t('examprep.quiz.incorrect')}</h4></div>
                            <p className="text-gray-700 dark:text-gray-300 mb-6 text-lg">{feedback.explanation}</p>
                            <button onClick={handleNextQuestion} className="w-full py-3 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark transition-all">{currentQuestionIndex < quiz.length - 1 ? t('examprep.quiz.nextQuestion') : t('examprep.quiz.viewResults')}</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const buttonGroupClasses = `flex-1 group p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/50 border-gray-300 dark:border-gray-600 text-center`;
    
    return (
        <div className="max-w-4xl mx-auto space-y-8 relative">
            <LoadingOverlay 
                isLoading={(generationState.isLoading && (generationState.source === 'quiz' || generationState.source === 'solve')) || isVerifying} 
                message={isVerifying ? t('examprep.verifying') : generationState.message} 
            />
            <div className="text-center">
                <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-3">{t('examprep.main.title')}</h2>
            </div>
            <div className="flex justify-center border-b dark:border-gray-700 mb-6">
                <button onClick={() => updateState('mode', 'quiz')} className={`px-6 py-3 font-semibold transition-colors ${mode === 'quiz' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('examprep.tab.quiz')}</button>
                <button onClick={() => updateState('mode', 'solve')} className={`px-6 py-3 font-semibold transition-colors ${mode === 'solve' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>{t('examprep.tab.solver')}</button>
            </div>

            {mode === 'quiz' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">{t('examprep.quiz.title')}</h3>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleStartNewQuiz(); }} className="text-sm text-primary dark:text-primary-light hover:underline">{t('examprep.quiz.startOver')}</a>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">{t('examprep.quiz.intro')}</p>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-lg font-semibold mb-3">{t('examprep.quiz.step1')}</label>
                            <div {...getQuizRootProps()} className={`group p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isVerifying ? 'opacity-50' : 'hover:border-primary'} border-gray-300 dark:border-gray-600 text-center ${isQuizDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : ''} hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20`}>
                                <input {...getQuizInputProps()} />
                                <UploadIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                                <p className="font-semibold text-gray-700 dark:text-gray-300">{t('examprep.quiz.dropzone.click')}</p>
                                <p className="text-xs text-gray-500">{t('examprep.quiz.dropzone.hint')}</p>
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
                            <label htmlFor="focusArea" className="block text-lg font-semibold mb-3">{t('examprep.quiz.step2')}</label>
                            <input id="focusArea" type="text" value={focusArea} onChange={e => updateState('focusArea', e.target.value)} placeholder={t('examprep.quiz.focusPlaceholder')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/20 dark:focus:ring-primary/30" />
                        </div>
                        <div>
                            <label className="block text-lg font-semibold mb-3">{t('examprep.quiz.step3')}</label>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div><label htmlFor="numQuestions" className="block font-medium mb-1">{t('examprep.quiz.numQuestions')}</label><input id="numQuestions" type="number" value={numQuestions} onChange={e => updateState('numQuestions', parseInt(e.target.value, 10))} min="1" max="20" className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700" /></div>
                                <div><label htmlFor="quizType" className="block font-medium mb-1">{t('examprep.quiz.quizType')}</label><select id="quizType" value={quizType} onChange={e => updateState('quizType', e.target.value as QuizType)} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">{Object.values(QuizType).map(type => (<option key={type} value={type}>{type}</option>))}</select></div>
                            </div>
                        </div>
                        <div className="mt-8"><button onClick={handleGenerateQuiz} disabled={generationState.isLoading || isVerifying} className="w-full py-4 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed transition-all">{isVerifying ? t('examprep.quiz.verifyingFiles') : t('examprep.quiz.generate')}</button></div>
                    </div>
                </div>
            )}
            {mode === 'solve' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                    <div className="flex justify-between items-center"><h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">{t('examprep.solver.title')}</h3><a href="#" onClick={(e) => { e.preventDefault(); clearSolution(); }} className="text-sm text-primary dark:text-primary-light hover:underline">{t('examprep.solver.clear')}</a></div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">{t('examprep.solver.intro')}</p>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="questionText" className="block text-lg font-semibold mb-3">{t('examprep.solver.step1')}</label>
                            <textarea id="questionText" value={questionText} onChange={e => updateState('questionText', e.target.value)} placeholder={t('examprep.solver.questionPlaceholder')} rows={4} className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 focus:border-primary focus:ring-4 focus:ring-primary/20 dark:focus:ring-primary/30" />
                            <div className="flex items-center gap-4 mt-2">
                                <div {...getProblemImageRootProps()} className={`${buttonGroupClasses} ${isProblemImageDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : ''}`}><input {...getProblemImageInputProps()} /><UploadIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('examprep.solver.uploadImage')}</p></div>
                                <button onClick={handleCameraClick} className={buttonGroupClasses}><CameraIcon className="w-6 h-6 mx-auto mb-1 text-gray-400" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('examprep.solver.useCamera')}</p></button>
                                <button onClick={handleMicClick} className={`${buttonGroupClasses} ${isListening ? 'border-red-500 bg-red-50 dark:bg-red-900/50' : ''}`}><MicrophoneIcon className={`w-6 h-6 mx-auto mb-1 transition-colors ${isListening ? 'text-red-500' : 'text-gray-400'}`} /><p className={`text-sm font-semibold transition-colors ${isListening ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{isListening ? t('examprep.solver.stopMic') : t('examprep.solver.useMic')}</p></button>
                            </div>
                             {questionImage && <div className="mt-4"><img src={questionImage} alt="Question preview" className="max-h-40 mx-auto rounded-lg shadow-md" /></div>}
                        </div>
                        <div>
                            <label className="block text-lg font-semibold mb-3">{t('examprep.solver.step2')}</label>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="outputFormat" className="block font-medium mb-1">{t('examprep.solver.outputFormat')}</label>
                                    <select id="outputFormat" value={outputFormat} onChange={e => updateState('outputFormat', e.target.value as any)} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">
                                        <option value="steps">{t('examprep.solver.format.steps')}</option>
                                        <option value="latex">{t('examprep.solver.format.latex')}</option>
                                        <option value="code">{t('examprep.solver.format.code')}</option>
                                        <option value="graph">{t('examprep.solver.format.graph')}</option>
                                    </select>
                                </div>
                                {outputFormat === 'code' && (<div><label htmlFor="programmingLanguage" className="block font-medium mb-1">{t('examprep.solver.language')}</label><select id="programmingLanguage" value={programmingLanguage} onChange={e => updateState('programmingLanguage', e.target.value)} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700"><option value="python">Python</option><option value="javascript">JavaScript</option><option value="java">Java</option><option value="cpp">C++</option><option value="csharp">C#</option></select></div>)}
                                {outputFormat === 'graph' && (<div><label htmlFor="graphInterval" className="block font-medium mb-1">{t('examprep.solver.graphInterval')}</label><input id="graphInterval" type="text" value={graphInterval} onChange={e => updateState('graphInterval', e.target.value)} placeholder={t('examprep.solver.graphIntervalPlaceholder')} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700" /></div>)}
                            </div>
                        </div>
                        <div className="mt-8"><button onClick={handleSolveQuestion} disabled={generationState.isLoading} className="w-full py-4 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed transition-all">{t('examprep.solver.solve')}</button></div>
                        {solution && (
                            <div className="mt-8 pt-6 border-t dark:border-gray-700 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-2xl font-bold">{t('examprep.solution.title')}</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleCopyBlock(solution)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><CopyIcon className="w-4 h-4" /> {t('examprep.solution.copyFull')}</button>
                                        <button onClick={() => handleSaveBlockToNotes({type: 'text', title: t('examprep.solution.title'), content: solution})} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"><SaveIcon className="w-4 h-4" /> {t('examprep.solution.saveFull')}</button>
                                    </div>
                                </div>
                                {solutionBlocks.map((block, index) => (
                                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-semibold">{block.title}</h4>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleCopyBlock(block.content)} title={block.type === 'graph' ? t('examprep.solution.copyConfig') : t('examprep.copySolution')} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><CopyIcon className="w-4 h-4" /></button>
                                                {block.type === 'graph' ? (
                                                     <button onClick={handleSaveGraphAsImage} title={t('examprep.solution.saveAsImage')} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><DownloadIcon className="w-4 h-4" /></button>
                                                ) : (
                                                    <button onClick={() => handleSaveBlockToNotes(block)} title={t('examprep.saveToNotes')} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><SaveIcon className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        </div>
                                        {block.type === 'text' && <FormattedContent content={block.content} />}
                                        {block.type === 'code' && <pre><code className="block whitespace-pre-wrap p-2 text-sm bg-gray-800 text-white rounded-md">{block.content}</code></pre>}
                                        {block.type === 'graph' && <GraphRenderer chartConfig={JSON.parse(block.content)} canvasRef={graphCanvasRef} />}
                                    </div>
                                ))}
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
