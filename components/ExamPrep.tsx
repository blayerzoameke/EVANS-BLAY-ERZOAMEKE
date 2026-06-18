import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDropzone } from 'react-dropzone';

// ── Image Lightbox ─────────────────────────────────────────────────────
const ImageLightbox: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, [onClose]);
    return (
        <div
            onClick={onClose}
            style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.92)',
                display:'flex', alignItems:'center', justifyContent:'center',
                padding:'16px' }}
        >
            <button
                onClick={onClose}
                style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.15)',
                    border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'white', fontSize:22, lineHeight:1, zIndex:10000 }}
                aria-label="Close"
            >✕</button>
            <img
                src={src}
                alt="Preview"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth:'100%', maxHeight:'88vh', borderRadius:12,
                    boxShadow:'0 24px 80px rgba(0,0,0,0.6)', objectFit:'contain' }}
            />
        </div>
    );
};
import { generateQuiz, extractTextFromDocument, isStudyMaterial, solveProblem, isImageAProblem, generateFlashcards, verifyAndExtract } from '../services/geminiService';
import type { Toast, QuizQuestion, AnswerFeedback, QuizSummary, ImagePart, GenerationState, QuizState, FlashcardState, Note, ExamPrepState, View } from '../types';
import { QuizType } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';
import { UploadIcon } from './icons/UploadIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { CameraIcon } from './icons/CameraIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { QuizIcon } from './icons/QuizIcon';
import katex from 'katex';
import CameraCaptureModal from './CameraCaptureModal';
import { SaveIcon } from './icons/SaveIcon';
import { CopyIcon } from './icons/CopyIcon';
import { AdvancedGraphPlotter } from '../utils/AdvancedGraphPlotter';
import { processAndResizeImage } from '../lib/utils';
import { Language } from '../lib/i18n';
import { TableRenderer, parseMarkdownTable } from './TableRenderer';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    Chart: any;
  }
}

interface ExamPrepProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
    generationState: GenerationState;
    setGenerationState: React.Dispatch<React.SetStateAction<GenerationState>>;
    quizState: QuizState;
    setQuizState: React.Dispatch<React.SetStateAction<QuizState>>;
    flashcardState: FlashcardState;
    setFlashcardState: React.Dispatch<React.SetStateAction<FlashcardState>>;
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    examPrepState: ExamPrepState;
    setExamPrepState: React.Dispatch<React.SetStateAction<ExamPrepState>>;
    onGenerateQuizAttempt: (action: () => Promise<void>) => void;
    onSolveProblemAttempt: (action: () => Promise<void>) => void;
    onSaveQuizToHistory?: (quiz: any[], userAnswers: any[], summary: any, focusArea: string) => Promise<void>;
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

const CustomDropdown: React.FC<{ 
    label: string; 
    value: string; 
    options: { value: string; label: string }[]; 
    onChange: (value: any) => void;
    icon?: React.ReactNode;
}> = ({ label, value, options, onChange, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value === value)?.label || value;

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1 mb-2">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all shadow-sm hover:border-primary/50 group"
            >
                <div className="flex items-center gap-3">
                    {icon && <div className="text-primary">{icon}</div>}
                    <span className="font-bold text-gray-900 dark:text-white">{selectedLabel}</span>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-gray-400 group-hover:text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in-down">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-5 py-3 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors flex items-center justify-between ${
                                value === option.value ? 'text-primary bg-primary/5' : 'text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            <span className="font-bold">{option.label}</span>
                            {value === option.value && <CheckIcon className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
            )}
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
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }

            const Chart = window.Chart;
            if (Chart) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    try {
                        const isDarkMode = document.documentElement.classList.contains('dark');
                        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                        const textColor = isDarkMode ? '#e5e7eb' : '#374151';
                        const axisLineColor = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
                        const zeroLineColor = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';

                        const defaultOptions = {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                                intersect: false,
                                mode: 'index',
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: { color: textColor, font: { size: 13, weight: 'bold' } }
                                },
                                tooltip: {
                                    enabled: true,
                                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                                    titleColor: isDarkMode ? '#f9fafb' : '#111827',
                                    bodyColor: isDarkMode ? '#d1d5db' : '#374151',
                                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                                    borderWidth: 1,
                                    padding: 12,
                                    cornerRadius: 8,
                                    callbacks: {
                                        label: (context: any) => {
                                            let label = context.dataset.label || '';
                                            if (label) label += ': ';
                                            if (context.parsed.y !== null) {
                                                label += `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`;
                                            }
                                            return label;
                                        }
                                    }
                                },
                            },
                            scales: {
                                x: {
                                    type: 'linear',
                                    grid: {
                                        color: (context: any) => context.tick.value === 0 ? zeroLineColor : gridColor,
                                        lineWidth: (context: any) => context.tick.value === 0 ? 2 : 1,
                                    },
                                    border: { display: true, color: axisLineColor, width: 2 },
                                    ticks: { color: textColor, font: { size: 11 } },
                                    title: { display: true, text: 'X', color: textColor, font: { weight: 'bold' } }
                                },
                                y: {
                                    grid: {
                                        color: (context: any) => context.tick.value === 0 ? zeroLineColor : gridColor,
                                        lineWidth: (context: any) => context.tick.value === 0 ? 2 : 1,
                                    },
                                    border: { display: true, color: axisLineColor, width: 2 },
                                    ticks: { color: textColor, font: { size: 11 } },
                                    title: { display: true, text: 'Y', color: textColor, font: { weight: 'bold' } }
                                },
                            },
                            elements: {
                                line: { tension: 0.3, borderWidth: 3 },
                                point: { radius: 0, hoverRadius: 6, hitRadius: 10 },
                            },
                            animation: { duration: 800, easing: 'easeOutQuart' },
                        };

                        // Robust config merging
                        const finalConfig = {
                            type: chartConfig.type || 'line',
                            data: chartConfig.data || { datasets: [] },
                            options: {
                                ...defaultOptions,
                                ...(chartConfig.options || {}),
                                plugins: { 
                                    ...defaultOptions.plugins, 
                                    ...(chartConfig.options?.plugins || {}) 
                                },
                                scales: { 
                                    ...defaultOptions.scales, 
                                    ...(chartConfig.options?.scales || {}) 
                                },
                            }
                        };
                        
                        chartInstanceRef.current = new Chart(ctx, finalConfig);
                    } catch (e) {
                        console.error("Failed to create chart from config:", chartConfig, e);
                    }
                }
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
        <div className="relative h-96 w-full bg-white dark:bg-gray-900 rounded-xl p-4 shadow-inner border-2 border-gray-100 dark:border-gray-800">
             <canvas ref={canvasRef} aria-label={t('examprep.solver.graphAriaLabel')}></canvas>
        </div>
    );
};


const FormattedContent: React.FC<{ content: string }> = React.memo(({ content }) => {
    const renderInlineElements = (text: string) => {
        const inlineRegex = /(\$\$[\s\S]*?\$\$)|(\$.*?\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))|(\*\*.*?\*\*)|(`.*?`)/g;
        const parts = text.split(inlineRegex).filter(Boolean);
        return parts.map((part, index) => {
            if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
                const inner = part.startsWith('$$') ? part.slice(2, -2) : part.slice(2, -2);
                return <KatexRenderer key={index} content={inner} displayMode={true} />;
            }
            if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
                const inner = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
                return <KatexRenderer key={index} content={inner} displayMode={false} />;
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
                let tableBuffer: string[] = [];
                let inTable = false;

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

                const flushTable = () => {
                    if (tableBuffer.length > 0) {
                        const tableData = parseMarkdownTable(tableBuffer.join('\n'));
                        if (tableData) {
                            elements.push(<TableRenderer key={`tbl-${elements.length}`} data={tableData} />);
                        } else {
                            paragraphLines.push(...tableBuffer);
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
                        flushTable();
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

const QuizRunner: React.FC<{
    quiz: QuizQuestion[];
    currentQuestionIndex: number;
    feedback: AnswerFeedback | null;
    timerSeconds: number | null;
    isEvaluating: boolean;
    onAnswerSubmit: (answer: string) => void;
    onNextQuestion: () => void;
    onTimeUp: () => void;
    onCancel: () => void;
}> = ({ quiz, currentQuestionIndex, feedback, timerSeconds, isEvaluating, onAnswerSubmit, onNextQuestion, onTimeUp, onCancel }) => {
    const { t } = useLanguage();
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [timeLeft, setTimeLeft] = useState<number | null>(timerSeconds);
    const [hintRevealed, setHintRevealed] = useState(false);
    const [showSymbols, setShowSymbols] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isMarkingImage, setIsMarkingImage] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [showCanvas, setShowCanvas] = useState(false);
    const [canvasHasContent, setCanvasHasContent] = useState(false);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<any>(null);
    const hasCalledTimeUp = useRef(false);
    const lastPos = useRef<{x:number;y:number}|null>(null);

    const MATH_SYMBOLS = [
        { sym:'α', label:'alpha' },{ sym:'β', label:'beta' },{ sym:'γ', label:'gamma' },
        { sym:'δ', label:'delta' },{ sym:'θ', label:'theta' },{ sym:'λ', label:'lambda' },
        { sym:'μ', label:'mu' },{ sym:'π', label:'pi' },{ sym:'σ', label:'sigma' },
        { sym:'φ', label:'phi' },{ sym:'ω', label:'omega' },{ sym:'Σ', label:'sum' },
        { sym:'∫', label:'integral' },{ sym:'∂', label:'partial' },{ sym:'∇', label:'nabla' },
        { sym:'√', label:'sqrt' },{ sym:'∞', label:'infinity' },{ sym:'≈', label:'approx' },
        { sym:'≠', label:'not equal' },{ sym:'≤', label:'leq' },{ sym:'≥', label:'geq' },
        { sym:'±', label:'plus-minus' },{ sym:'×', label:'times' },{ sym:'÷', label:'divide' },
        { sym:'²', label:'squared' },{ sym:'³', label:'cubed' },{ sym:'⁻¹', label:'inverse' },
        { sym:'∈', label:'in' },{ sym:'∉', label:'not in' },{ sym:'⊂', label:'subset' },
        { sym:'∪', label:'union' },{ sym:'∩', label:'intersect' },{ sym:'→', label:'arrow' },
        { sym:'⟹', label:'implies' },{ sym:'⟺', label:'iff' },{ sym:'∀', label:'for all' },
        { sym:'∃', label:'exists' },{ sym:'¬', label:'not' },{ sym:'∧', label:'and' },{ sym:'∨', label:'or' },
    ];

    const insertSymbol = (sym: string) => {
        const ta = document.getElementById('theory-textarea') as HTMLTextAreaElement;
        if (!ta) { setSelectedAnswer(prev => prev + sym); return; }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = selectedAnswer.substring(0, start) + sym + selectedAnswer.substring(end);
        setSelectedAnswer(newVal);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + sym.length; ta.focus(); }, 0);
    };

    // Canvas drawing helpers
    const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
        }
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const pos = getPos(e, canvas);
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
        lastPos.current = pos;
        setIsDrawing(true); setCanvasHasContent(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing) return;
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const pos = getPos(e, canvas);
        if (lastPos.current) { ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
        lastPos.current = pos;
    };

    const endDraw = () => { setIsDrawing(false); lastPos.current = null; };

    const clearCanvas = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setCanvasHasContent(false);
    };

    const submitCanvasAsAnswer = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        setUploadedImage(dataUrl);
        setShowCanvas(false);
        setSelectedAnswer('[Handwritten answer submitted — see image above]');
    };

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = async () => {
            const dataUrl = reader.result as string;
            setUploadedImage(dataUrl);
            setIsMarkingImage(true);
            try {
                const base64 = dataUrl.split(',')[1];
                const mimeType = file.type as any;
                const imagePart = { inlineData: { data: base64, mimeType } };
                const { isStudyMaterial: _, ...geminiService } = await import('../services/geminiService');
                const ai = new (await import('@google/genai')).GoogleGenAI({ apiKey: (window as any).process?.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY });
                const currentQ = quiz[currentQuestionIndex];
                const prompt = `You are marking a student's handwritten answer. 
Question: "${currentQ.question}"
Expected answer: "${currentQ.correctAnswer}"

Look at this image which contains the student's handwritten answer. 
Evaluate it and respond ONLY with a JSON object: {"extractedText": "what you read from the image", "isCorrect": true/false, "score": 0-100, "feedback": "brief marking feedback"}`;
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: { parts: [{ text: prompt }, imagePart] },
                });
                const text = (response.text || '').trim().replace(/```json|```/g, '');
                const result = JSON.parse(text);
                setSelectedAnswer(result.extractedText || '[Handwritten answer]');
                if (result.isCorrect !== undefined) {
                    onAnswerSubmit(result.extractedText || result.feedback || '[Handwritten answer]');
                }
            } catch (err) {
                setSelectedAnswer('[Image uploaded — please also type your answer for best results]');
            } finally { setIsMarkingImage(false); }
        };
        reader.readAsDataURL(file);
    };
    const currentQuestion = quiz[currentQuestionIndex];

    useEffect(() => {
        setSelectedAnswer('');
        setHintRevealed(false);
    }, [currentQuestionIndex]);

    // ── Timer: single interval, starts immediately when timerSeconds is set ──
    useEffect(() => {
        if (timerSeconds === null) return;
        setTimeLeft(timerSeconds);
        hasCalledTimeUp.current = false;
        clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev === null) return null;
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [timerSeconds]); // restart only when a new quiz starts

    // ── Fire onTimeUp when countdown reaches 0 ──
    useEffect(() => {
        if (timeLeft === 0 && !hasCalledTimeUp.current) {
            hasCalledTimeUp.current = true;
            onTimeUp();
        }
    }, [timeLeft]);

    const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const timerPct = timerSeconds ? (timeLeft! / timerSeconds) * 100 : 100;
    const timerColor = timerPct > 50 ? '#22c55e' : timerPct > 20 ? '#f59e0b' : '#ef4444';

    if (!currentQuestion) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAnswer.trim()) onAnswerSubmit(selectedAnswer);
    };

    const isMCQ = !!currentQuestion.options && currentQuestion.options.length > 0;
    const inputClasses = "block w-full px-5 py-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-2xl shadow-sm placeholder-gray-400 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary sm:text-lg transition-all";

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Top bar: cancel + question counter */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-transparent hover:border-red-200 dark:hover:border-red-800 transition-all"
                >
                    <CloseIcon className="w-4 h-4" /> Cancel Quiz
                </button>
                <span className="text-sm font-black text-gray-400 tabular-nums">{currentQuestionIndex + 1} / {quiz.length}</span>
            </div>

            {/* Timer bar */}
            {timeLeft !== null && (
                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Time Remaining</span>
                        <span className="font-black text-xl tabular-nums" style={{ color: timerColor }}>{fmtTime(timeLeft)}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timerPct}%`, background: timerColor }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right font-bold">When time runs out, you'll be scored on answered questions</p>
                </div>
            )}

            <div className="p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border-2 border-gray-100 dark:border-gray-700">
                <p className="text-sm font-black text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-widest">{t('examprep.quiz.questionOf', { current: currentQuestionIndex + 1, total: quiz.length })}</p>
                <div className="prose-lg dark:prose-invert max-w-none mb-8 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border dark:border-gray-700">
                    <FormattedContent content={currentQuestion.question} />
                </div>
                
                <form onSubmit={handleSubmit}>
                    {isMCQ ? (
                        <div className="space-y-3">
                            {currentQuestion.options?.map((option, index) => (
                                <label key={index} className={`flex items-center p-5 border-2 rounded-2xl cursor-pointer transition-all ${
                                    selectedAnswer === option
                                        ? 'border-primary bg-primary/5 ring-4 ring-primary/10 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}>
                                    <input
                                        type="radio"
                                        name="quiz-option"
                                        value={option}
                                        checked={selectedAnswer === option}
                                        onChange={(e) => setSelectedAnswer(e.target.value)}
                                        disabled={!!feedback}
                                        className="h-6 w-6 text-primary focus:ring-primary border-gray-300"
                                    />
                                    <span className="ml-4 prose-lg dark:prose-invert max-w-none font-bold text-gray-800 dark:text-gray-200">
                                        <FormattedContent content={option} />
                                    </span>
                                </label>
                            ))}

                            {/* Socratic hint — only for MCQ, only before submitting */}
                            {!feedback && currentQuestion.hint && (
                                <div className="pt-2">
                                    {!hintRevealed ? (
                                        <button
                                            type="button"
                                            onClick={() => setHintRevealed(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-2 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all"
                                        >
                                            💡 Need a hint?
                                        </button>
                                    ) : (
                                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl animate-fade-in">
                                            <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-1">💡 Think about this…</p>
                                            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 leading-relaxed italic">
                                                {currentQuestion.hint}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{display:'flex',flexDirection:'column',gap:10}}>
                            {/* ── Toolbar ── */}
                            {!feedback && (
                                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                                    {/* Math symbols button */}
                                    <div style={{position:'relative'}}>
                                        <button type="button" onClick={()=>setShowSymbols(s=>!s)}
                                            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:10,background:showSymbols?'#4338ca':'rgba(67,56,202,0.08)',border:'1.5px solid rgba(67,56,202,0.3)',color:showSymbols?'white':'#4338ca',fontWeight:800,fontSize:13,cursor:'pointer',transition:'all .18s'}}>
                                            ∑ Symbols
                                        </button>
                                        {showSymbols && (
                                            <div style={{position:'absolute',top:'calc(100% + 8px)',left:0,zIndex:100,background:'white',border:'1.5px solid rgba(67,56,202,0.2)',borderRadius:16,padding:12,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',width:320,display:'flex',flexWrap:'wrap',gap:4}}>
                                                <div style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                                                    <span style={{fontSize:11,fontWeight:800,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.07em'}}>Math & Logic Symbols</span>
                                                    <button type="button" onClick={()=>setShowSymbols(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:16}}>✕</button>
                                                </div>
                                                {MATH_SYMBOLS.map(({sym,label})=>(
                                                    <button key={sym} type="button" title={label} onClick={()=>insertSymbol(sym)}
                                                        style={{width:36,height:36,borderRadius:8,background:'rgba(67,56,202,0.06)',border:'1px solid rgba(67,56,202,0.15)',fontFamily:'serif',fontSize:17,cursor:'pointer',fontWeight:700,color:'#1e1b4b',transition:'all .15s',display:'flex',alignItems:'center',justifyContent:'center'}}
                                                        onMouseEnter={e=>{(e.currentTarget as any).style.background='rgba(67,56,202,0.18)';}}
                                                        onMouseLeave={e=>{(e.currentTarget as any).style.background='rgba(67,56,202,0.06)';}}>
                                                        {sym}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload image answer */}
                                    <label style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:10,background:'rgba(16,185,129,0.08)',border:'1.5px solid rgba(16,185,129,0.3)',color:'#059669',fontWeight:800,fontSize:13,cursor:'pointer',transition:'all .18s'}}
                                        onMouseEnter={e=>{(e.currentTarget as any).style.background='rgba(16,185,129,0.18)';}}
                                        onMouseLeave={e=>{(e.currentTarget as any).style.background='rgba(16,185,129,0.08)';}}>
                                        📷 Upload Answer
                                        <input ref={imageUploadRef} type="file" accept="image/*" style={{display:'none'}}
                                            onChange={e=>{const f=e.target.files?.[0];if(f)handleImageUpload(f);e.target.value='';}}/>
                                    </label>

                                    {/* Stylus / draw answer */}
                                    <button type="button" onClick={()=>setShowCanvas(s=>!s)}
                                        style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:10,background:showCanvas?'#7c3aed':'rgba(124,58,237,0.08)',border:'1.5px solid rgba(124,58,237,0.3)',color:showCanvas?'white':'#7c3aed',fontWeight:800,fontSize:13,cursor:'pointer',transition:'all .18s'}}>
                                        ✏️ Draw Answer
                                    </button>
                                </div>
                            )}

                            {/* Uploaded image preview */}
                            {uploadedImage && (
                                <div style={{position:'relative',borderRadius:12,overflow:'hidden',border:'2px solid rgba(16,185,129,0.3)'}}>
                                    <img src={uploadedImage} alt="Your answer" style={{width:'100%',maxHeight:200,objectFit:'contain',background:'#f9fafb'}}/>
                                    {isMarkingImage && (
                                        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
                                            <div style={{width:28,height:28,borderRadius:'50%',border:'3px solid rgba(255,255,255,0.3)',borderTopColor:'white',animation:'spin .7s linear infinite'}}/>
                                            <span style={{color:'white',fontSize:13,fontWeight:700}}>AI is marking your answer...</span>
                                        </div>
                                    )}
                                    {!feedback && <button type="button" onClick={()=>{setUploadedImage(null);setSelectedAnswer('');}}
                                        style={{position:'absolute',top:8,right:8,background:'rgba(239,68,68,0.85)',border:'none',borderRadius:'50%',width:28,height:28,color:'white',cursor:'pointer',fontWeight:900,fontSize:14}}>✕</button>}
                                </div>
                            )}

                            {/* Canvas drawing area */}
                            {showCanvas && (
                                <div style={{border:'2px solid rgba(124,58,237,0.3)',borderRadius:14,overflow:'hidden',background:'white'}}>
                                    <div style={{padding:'8px 12px',background:'rgba(124,58,237,0.06)',borderBottom:'1px solid rgba(124,58,237,0.15)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                        <span style={{fontSize:12,fontWeight:800,color:'#7c3aed'}}>✏️ Draw your answer (stylus or mouse)</span>
                                        <div style={{display:'flex',gap:6}}>
                                            <button type="button" onClick={clearCanvas} style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:7,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer'}}>Clear</button>
                                            <button type="button" onClick={submitCanvasAsAnswer} disabled={!canvasHasContent}
                                                style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:7,background:canvasHasContent?'linear-gradient(135deg,#7c3aed,#a78bfa)':'#e5e7eb',border:'none',color:canvasHasContent?'white':'#9ca3af',cursor:canvasHasContent?'pointer':'not-allowed'}}>
                                                ✓ Use This
                                            </button>
                                        </div>
                                    </div>
                                    <canvas ref={canvasRef} width={600} height={200}
                                        style={{width:'100%',height:200,cursor:'crosshair',touchAction:'none',display:'block'}}
                                        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                                        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
                                </div>
                            )}

                            {/* Text answer */}
                            <textarea
                                id="theory-textarea"
                                value={selectedAnswer}
                                onChange={(e) => setSelectedAnswer(e.target.value)}
                                disabled={!!feedback}
                                placeholder={t('examprep.quiz.answerPlaceholder')}
                                rows={4}
                                className={inputClasses}
                            />
                        </div>
                    )}
                    
                    {!feedback && (
                        <button type="submit" disabled={!selectedAnswer.trim() || isEvaluating} className="mt-10 w-full py-5 bg-primary text-primary-text font-black text-xl rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-dark disabled:bg-primary/50 transition-all transform hover:-translate-y-0.5">
                            {isEvaluating ? (
                                <><div className="inline-block w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin mr-2" /> Evaluating...</>
                            ) : (
                                <><CheckIcon className="inline w-6 h-6 mr-2" /> Submit Answer</>
                            )}
                        </button>
                    )}
                </form>

                {feedback && (
                    <div className={`mt-10 p-8 rounded-3xl border-2 ${feedback.isCorrect ? 'bg-green-50 dark:bg-green-900/10 border-green-500' : 'bg-red-50 dark:bg-red-900/10 border-red-500'}`}>
                        <div className="flex items-center gap-4 mb-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${feedback.isCorrect ? 'bg-green-500' : 'bg-red-500'} text-white shadow-lg`}>
                                {feedback.isCorrect ? <CheckIcon className="w-8 h-8" /> : <CloseIcon className="w-8 h-8" />}
                             </div>
                             <h4 className={`font-black text-3xl ${feedback.isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                {feedback.isCorrect ? t('examprep.quiz.correct') : t('examprep.quiz.incorrect')}
                            </h4>
                        </div>
                        {!feedback.isCorrect && <div className="text-lg prose-lg dark:prose-invert max-w-none mt-4 font-black p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-red-200 dark:border-red-900/30">Correct answer: <FormattedContent content={currentQuestion.correctAnswer} /></div>}
                        <div className="mt-6 text-gray-700 dark:text-gray-300 prose-lg dark:prose-invert max-w-none font-medium"><FormattedContent content={feedback.explanation} /></div>
                        <button onClick={onNextQuestion} className="mt-8 flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-4 bg-gray-900 text-white font-black text-lg rounded-2xl hover:bg-black shadow-2xl transition-all">
                            {currentQuestionIndex < quiz.length - 1 ? t('examprep.quiz.nextQuestion') : t('examprep.quiz.viewResults')} <ArrowRightIcon className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Flashcard components ──────────────────────────────────────────────

const FlashcardView: React.FC<{
    state: FlashcardState;
    setState: React.Dispatch<React.SetStateAction<FlashcardState>>;
    difficulty: 'easy' | 'moderate' | 'hard';
    onDone: () => void;
    onCancel: () => void;
}> = ({ state, setState, difficulty, onDone, onCancel }) => {
    const { cards, currentIndex, flipped, known, unknown, sessionDone } = state;
    const card = cards[currentIndex];
    const [showHint, setShowHint] = useState(false);

    const diffBadge = {
        easy: { label: 'Easy', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: '🟢' },
        moderate: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', dot: '🟡' },
        hard: { label: 'Hard', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: '🔴' },
    }[difficulty];

    useEffect(() => { setShowHint(false); }, [currentIndex]);

    const flip = () => setState(p => ({ ...p, flipped: !p.flipped }));

    const mark = (knew: boolean) => {
        const next = currentIndex + 1;
        setState(p => ({
            ...p,
            known: knew ? [...p.known, currentIndex] : p.known,
            unknown: !knew ? [...p.unknown, currentIndex] : p.unknown,
            currentIndex: next < cards.length ? next : p.currentIndex,
            flipped: false,
            sessionDone: next >= cards.length,
        }));
    };

    const restart = () => setState(p => ({ ...p, currentIndex: 0, flipped: false, known: [], unknown: [], sessionDone: false }));
    const reviewUnknown = () => {
        const unknownCards = unknown.map(i => cards[i]);
        setState({ cards: unknownCards, currentIndex: 0, flipped: false, known: [], unknown: [], sessionDone: false });
    };

    const total = cards.length;
    const answered = known.length + unknown.length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

    if (sessionDone) {
        const knowPct = total > 0 ? Math.round((known.length / total) * 100) : 0;
        return (
            <div className="max-w-2xl mx-auto text-center animate-fade-in space-y-8">
                <div className="p-12 bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl border-2 border-gray-100 dark:border-gray-700">
                    <div className="text-6xl mb-4">{knowPct >= 80 ? '🎉' : knowPct >= 50 ? '👍' : '📚'}</div>
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Session Complete!</h2>
                    <p className="text-gray-500 font-bold mb-8">You reviewed all {total} flashcards</p>

                    <div className="grid grid-cols-2 gap-6 mb-10">
                        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl border-2 border-green-200 dark:border-green-800">
                            <p className="text-4xl font-black text-green-600">{known.length}</p>
                            <p className="text-sm font-black uppercase tracking-widest text-green-500 mt-1">Knew It ✓</p>
                        </div>
                        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border-2 border-red-200 dark:border-red-800">
                            <p className="text-4xl font-black text-red-600">{unknown.length}</p>
                            <p className="text-sm font-black uppercase tracking-widest text-red-500 mt-1">Need Review ✗</p>
                        </div>
                    </div>

                    {/* Mastery ring */}
                    <div className="relative inline-block mb-10">
                        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100 dark:text-gray-700"/>
                            <circle cx="50" cy="50" r="42" stroke={knowPct >= 80 ? '#22c55e' : knowPct >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="10" fill="transparent"
                                strokeDasharray={263.9} strokeDashoffset={263.9 * (1 - knowPct / 100)} strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <p className="text-3xl font-black" style={{ color: knowPct >= 80 ? '#22c55e' : knowPct >= 50 ? '#f59e0b' : '#ef4444' }}>{knowPct}%</p>
                            <p className="text-xs font-black text-gray-400">mastery</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={restart} className="flex-1 py-4 rounded-2xl font-black bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white uppercase tracking-widest">Restart All</button>
                        {unknown.length > 0 && (
                            <button onClick={reviewUnknown} className="flex-1 py-4 rounded-2xl font-black bg-red-500 hover:bg-red-600 text-white uppercase tracking-widest shadow-lg">Review {unknown.length} Missed</button>
                        )}
                        <button onClick={onDone} className="flex-1 py-4 rounded-2xl font-black bg-primary hover:bg-primary-dark text-primary-text uppercase tracking-widest shadow-xl shadow-primary/30">New Set</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!card) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            {/* Header: difficulty badge + cancel */}
            <div className="flex items-center justify-between">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${diffBadge.color}`}>
                    {diffBadge.dot} {diffBadge.label}
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-gray-400">{cards.length} cards</span>
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-transparent hover:border-red-200 dark:hover:border-red-800 transition-all"
                    >
                        <CloseIcon className="w-4 h-4" /> Cancel
                    </button>
                </div>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-black text-gray-500 tabular-nums">{answered}/{total}</span>
            </div>
            <div className="flex gap-4 text-xs font-black uppercase tracking-widest">
                <span className="text-green-500">✓ {known.length} known</span>
                <span className="text-red-500">✗ {unknown.length} unsure</span>
            </div>

            {/* Card */}
            <div
                onClick={flip}
                className="relative cursor-pointer select-none"
                style={{ perspective: 1200 }}
            >
                <style>{`
                    .fc-inner { transition: transform 0.55s cubic-bezier(.4,0,.2,1); transform-style: preserve-3d; }
                    .fc-flipped .fc-inner { transform: rotateY(180deg); }
                    .fc-front,.fc-back { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                    .fc-back { transform: rotateY(180deg); }
                `}</style>
                <div className={`fc-wrap ${flipped ? 'fc-flipped' : ''}`}>
                    <div className="fc-inner relative" style={{ minHeight: 280 }}>
                        {/* Front */}
                        <div className="fc-front absolute inset-0 flex flex-col items-center justify-center p-10 bg-gradient-to-br from-primary/90 to-primary rounded-[2.5rem] shadow-2xl shadow-primary/30 border-2 border-primary/20 text-center">
                            <span className="text-xs font-black uppercase tracking-widest text-primary-text/60 mb-4">Term / Question</span>
                            <p className="text-2xl font-black text-white leading-snug">{card.front}</p>
                            {card.hint && !showHint && (
                                <button onClick={e => { e.stopPropagation(); setShowHint(true); }} className="mt-6 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-black rounded-xl uppercase tracking-widest transition-colors">
                                    💡 Hint
                                </button>
                            )}
                            {showHint && card.hint && (
                                <p className="mt-5 px-4 py-3 bg-white/20 rounded-xl text-white/80 text-sm italic font-bold">{card.hint}</p>
                            )}
                            <p className="mt-6 text-xs text-white/50 font-bold">Tap to reveal answer</p>
                        </div>
                        {/* Back */}
                        <div className="fc-back absolute inset-0 flex flex-col items-center justify-center p-10 bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl border-2 border-primary/20 text-center">
                            <span className="text-xs font-black uppercase tracking-widest text-primary mb-4">Answer</span>
                            <p className="text-xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed">{card.back}</p>
                            <p className="mt-4 text-xs text-gray-400 font-black uppercase tracking-widest px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-xl">{card.topic}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mark buttons — only when flipped */}
            <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ${flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <button onClick={() => mark(false)} className="py-5 rounded-2xl font-black text-lg bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5">
                    <CloseIcon className="w-5 h-5" /> Still Learning
                </button>
                <button onClick={() => mark(true)} className="py-5 rounded-2xl font-black text-lg bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5">
                    <CheckIcon className="w-5 h-5" /> Got It!
                </button>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-2">
                <button onClick={() => setState(p => ({ ...p, currentIndex: Math.max(0, p.currentIndex - 1), flipped: false }))} disabled={currentIndex === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 transition-colors">
                    <ArrowLeftIcon className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm font-black text-gray-400">{currentIndex + 1} / {total}</span>
                <button onClick={() => setState(p => ({ ...p, currentIndex: Math.min(cards.length - 1, p.currentIndex + 1), flipped: false }))} disabled={currentIndex === cards.length - 1} className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 transition-colors">
                    Next <ArrowRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const Balloon: React.FC<{ index: number }> = ({ index }) => {
    const left = Math.random() * 90;
    const delay = Math.random() * 2;
    const size = 30 + Math.random() * 20;
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'];
    const color = colors[index % colors.length];

    return (
        <div 
            className="fixed bottom-[-100px] animate-balloon-rise pointer-events-none z-[110]"
            style={{ 
                left: `${left}%`, 
                animationDelay: `${delay}s`,
                color: color,
                fontSize: `${size}px`
            }}
        >
            🎈
        </div>
    );
};

const QuizSummaryView: React.FC<{
    summary: QuizSummary;
    quiz: QuizQuestion[];
    userAnswers: any[];
    onStartNew: () => void;
    onRestart: () => void;
}> = ({ summary, quiz, userAnswers, onStartNew, onRestart }) => {
    const { t } = useLanguage();
    const [reviewMode, setReviewMode] = useState(false);
    
    // Performance derived values
    const score = summary.score;
    const isPerfect = score === 100;
    const isGreat = score >= 80;
    const isModerate = score >= 50 && score < 80;
    const isPoor = score < 50;

    const scoreColorClass = isPoor ? 'text-red-500' : isModerate ? 'text-yellow-500' : 'text-green-500';
    const scoreEmoji = isPerfect ? '🥳' : isGreat ? '😊' : isModerate ? '😐' : '😞';

    if (reviewMode) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                <button onClick={() => setReviewMode(false)} className="group flex items-center gap-2 text-sm font-black text-primary hover:underline uppercase tracking-widest mb-4">
                    <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform"/> Back to Summary
                </button>
                {quiz.map((q, index) => {
                    const ansObj = userAnswers[index];
                    let userAnswer = '';
                    let isCorrect = false;
                    let feedback = '';
                    
                    if (ansObj) {
                        if (typeof ansObj === 'object' && ansObj !== null) {
                            userAnswer = ansObj.answer;
                            isCorrect = ansObj.isCorrect;
                            feedback = ansObj.feedback || '';
                        } else {
                            userAnswer = ansObj as string;
                            isCorrect = q.options 
                                ? userAnswer === q.correctAnswer 
                                : userAnswer?.toLowerCase()?.trim() === (q.correctAnswer || '').toLowerCase().trim();
                        }
                    }
                    return (
                        <div key={index} className={`p-8 rounded-[2rem] border-2 shadow-sm ${isCorrect ? 'bg-green-50/50 dark:bg-green-900/10 border-green-500' : 'bg-red-50/50 dark:bg-red-900/10 border-red-500'}`}>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Question {index + 1}</p>
                            <div className="prose-lg dark:prose-invert max-w-none my-4 font-bold"><FormattedContent content={q.question} /></div>
                            <div className="mt-6 space-y-3">
                                <div className="p-4 bg-white/40 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Your answer</p>
                                    <p className="text-lg font-medium">{userAnswer || 'Not answered'}</p>
                                </div>
                                {!isCorrect && (
                                    <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                                        <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-1">Correct answer</p>
                                        <p className="text-lg font-bold text-green-700 dark:text-green-300"><FormattedContent content={q.correctAnswer} /></p>
                                    </div>
                                )}
                                {feedback && (
                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm font-bold uppercase tracking-widest text-blue-600 mb-1">AI Feedback</p>
                                        <p className="text-lg font-medium text-blue-700 dark:text-blue-300"><FormattedContent content={feedback} /></p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                 <button onClick={() => setReviewMode(false)} className="group flex items-center gap-2 text-sm font-black text-primary hover:underline mt-8 uppercase tracking-widest">
                    <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform"/> Back to Summary
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 text-center animate-fade-in relative">
            {isPerfect && (
                <div className="fixed inset-0 pointer-events-none overflow-visible z-[110]">
                    {Array.from({ length: 25 }).map((_, i) => <Balloon key={i} index={i} />)}
                </div>
            )}
            
            <div className="p-12 bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl border-2 border-gray-100 dark:border-gray-700 relative z-10">
                <h2 className="text-5xl font-black mb-2 text-gray-900 dark:text-white tracking-tight">{t('examprep.summary.title')} {scoreEmoji}</h2>
                
                <div className="relative inline-block my-12 overflow-visible">
                     <svg className="w-64 h-64 transform -rotate-90 block mx-auto overflow-visible" viewBox="-10 -10 244 244">
                        {/* Background track circle */}
                        <circle 
                            cx="112" 
                            cy="112" 
                            r="96" 
                            stroke="currentColor" 
                            strokeWidth="18" 
                            fill="transparent" 
                            className="text-gray-100 dark:text-gray-700" 
                        />
                        {/* Progress circle */}
                        <circle 
                            cx="112" 
                            cy="112" 
                            r="96" 
                            stroke="currentColor" 
                            strokeWidth="18" 
                            fill="transparent" 
                            className={`${scoreColorClass} transition-all duration-1000 ease-out`}
                            strokeDasharray={603.18} 
                            strokeDashoffset={603.18 * (1 - score / 100)} 
                            strokeLinecap="round" 
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className={`text-6xl font-black ${scoreColorClass}`}>{score.toFixed(0)}%</p>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-2">Proficiency</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left my-8">
                    <div className="p-8 bg-green-50 dark:bg-green-900/10 rounded-3xl border-2 border-green-100 dark:border-green-800/30 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="font-black text-xl text-green-700 dark:text-green-300 uppercase tracking-tight mb-4 flex items-center gap-2"><CheckIcon className="w-6 h-6" />{t('examprep.summary.strengths')}</h3>
                        {summary.strengths.length > 0 ? (
                            <ul className="space-y-3">
                                {summary.strengths.map((s, i) => <li key={i} className="flex items-start gap-3 text-md font-bold text-green-800 dark:text-green-200"><span>•</span> {s}</li>)}
                            </ul>
                        ) : <p className="text-sm text-gray-500 mt-2 italic">{t('examprep.summary.strengths.placeholder')}</p>}
                    </div>
                    <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border-2 border-red-100 dark:border-red-800/30 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="font-black text-xl text-red-700 dark:text-red-300 uppercase tracking-tight mb-4 flex items-center gap-2"><CloseIcon className="w-6 h-6" />{t('examprep.summary.weaknesses')}</h3>
                        {summary.weaknesses.length > 0 ? (
                            <ul className="space-y-3">
                                {summary.weaknesses.map((w, i) => <li key={i} className="flex items-start gap-3 text-md font-bold text-red-800 dark:text-green-200"><span>•</span> {w}</li>)}
                            </ul>
                        ) : 
                        <p className="text-sm text-gray-500 mt-2 italic">{t('examprep.summary.weaknesses.placeholder')}</p>}
                    </div>
                </div>
                
                <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border-2 border-blue-100 dark:border-blue-800/30 text-left shadow-sm">
                    <h3 className="font-black text-xl text-blue-700 dark:text-blue-300 uppercase tracking-tight mb-3">AI Coach Insight</h3>
                    {summary.recommendations.length > 0 ? (
                        <p className="text-lg text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                            {t('examprep.summary.recommendations.body', { topics: summary.recommendations.join(', ') })}
                        </p>
                    ) : <p className="text-lg text-blue-800 dark:text-blue-200 font-medium">Extraordinary performance! You have complete mastery of this material. Keep maintaining this level of focus.</p>}
                </div>

                <div className="flex flex-col sm:flex-row gap-6 mt-12">
                    <button onClick={() => setReviewMode(true)} className="flex-1 py-5 px-8 rounded-2xl text-lg font-black transition-all bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white uppercase tracking-widest shadow-lg">Review</button>
                    <button onClick={onRestart} className="flex-1 py-5 px-8 rounded-2xl text-lg font-black transition-all bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white uppercase tracking-widest shadow-lg">Restart</button>                    <button onClick={onStartNew} className="flex-1 py-5 px-8 rounded-2xl text-lg font-black transition-all bg-primary text-primary-text hover:bg-primary-dark shadow-2xl shadow-primary/30 uppercase tracking-widest">
                        {t('examprep.summary.newQuiz')}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes balloon-rise {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(-120vh) rotate(20deg); opacity: 0; }
                }
                .animate-balloon-rise {
                    animation: balloon-rise 6s linear forwards;
                }
            `}</style>
        </div>
    );
};

const getLangCodeForSpeech = (lang: Language) => {
    const map: Record<Language, string> = {
        en: 'en-US',
        es: 'es-ES',
        fr: 'fr-FR',
        de: 'de-DE',
        ja: 'ja-JP',
        zh: 'zh-CN',
    };
    return map[lang] || 'en-US';
}


export const ExamPrep: React.FC<ExamPrepProps> = ({
    addToast,
    setView,
    generationState,
    setGenerationState,
    quizState,
    setQuizState,
    flashcardState,
    setFlashcardState,
    notes,
    setNotes,
    examPrepState,
    setExamPrepState,
    onGenerateQuizAttempt,
    onSolveProblemAttempt,
    onSaveQuizToHistory,
}) => {
    const { t, language } = useLanguage();
    const { mode, numQuestions, quizType, uploadedFiles, focusArea, questionImage, questionText, solution, outputFormat, programmingLanguage, graphInterval, graphYInterval, graphConfig, quizTimerMinutes, numFlashcards, flashcardFiles, flashcardDifficulty, quizDifficulty } = examPrepState;
    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
    
    const updateState = <K extends keyof ExamPrepState>(key: K, value: ExamPrepState[K]) => {
        setExamPrepState(prev => ({...prev, [key]: value}));
    }

    useEffect(() => {
        if (mode === 'solve') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                const recognition = recognitionRef.current;
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = getLangCodeForSpeech(language);

                recognition.onresult = (event: any) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalTranscript) {
                        setExamPrepState(prev => ({...prev, questionText: prev.questionText + finalTranscript.trim() + ' '}));
                    }
                };

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

            return () => {
                if (recognitionRef.current) {
                    recognitionRef.current.stop();
                }
            };
        }
    }, [mode, addToast, t, language, setExamPrepState]);

    const handleMicClick = () => {
        if (!recognitionRef.current) {
            addToast(t('toasts.examprep.speechUnsupported'), 'error');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            if (questionText.trim() && !questionText.endsWith(' ')) {
                setExamPrepState(prev => ({...prev, questionText: prev.questionText + ' '}));
            }
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (mode === 'quiz' || mode === 'flashcard') {
            const validFiles = acceptedFiles.filter(file => {
                if (file.size > 25 * 1024 * 1024) { 
                    addToast(t('toasts.fileSizeTooLarge', {fileName: file.name, size: 25}), 'error');
                    return false;
                }
                return true;
            });
            if (validFiles.length > 0) {
                if (mode === 'flashcard') {
                    updateState('flashcardFiles', [...flashcardFiles, ...validFiles]);
                } else {
                    updateState('uploadedFiles', [...uploadedFiles, ...validFiles]);
                }
                addToast(t('toasts.filesAdded', {count: validFiles.length}), 'success');
            }
        } else { 
            const file = acceptedFiles[0];
            if (file && file.type.startsWith('image/')) {
                if (file.size > 25 * 1024 * 1024) { 
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
    }, [mode, uploadedFiles, flashcardFiles, addToast, t, updateState]);
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true } as any);

    const removeFile = (index: number) => {
        const newFiles = [...uploadedFiles];
        newFiles.splice(index, 1);
        updateState('uploadedFiles', newFiles);
    };

    const handleGenerateQuiz = () => {
        onGenerateQuizAttempt(async () => {
            if (uploadedFiles.length === 0) {
                addToast(t('toasts.examprep.noFiles'), 'warning');
                return;
            }
    
            setGenerationState({ isLoading: true, message: t('examprep.verifying'), error: null, source: 'quiz' });
    
            try {
                // ── Read all files — resolve mimeType from extension if browser leaves it empty ──
                const resolveMime = (f: File) => {
                    if (f.type && f.type !== 'application/octet-stream') return f.type;
                    const ext = f.name.split('.').pop()?.toLowerCase() || '';
                    const m: Record<string,string> = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', txt:'text/plain', md:'text/plain', csv:'text/csv' };
                    return m[ext] || 'application/pdf';
                };

                const fileDataList = await Promise.all(uploadedFiles.map(file =>
                    new Promise<{ base64: string; mimeType: string; name: string }>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const result = reader.result as string;
                            const comma = result.indexOf(',');
                            resolve({ base64: comma >= 0 ? result.slice(comma + 1) : result, mimeType: resolveMime(file), name: file.name });
                        };
                        reader.onerror = () => reject(new Error(`Could not read "${file.name}"`));
                        reader.readAsDataURL(file);
                    })
                ));

                // Extract text directly — no validity gate, always trust the user
                const extractResults = await Promise.all(
                    fileDataList.map(({ base64, mimeType, name }) =>
                        verifyAndExtract({ inlineData: { data: base64, mimeType } })
                            .then(r => ({ text: r.text || '', name }))
                            .catch(() => ({ text: '', name }))
                    )
                );

                let combinedContent = '';
                for (const r of extractResults) {
                    combinedContent += (r.text || '') + '\n\n';
                }
                
                const MAX_CONTEXT = 30000;
                if(combinedContent.length > MAX_CONTEXT) {
                    combinedContent = combinedContent.substring(0, MAX_CONTEXT);
                    addToast(t('toasts.quizContentTruncated'), 'warning');
                }
    
                if (!combinedContent.trim()) {
                    throw new Error('The AI could not read text from your file. Please make sure the file is not scanned/image-only, or try a different file.');
                }
    
                setGenerationState(prev => ({ ...prev, message: t('examprep.creatingQuiz') }));
                const questions = await generateQuiz(combinedContent, numQuestions, quizType, focusArea, quizDifficulty);
                
                if (questions && questions.length > 0) {
                    const timerSecs = quizTimerMinutes > 0 ? quizTimerMinutes * 60 : null;
                    setQuizState({ quiz: questions, currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null, timerSeconds: timerSecs });
                    setGenerationState({ isLoading: false, message: '', error: null, source: null });
                } else {
                    throw new Error(t('examprep.error.noQuestions'));
                }
            } catch (error: any) {
                addToast(error.message || t('examprep.error.generic'), 'error');
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
            }
        });
    };

    const handleTimeUp = () => {
        // Score based on answered questions only, treating unanswered as wrong
        const quiz = quizState.quiz;
        const userAnswers = quizState.userAnswers;

        const correctAnswersCount = userAnswers.reduce((count, ansObj, index) => {
            const q = quiz[index];
            if (!q) return count;
            
            let isCorrect = false;
            if (typeof ansObj === 'object' && ansObj !== null) {
                isCorrect = ansObj.isCorrect;
            } else {
                const answer = ansObj as string;
                isCorrect = q.options
                    ? answer === q.correctAnswer
                    : answer?.toLowerCase()?.trim() === (q.correctAnswer || '').toLowerCase().trim();
            }
            return isCorrect ? count + 1 : count;
        }, 0);

        const answeredCount = userAnswers.length;
        const score = answeredCount > 0 ? (correctAnswersCount / answeredCount) * 100 : 0;

        const topicPerformance: Record<string, { correct: number; total: number }> = {};
        quiz.forEach((q, i) => {
            const topic = q.topic || 'General';
            if (!topicPerformance[topic]) topicPerformance[topic] = { correct: 0, total: 0 };
            topicPerformance[topic].total++;
            const ansObj = userAnswers[i];
            let isCorrect = false;
            if (ansObj) {
                if (typeof ansObj === 'object' && ansObj !== null) {
                    isCorrect = ansObj.isCorrect;
                } else {
                    const answer = ansObj as string;
                    isCorrect = q.options
                        ? answer === q.correctAnswer
                        : answer?.toLowerCase()?.trim() === (q.correctAnswer || '').toLowerCase().trim();
                }
            }
            if (isCorrect) topicPerformance[topic].correct++;
        });

        const strengths = Object.keys(topicPerformance).filter(t => topicPerformance[t].correct / topicPerformance[t].total > 0.7);
        const weaknesses = Object.keys(topicPerformance).filter(t => topicPerformance[t].correct / topicPerformance[t].total <= 0.7);

        addToast(`⏰ Time's up! Scored on ${answeredCount} answered question${answeredCount !== 1 ? 's' : ''}.`, 'warning');

        const summary = { score, strengths, weaknesses, recommendations: weaknesses };

        if (onSaveQuizToHistory) {
            onSaveQuizToHistory(quiz, userAnswers, summary, examPrepState.focusArea).catch(e => console.error('Failed to save history', e));
        }

        setQuizState(prev => ({
            ...prev,
            summary,
            feedback: null,
        }));
    };

    const handleGenerateFlashcards = () => {
        onGenerateQuizAttempt(async () => {
            if (flashcardFiles.length === 0) {
                addToast('Please upload at least one file to generate flashcards.', 'warning');
                return;
            }
            setGenerationState({ isLoading: true, message: `Generating ${flashcardDifficulty} flashcards…`, error: null, source: 'quiz' });
            try {
                // ── Read all flashcard files — resolve mimeType from extension ──
                const resolveMimeFC = (f: File) => {
                    if (f.type && f.type !== 'application/octet-stream') return f.type;
                    const ext = f.name.split('.').pop()?.toLowerCase() || '';
                    const m: Record<string,string> = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', txt:'text/plain', md:'text/plain', csv:'text/csv' };
                    return m[ext] || 'application/pdf';
                };

                const flashFileDataList = await Promise.all(flashcardFiles.map(file =>
                    new Promise<{ base64: string; mimeType: string; name: string }>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const result = reader.result as string;
                            const comma = result.indexOf(',');
                            resolve({ base64: comma >= 0 ? result.slice(comma + 1) : result, mimeType: resolveMimeFC(file), name: file.name });
                        };
                        reader.onerror = () => reject(new Error(`Could not read "${file.name}"`));
                        reader.readAsDataURL(file);
                    })
                ));

                const flashExtractResults = await Promise.all(
                    flashFileDataList.map(({ base64, mimeType, name }) =>
                        verifyAndExtract({ inlineData: { data: base64, mimeType } })
                            .then(r => ({ text: r.text || '', name }))
                            .catch(() => ({ text: '', name }))
                    )
                );

                let combinedContent = '';
                for (const r of flashExtractResults) {
                    combinedContent += (r.text || '') + '\n\n';
                }
                if (!combinedContent.trim()) throw new Error('The AI could not read text from your file. Please make sure the file is not scanned/image-only, or try a different file.');
                if (combinedContent.length > 30000) combinedContent = combinedContent.substring(0, 30000);

                const cards = await generateFlashcards(combinedContent, numFlashcards, focusArea, flashcardDifficulty);
                if (!cards || cards.length === 0) throw new Error('Could not generate flashcards. Try different files.');

                setFlashcardState({ cards, currentIndex: 0, flipped: false, known: [], unknown: [], sessionDone: false });
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
                addToast(`Created ${cards.length} ${flashcardDifficulty} flashcards!`, 'success');
            } catch (error: any) {
                addToast(error.message || 'Failed to generate flashcards.', 'error');
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
            }
        });
    };

    const handleAnswerSubmit = async (answer: string) => {
        const currentQuestion = quizState.quiz[quizState.currentQuestionIndex];
        
        let isCorrect = false;
        let explanation = currentQuestion.explanation;

        if (currentQuestion.options) {
            // MCQ
            isCorrect = answer === currentQuestion.correctAnswer;
        } else {
            // Conceptual
            setGenerationState({ isLoading: true, message: 'Evaluating answer...', error: null, source: 'quiz' });
            try {
                const { evaluateConceptualAnswer } = await import('../services/geminiService');
                const result = await evaluateConceptualAnswer(currentQuestion.question, currentQuestion.correctAnswer, answer);
                isCorrect = result.isCorrect;
                explanation = result.feedback;
            } catch (e) {
                isCorrect = (currentQuestion.correctAnswer || '').toLowerCase().trim() === answer?.toLowerCase()?.trim();
            }
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }

        setQuizState(prev => ({
            ...prev,
            userAnswers: [...prev.userAnswers, { answer, isCorrect }],
            feedback: { isCorrect, explanation }
        }));
    };

    const handleNextQuestion = () => {
        try {
            if (quizState.currentQuestionIndex < quizState.quiz.length - 1) {
                setQuizState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1, feedback: null }));
            } else {
                // Defensive calculation of summary
                const quiz = quizState.quiz;
                const userAnswers = quizState.userAnswers;

                const correctAnswersCount = userAnswers.reduce((count, ansObj, index) => {
                    const q = quiz[index];
                    if (!q) return count;
                    let isCorrect = false;
                    if (typeof ansObj === 'object' && ansObj !== null) {
                        isCorrect = ansObj.isCorrect;
                    } else {
                        const answer = ansObj as string;
                        isCorrect = q.options 
                            ? answer === q.correctAnswer 
                            : answer?.toLowerCase()?.trim() === (q.correctAnswer || '').toLowerCase().trim();
                    }
                    return isCorrect ? count + 1 : count;
                }, 0);

                const answeredCount = userAnswers.length;
                const score = answeredCount > 0 ? (correctAnswersCount / answeredCount) * 100 : 0;
                
                // Track performance per topic
                const topicPerformance: Record<string, {correct: number, total: number}> = {};
                
                quiz.forEach((q, i) => {
                    const topic = q.topic || 'General';
                    const ansObj = userAnswers[i];
                    
                    if (!topicPerformance[topic]) {
                        topicPerformance[topic] = { correct: 0, total: 0 };
                    }
                    
                    topicPerformance[topic].total++;
                    let isCorrect = false;
                    if (ansObj) {
                        if (typeof ansObj === 'object' && ansObj !== null) {
                            isCorrect = ansObj.isCorrect;
                        } else {
                            const answer = ansObj as string;
                            isCorrect = q.options 
                                ? answer === q.correctAnswer
                                : answer?.toLowerCase()?.trim() === (q.correctAnswer || '').toLowerCase().trim();
                        }
                    }
                    
                    if (isCorrect) {
                        topicPerformance[topic].correct++;
                    }
                });
                
                const strengths = Object.keys(topicPerformance).filter(t => topicPerformance[t].correct / topicPerformance[t].total > 0.7);
                const weaknesses = Object.keys(topicPerformance).filter(t => topicPerformance[t].correct / topicPerformance[t].total <= 0.7);

                const summary: QuizSummary = { 
                    score, 
                    strengths, 
                    weaknesses, 
                    recommendations: weaknesses 
                };
                
                if (onSaveQuizToHistory) {
                    onSaveQuizToHistory(quiz, userAnswers, summary, examPrepState.focusArea).catch(e => console.error('Failed to save history', e));
                }

                setQuizState(prev => ({ ...prev, summary, feedback: null }));
            }
        } catch (error) {
            console.error("Error generating quiz summary:", error);
            addToast("Failed to generate results summary.", "error");
            // Fallback to minimal summary if calc fails
            setQuizState(prev => ({ 
                ...prev, 
                summary: { score: 0, strengths: [], weaknesses: [], recommendations: [] }, 
                feedback: null 
            }));
        }
    };
    
    const resetQuiz = () => {
        setQuizState({ quiz: [], currentQuestionIndex: 0, userAnswers: [], feedback: null, summary: null, timerSeconds: null });
    };

    const handleSolveProblem = () => {
        onSolveProblemAttempt(async () => {
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
                    
                    // Verification skipped — solver handles any image gracefully
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
                        let graphData: any;
                        if (typeof result === 'string' && result.includes('{')) {
                            let cleanResult = result;
                            // Fix bad unicode escapes (\u not followed by 4 hex digits)
                            cleanResult = cleanResult.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
                            // Fix other invalid escapes
                            cleanResult = cleanResult.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
                            try {
                                graphData = JSON.parse(cleanResult);
                            } catch (e) {
                                // Fallback without cleaning if it fails
                                graphData = JSON.parse(result);
                            }
                        } else {
                            graphData = result;
                        }
                        
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

                        // Deterministic but safe config for the plotter
                        const plotterConfig = plotter.parseInterval(graphInterval);
                        const smartInterval = plotter.determineSmartInterval(functions[0]);
                        
                        const xMin = plotterConfig?.xMin ?? smartInterval.xMin;
                        const xMax = plotterConfig?.xMax ?? smartInterval.xMax;
                        const samples = plotterConfig?.samples ?? 200;
                        
                        const datasets = functions.map((func: string, index: number) => {
                            const points = plotter.generatePoints({
                                expr: func,
                                xMin,
                                xMax,
                                samples,
                                angleMode: plotterConfig?.angleMode || 'radians'
                            });
                            
                            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#ec4899'];
                            
                            return {
                                label: func.replace(/Math\./g, ''),
                                data: points,
                                borderColor: colors[index % colors.length],
                                backgroundColor: colors[index % colors.length],
                                fill: false,
                                pointRadius: 0,
                                tension: 0.3
                            };
                        });
                        
                        updateState('graphConfig', {
                            type: 'line',
                            data: { datasets },
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
                        updateState('solution', typeof result === 'string' ? result : JSON.stringify(result, null, 2));
                        updateState('graphConfig', null);
                    }
                } else {
                    updateState('solution', result);
                    updateState('graphConfig', null);
                }
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
            } catch (error: any) {
                addToast(error.message || t('toasts.error.solveProblem'), 'error');
                setGenerationState({ isLoading: false, message: '', error: null, source: null });
            }
        });
    };

    if (quizState.summary) {
        return <QuizSummaryView summary={quizState.summary} quiz={quizState.quiz} userAnswers={quizState.userAnswers} onStartNew={resetQuiz} onRestart={() => setQuizState(prev => ({ ...prev, summary: null, currentQuestionIndex: 0, userAnswers: [], feedback: null, timerSeconds: prev.timerSeconds }))} />;
    }

    if (quizState.quiz.length > 0) {
        return <QuizRunner quiz={quizState.quiz} currentQuestionIndex={quizState.currentQuestionIndex} feedback={quizState.feedback} timerSeconds={quizState.timerSeconds} isEvaluating={generationState.isLoading && generationState.source === 'quiz'} onAnswerSubmit={handleAnswerSubmit} onNextQuestion={handleNextQuestion} onTimeUp={handleTimeUp} onCancel={resetQuiz} />;
    }

    if (flashcardState.cards.length > 0) {
        return <FlashcardView state={flashcardState} setState={setFlashcardState} difficulty={flashcardDifficulty} onDone={() => setFlashcardState({ cards: [], currentIndex: 0, flipped: false, known: [], unknown: [], sessionDone: false })} onCancel={() => setFlashcardState({ cards: [], currentIndex: 0, flipped: false, known: [], unknown: [], sessionDone: false })} />;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
            <div className="flex justify-between items-end">
                <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{t('examprep.main.title')}</h2>
                <div className="relative group">
                    <button className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl font-bold text-sm shadow-sm hover:border-primary transition-all">
                        Quick Options
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 overflow-hidden">
                        <button onClick={() => updateState('mode', 'quiz')} className="w-full text-left px-4 py-3 hover:bg-primary/10 font-bold text-sm transition-colors border-b dark:border-gray-700">Practice Quiz</button>
                        <button onClick={() => updateState('mode', 'solve')} className="w-full text-left px-4 py-3 hover:bg-primary/10 font-bold text-sm transition-colors">AI Problem Solver</button>
                    </div>
                </div>
            </div>

            <div className="flex bg-gray-200 dark:bg-gray-700/50 backdrop-blur-sm rounded-2xl p-1.5 shadow-inner border border-gray-100 dark:border-gray-700">
                <button
                    onClick={() => updateState('mode', 'quiz')}
                    className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                        mode === 'quiz' 
                        ? 'bg-white dark:bg-gray-800 shadow-xl text-primary' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    {t('examprep.tab.quiz')}
                </button>
                <button
                    onClick={() => updateState('mode', 'flashcard')}
                    className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                        mode === 'flashcard' 
                        ? 'bg-white dark:bg-gray-800 shadow-xl text-primary' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    🃏 Flashcards
                </button>
                <button
                    onClick={() => updateState('mode', 'solve')}
                    className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                        mode === 'solve' 
                        ? 'bg-white dark:bg-gray-800 shadow-xl text-primary' 
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    {t('examprep.tab.solver')}
                </button>
            </div>

            {mode === 'quiz' && (
                <div className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-8 md:p-12 space-y-10 border-2 border-gray-100 dark:border-gray-700">
                    <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'quiz'} message={generationState.message} />
                    <div className="text-center space-y-2">
                        <h3 className="text-4xl font-black text-gray-900 dark:text-white">{t('examprep.quiz.title')}</h3>
                        <p className="text-gray-500 max-w-md mx-auto text-lg font-medium">{t('examprep.quiz.intro')}</p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">{t('examprep.quiz.step1')}</h4>
                        <div {...getRootProps({ className: `p-10 border-4 border-dashed rounded-[2rem] text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-inner'}`})}>
                            <input {...getInputProps()} />
                            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <UploadIcon className="w-10 h-10 text-primary" />
                            </div>
                            <p className="text-xl font-black text-gray-800 dark:text-gray-200">{t('examprep.quiz.dropzone.click')}</p>
                            <p className="text-sm text-gray-400 mt-2 font-bold">{t('examprep.quiz.dropzone.hint')}</p>
                        </div>
                        {uploadedFiles.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                {uploadedFiles.map((file, index) => {
                                    const isImg = file.type.startsWith('image/');
                                    const previewUrl = isImg ? URL.createObjectURL(file) : null;
                                    return (
                                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 shadow-sm">
                                            <div className="flex items-center gap-4 overflow-hidden flex-1 min-w-0">
                                                {isImg && previewUrl ? (
                                                    <button onClick={() => setLightboxSrc(previewUrl)} className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-primary transition-all" title="Click to enlarge">
                                                        <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                                                    </button>
                                                ) : (
                                                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0"><DocumentIcon className="w-5 h-5 text-primary" /></div>
                                                )}
                                                <span className="truncate text-sm font-black text-gray-700 dark:text-gray-300">{file.name}</span>
                                            </div>
                                            <button onClick={() => removeFile(index)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-colors flex-shrink-0"><CloseIcon className="w-5 h-5" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">{t('examprep.quiz.step2')}</h4>
                        <input type="text" value={focusArea} onChange={(e) => updateState('focusArea', e.target.value)} placeholder={t('examprep.quiz.focusPlaceholder')} className="w-full px-6 py-5 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-bold text-lg shadow-sm placeholder:text-gray-300" />
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">{t('examprep.quiz.step3')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                             <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">{t('examprep.quiz.numQuestions')}</label>
                                <input type="number" value={numQuestions} onChange={(e) => updateState('numQuestions', Math.max(1, parseInt(e.target.value, 10)))} min="1" max="20" className="w-full px-6 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-black text-xl shadow-sm" />
                            </div>
                            <CustomDropdown 
                                label={t('examprep.quiz.quizType')} 
                                value={quizType} 
                                options={[
                                    { value: QuizType.MCQ, label: t('quizType.mcq') },
                                    { value: QuizType.CONCEPTUAL, label: t('quizType.conceptual') },
                                    { value: QuizType.THEORY, label: t('quizType.theory') },
                                ]} 
                                onChange={(val) => updateState('quizType', val)}
                                icon={<QuizIcon className="w-5 h-5" />}
                            />
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">⏱ Timer (minutes, 0 = off)</label>
                                <input type="number" value={quizTimerMinutes} onChange={(e) => updateState('quizTimerMinutes', Math.max(0, parseInt(e.target.value, 10) || 0))} min="0" max="120" className="w-full px-6 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-black text-xl shadow-sm" />
                                {quizTimerMinutes > 0 && <p className="text-xs text-orange-500 font-bold px-1">⚠ Time up → scored on answered only</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">Step 4 — Difficulty Level</h4>
                        <div className="grid grid-cols-3 gap-4">
                            {([
                                { value: 'easy', emoji: '🟢', label: 'Easy', desc: 'Basic recall & definitions' },
                                { value: 'moderate', emoji: '🟡', label: 'Moderate', desc: 'Understanding & application' },
                                { value: 'hard', emoji: '🔴', label: 'Hard', desc: 'Analysis & critical thinking' },
                            ] as const).map(({ value, emoji, label, desc }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateState('quizDifficulty', value)}
                                    className={`p-5 rounded-2xl border-2 text-center transition-all ${
                                        quizDifficulty === value
                                            ? value === 'easy' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-4 ring-green-500/20'
                                            : value === 'moderate' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 ring-4 ring-yellow-500/20'
                                            : 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-4 ring-red-500/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <div className="text-2xl mb-1">{emoji}</div>
                                    <p className="font-black text-gray-900 dark:text-white text-sm">{label}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 leading-tight">{desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button onClick={handleGenerateQuiz} disabled={generationState.isLoading || uploadedFiles.length === 0} className="w-full py-6 bg-primary text-primary-text font-black text-2xl rounded-3xl shadow-2xl shadow-primary/30 hover:bg-primary-dark hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 transition-all">
                        {t('examprep.quiz.generate')}
                    </button>
                </div>
            )}

            {mode === 'flashcard' && (
                <div className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-8 md:p-12 space-y-10 border-2 border-gray-100 dark:border-gray-700">
                    <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'quiz'} message={generationState.message} />
                    <div className="text-center space-y-2">
                        <div className="text-5xl mb-2">🃏</div>
                        <h3 className="text-4xl font-black text-gray-900 dark:text-white">Flashcard Generator</h3>
                        <p className="text-gray-500 max-w-md mx-auto text-lg font-medium">Upload your study material — PDFs, images, or documents — and study with AI-generated flashcards.</p>
                    </div>

                    {/* Step 1: Own file dropzone for flashcards only */}
                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">Step 1 — Upload Study Material</h4>
                        <div
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.multiple = true;
                                input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.txt,.ppt,.pptx';
                                input.onchange = (e) => {
                                    const files = Array.from((e.target as HTMLInputElement).files || []);
                                    const valid = files.filter(f => {
                                        if (f.size > 25 * 1024 * 1024) { addToast(t('toasts.fileSizeTooLarge', {fileName: f.name, size: 25}), 'error'); return false; }
                                        return true;
                                    });
                                    if (valid.length > 0) {
                                        updateState('flashcardFiles', [...flashcardFiles, ...valid]);
                                        addToast(`${valid.length} file${valid.length > 1 ? 's' : ''} added`, 'success');
                                    }
                                };
                                input.click();
                            }}
                            className="p-10 border-4 border-dashed rounded-[2rem] text-center cursor-pointer transition-all duration-300 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 shadow-inner"
                        >
                            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <UploadIcon className="w-10 h-10 text-primary" />
                            </div>
                            <p className="text-xl font-black text-gray-800 dark:text-gray-200">Click to upload files</p>
                            <p className="text-sm text-gray-400 mt-2 font-bold">PDF, PNG, JPG, DOCX, PPT, TXT — up to 25 MB each</p>
                        </div>
                        {flashcardFiles.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                {flashcardFiles.map((file, index) => {
                                    const isImg = file.type.startsWith('image/');
                                    const previewUrl = isImg ? URL.createObjectURL(file) : null;
                                    return (
                                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                                {isImg && previewUrl ? (
                                                    <button onClick={() => setLightboxSrc(previewUrl)} className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-primary transition-all" title="Click to enlarge">
                                                        <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                                                    </button>
                                                ) : (
                                                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                                                        <span className="text-xs font-black text-primary uppercase">{file.name.split('.').pop()}</span>
                                                    </div>
                                                )}
                                                <span className="truncate text-sm font-black text-gray-700 dark:text-gray-300">{file.name}</span>
                                            </div>
                                            <button onClick={() => { const f = [...flashcardFiles]; f.splice(index,1); updateState('flashcardFiles', f); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-colors flex-shrink-0"><CloseIcon className="w-5 h-5" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Focus area */}
                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">Step 2 — Focus Area (optional)</h4>
                        <input type="text" value={focusArea} onChange={(e) => updateState('focusArea', e.target.value)} placeholder="e.g. Cell biology, World War II dates, Newton's laws…" className="w-full px-6 py-5 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-bold text-lg shadow-sm placeholder:text-gray-300" />
                    </div>

                    {/* Step 3: Difficulty */}
                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">Step 3 — Difficulty Level</h4>
                        <div className="grid grid-cols-3 gap-4">
                            {([
                                { value: 'easy', emoji: '🟢', label: 'Easy', desc: 'Basic terms & definitions' },
                                { value: 'moderate', emoji: '🟡', label: 'Moderate', desc: 'Concepts & understanding' },
                                { value: 'hard', emoji: '🔴', label: 'Hard', desc: 'Deep analysis & application' },
                            ] as const).map(({ value, emoji, label, desc }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateState('flashcardDifficulty', value)}
                                    className={`p-5 rounded-2xl border-2 text-center transition-all ${
                                        flashcardDifficulty === value
                                            ? value === 'easy' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-4 ring-green-500/20'
                                            : value === 'moderate' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 ring-4 ring-yellow-500/20'
                                            : 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-4 ring-red-500/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <div className="text-2xl mb-1">{emoji}</div>
                                    <p className="font-black text-gray-900 dark:text-white text-sm">{label}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 leading-tight">{desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 4: Number of cards */}
                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">Step 4 — Number of Cards</h4>
                        <div className="flex items-center gap-4">
                            <input type="range" min="5" max="40" step="5" value={numFlashcards} onChange={e => updateState('numFlashcards', parseInt(e.target.value))} className="flex-1 accent-primary" />
                            <span className="font-black text-3xl text-primary w-14 text-center">{numFlashcards}</span>
                        </div>
                        <p className="text-xs text-gray-400 font-bold">{numFlashcards} {flashcardDifficulty} cards from your material</p>
                    </div>

                    <button onClick={handleGenerateFlashcards} disabled={generationState.isLoading || flashcardFiles.length === 0} className="w-full py-6 bg-primary text-primary-text font-black text-2xl rounded-3xl shadow-2xl shadow-primary/30 hover:bg-primary-dark hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 transition-all">
                        🃏 Generate Flashcards
                    </button>
                </div>
            )}

            {mode === 'solve' && (
                <div className="relative bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-8 md:p-12 space-y-10 border-2 border-gray-100 dark:border-gray-700">
                    <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'solve'} message={generationState.message} />
                     <div className="flex justify-between items-center pb-6 border-b-2 dark:border-gray-700">
                        <div className="text-left flex-1">
                            <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{t('examprep.solver.title')}</h3>
                            <p className="text-gray-500 font-bold mt-1">{t('examprep.solver.intro')}</p>
                        </div>
                        <button onClick={() => { updateState('questionText', ''); updateState('questionImage', null); updateState('solution', null); updateState('graphConfig', null); }} className="px-6 py-2.5 text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors border-2 border-transparent hover:border-red-200">
                            {t('examprep.solver.clear')}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">{t('examprep.solver.step1')}</h4>
                        <textarea value={questionText} onChange={(e) => updateState('questionText', e.target.value)} rows={4} placeholder={t('examprep.solver.questionPlaceholder')} className="w-full px-8 py-6 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-[2.5rem] focus:ring-4 focus:ring-primary/20 transition-all font-bold text-xl leading-relaxed shadow-inner placeholder:text-gray-200" />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
                            <div {...getRootProps({ className: `p-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-center cursor-pointer transition-all flex flex-col items-center justify-center h-40 shadow-sm ${isDragActive ? 'border-primary bg-primary/5 scale-105' : 'hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`})}>
                                <input {...getInputProps()} accept="image/*" />
                                <UploadIcon className="w-10 h-10 mb-3 text-primary" />
                                <span className="font-black text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400">{t('examprep.solver.uploadImage')}</span>
                            </div>

                            <button onClick={() => setIsCameraModalOpen(true)} className="p-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex flex-col items-center justify-center h-40 group shadow-sm">
                                <CameraIcon className="w-10 h-10 mb-3 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-black text-xs uppercase tracking-widest text-gray-600 dark:text-gray-400">{t('examprep.solver.useCamera')}</span>
                            </button>

                            <button onClick={handleMicClick} className={`p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all h-40 flex flex-col items-center justify-center group shadow-sm ${isListening ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                <MicrophoneIcon className={`w-10 h-10 mb-3 ${isListening ? 'text-red-500 animate-pulse' : 'text-primary group-hover:scale-110 transition-transform'}`} />
                                <span className={`font-black text-xs uppercase tracking-widest ${isListening ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>{isListening ? t('examprep.solver.stopMic') : t('examprep.solver.useMic')}</span>
                            </button>
                        </div>

                        {questionImage && (
                            <div className="mt-8 flex justify-center">
                                <div className="relative group inline-block">
                                    <button onClick={() => setLightboxSrc(questionImage)} className="block focus:outline-none" title="Click to enlarge">
                                        <img src={questionImage} alt={t('examprep.solver.alt.questionPreview')} className="max-h-64 rounded-3xl shadow-2xl border-8 border-white dark:border-gray-700 transform rotate-1 group-hover:rotate-0 group-hover:scale-[1.02] transition-all duration-300 cursor-zoom-in" />
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">🔍 Tap to enlarge</div>
                                    </button>
                                    <button onClick={() => updateState('questionImage', null)} className="absolute -top-4 -right-4 bg-red-600 text-white rounded-full p-3 shadow-2xl hover:bg-red-700 transition-colors z-10 border-4 border-white dark:border-gray-800">
                                        <CloseIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary">{t('examprep.solver.step2')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <CustomDropdown 
                                label={t('examprep.solver.outputFormat')} 
                                value={outputFormat} 
                                options={[
                                    { value: "steps", label: t('examprep.solver.format.steps') },
                                    { value: "latex", label: t('examprep.solver.format.latex') },
                                    { value: "code", label: t('examprep.solver.format.code') },
                                    { value: "graph", label: t('examprep.solver.format.graph') },
                                ]} 
                                onChange={(val) => updateState('outputFormat', val)}
                                icon={<CheckIcon className="w-5 h-5" />}
                            />

                            {outputFormat === 'code' && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">{t('examprep.solver.language')}</label>
                                    <input type="text" value={programmingLanguage} onChange={(e) => updateState('programmingLanguage', e.target.value)} className="w-full px-6 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-black text-xl shadow-sm"/>
                                </div>
                            )}
                             {outputFormat === 'graph' && (
                                <div className="sm:col-span-2 grid grid-cols-2 gap-6 animate-fade-in-down">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">{t('examprep.solver.graphInterval')}</label>
                                        <input type="text" value={graphInterval} onChange={(e) => updateState('graphInterval', e.target.value)} placeholder={t('examprep.solver.graphIntervalPlaceholder')} className="w-full px-6 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-black text-xl shadow-sm"/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">{t('examprep.solver.graphYInterval')}</label>
                                        <input type="text" value={graphYInterval} onChange={(e) => updateState('graphYInterval', e.target.value)} placeholder={t('examprep.solver.graphYIntervalPlaceholder')} className="w-full px-6 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-black text-xl shadow-sm"/>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button onClick={handleSolveProblem} disabled={generationState.isLoading} className="w-full py-6 bg-primary text-primary-text font-black text-2xl rounded-3xl shadow-2xl shadow-primary/30 hover:bg-primary-dark hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 transition-all">
                       {t('examprep.solver.solve')}
                    </button>

                    {solution && (
                        <div className="pt-16 border-t-4 border-gray-100 dark:border-gray-700 space-y-10 animate-fade-in">
                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{t('examprep.solution.title')}</h3>
                                {outputFormat !== 'graph' && (
                                     <div className="flex items-center gap-4">
                                        <button onClick={() => { navigator.clipboard.writeText(solution); addToast(t('toasts.solutionCopied'), 'success'); }} className="flex items-center gap-3 px-6 py-3 text-md font-black bg-gray-100 dark:bg-gray-700 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"><CopyIcon className="w-5 h-5"/> {t('examprep.solution.copyFull')}</button>
                                        <button onClick={() => { const newNote = { id: Date.now().toString() + Math.random().toString(), title: `Solution: ${questionText.substring(0, 30)}...`, content: solution, subject: 'Problem Solving', createdAt: new Date().toISOString(), isFavourite: false }; setNotes([newNote, ...notes]); addToast(t('toasts.solutionSaved'), 'success'); }} className="flex items-center gap-3 px-6 py-3 text-md font-black bg-gray-100 dark:bg-gray-700 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"><SaveIcon className="w-5 h-5"/> {t('examprep.solution.saveFull')}</button>
                                    </div>
                                )}
                            </div>
                            {outputFormat === 'graph' ? (
                                <div className="space-y-10">
                                    <div className="p-10 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 shadow-inner">
                                        <h4 className="font-black text-xs uppercase tracking-widest text-primary mb-6">{t('examprep.solution.explanationTitle')}</h4>
                                        <div className="prose-lg dark:prose-invert max-w-none"><FormattedContent content={solution} /></div>
                                    </div>
                                    {graphConfig && (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 shadow-sm">
                                                <h4 className="font-black text-xl text-gray-800 dark:text-gray-200">{(graphConfig.options?.plugins?.title?.text || "Analytical Visualization")}</h4>
                                                <div className="px-4 py-2 bg-primary/10 rounded-full">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Hover for coordinates (x, y)</p>
                                                </div>
                                            </div>
                                            <GraphRenderer chartConfig={graphConfig} canvasRef={graphCanvasRef} />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-10 bg-gray-50 dark:bg-gray-900/50 rounded-[3rem] border-2 border-gray-100 dark:border-gray-800 shadow-inner overflow-x-auto">
                                    <FormattedContent content={solution} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            <CameraCaptureModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onCapture={(imageDataUrl) => {
                    updateState('questionImage', imageDataUrl);
                    setIsCameraModalOpen(false);
                }}
            />
        </div>
    );
};