
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    isStudyMaterial,
    getDocumentContext,
    generateQuiz,
} from '../services/geminiService';
// FIX: Added .ts extension to import path.
import type { 
    UploadedFile, 
    Toast,
    QuizQuestion,
    QuizSummary,
    AnswerFeedback,
} from '../types.ts';
// FIX: Added .ts extension to import path.
import { QuizType } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';
// FIX: Added .tsx extension to import path.
import type { View } from '../App.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { PdfIcon } from './icons/PdfIcon.tsx';
import { PowerPointIcon } from './icons/PowerPointIcon.tsx';

interface ExamPrepProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
}

const ExamPrep: React.FC<ExamPrepProps> = ({ addToast, setView }) => {
    const { t } = useLanguage();
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
    const [quizSummary, setQuizSummary] = useState<QuizSummary | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const [quizConfig, setQuizConfig] = useState({
        type: QuizType.MCQ,
        scope: '',
        count: 5
    });

    const resetQuizState = () => {
        setQuizQuestions([]);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setSelectedOption(null);
        setFeedback(null);
        setQuizSummary(null);
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
                
                setFile({
                    name: acceptedFile.name,
                    type: acceptedFile.type,
                    size: acceptedFile.size,
                    base64,
                    context
                });
            } catch (e: any) {
                setError(e.message || t('uploadslides.error.generic'));
            } finally {
                setIsLoading(false);
            }
        };
    }, [t]);

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
    
    const handleGenerateQuiz = async () => {
        if (!file) return;
        setIsGenerating(true);
        setError(null);
        try {
            const filePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const questions = await generateQuiz(filePart, quizConfig.type, quizConfig.scope || 'the entire document', quizConfig.count);
            setQuizQuestions(questions);
            setUserAnswers(new Array(questions.length).fill(null));
        } catch (e: any) {
            setError(e.message || "Failed to generate quiz.");
            addToast(e.message || "Failed to generate quiz.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleAnswerSubmit = () => {
        if (!selectedOption) return;
        
        const currentQuestion = quizQuestions[currentQuestionIndex];
        const isCorrect = selectedOption.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
        
        setFeedback({
            isCorrect,
            explanation: currentQuestion.explanation,
        });

        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = selectedOption;
        setUserAnswers(newAnswers);
    };

    const handleNextQuestion = () => {
        setFeedback(null);
        setSelectedOption(null);
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            // End of quiz, generate summary
            calculateSummary();
        }
    };
    
    const calculateSummary = () => {
        const correctAnswers = userAnswers.filter((answer, index) => 
            answer && answer.trim().toLowerCase() === quizQuestions[index].correctAnswer.trim().toLowerCase()
        );
        const score = (correctAnswers.length / quizQuestions.length) * 100;
        
        const strengths = Array.from(new Set(quizQuestions
            .filter((q, i) => userAnswers[i] && userAnswers[i]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase())
            .map(q => q.topic)
        ));

        const weaknesses = Array.from(new Set(quizQuestions
            .filter((q, i) => !userAnswers[i] || userAnswers[i]?.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase())
            .map(q => q.topic)
        ));

        setQuizSummary({
            score: Math.round(score),
            strengths,
            weaknesses,
            recommendations: [`Focus on reviewing topics like: ${weaknesses.join(', ')}.`]
        });
    };
    
    const startOver = () => {
        setFile(null);
        resetQuizState();
    };

    if (quizSummary) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <h2 className="text-3xl font-bold text-center">{t('examprep.summaryTitle')}</h2>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                    <p className="text-center text-lg">{t('examprep.yourScore')}: <span className="font-bold text-3xl text-blue-600">{quizSummary.score}%</span></p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                         <h3 className="font-bold text-green-600 dark:text-green-400 mb-2">{t('examprep.strengths')}</h3>
                         {quizSummary.strengths.length > 0 ? (
                            <ul className="list-disc list-inside">
                                {quizSummary.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                         ) : <p>{t('examprep.none')}</p>}
                    </div>
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                         <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">{t('examprep.weaknesses')}</h3>
                         {quizSummary.weaknesses.length > 0 ? (
                            <ul className="list-disc list-inside">
                                {quizSummary.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                         ) : <p>{t('examprep.none')}</p>}
                    </div>
                </div>
                 <div className="flex justify-center gap-4 mt-6">
                    <button onClick={resetQuizState} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg">{t('examprep.retakeQuiz')}</button>
                    <button onClick={startOver} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 font-semibold rounded-lg">{t('examprep.chooseNewMaterial')}</button>
                </div>
            </div>
        );
    }
    
    if (quizQuestions.length > 0) {
        const currentQuestion = quizQuestions[currentQuestionIndex];
        return (
            <div className="max-w-2xl mx-auto">
                <p className="text-center font-semibold mb-4">{t('examprep.question', { current: currentQuestionIndex + 1, total: quizQuestions.length })}</p>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                    <p className="font-bold text-lg mb-4">{currentQuestion.question}</p>
                    <div className="space-y-3">
                        {currentQuestion.options?.map((option, index) => (
                             <button
                                key={index}
                                onClick={() => !feedback && setSelectedOption(option)}
                                className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                                    selectedOption === option
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                } ${feedback ? 'cursor-not-allowed' : ''}`}
                                disabled={!!feedback}
                            >
                                {option}
                            </button>
                        ))}
                         {currentQuestion.type !== QuizType.MCQ && (
                              <textarea
                                value={selectedOption || ''}
                                onChange={(e) => !feedback && setSelectedOption(e.target.value)}
                                rows={4}
                                className="w-full text-left p-3 rounded-md border-2 transition-all border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700"
                                disabled={!!feedback}
                            />
                         )}
                    </div>

                    {feedback && (
                        <div className={`mt-4 p-4 rounded-lg ${feedback.isCorrect ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
                            <h4 className="font-bold">{feedback.isCorrect ? t('examprep.correct') : t('examprep.incorrect')}</h4>
                            <p>{feedback.explanation}</p>
                        </div>
                    )}
                    
                    <div className="mt-6 flex justify-end">
                        {!feedback ? (
                            <button onClick={handleAnswerSubmit} disabled={!selectedOption} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:bg-blue-300">
                                {t('examprep.checkAnswer')}
                            </button>
                        ) : (
                            <button onClick={handleNextQuestion} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg">
                                {currentQuestionIndex < quizQuestions.length - 1 ? t('examprep.nextQuestion') : t('examprep.finishAndSummary')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    
    // Quiz Configuration View
    if (file) {
        return (
             <div className="max-w-2xl mx-auto space-y-6">
                <button onClick={startOver} className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800">
                    <ArrowLeftIcon className="w-4 h-4" /> {t('examprep.chooseNewMaterial')}
                </button>
                <h2 className="text-2xl font-bold">{t('examprep.configureQuiz')}</h2>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
                    <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                        {file.type.includes('pdf') 
                            ? <PdfIcon className="w-8 h-8 text-red-600 shrink-0" /> 
                            : file.type.includes('image')
                            ? <img src={`data:${file.type};base64,${file.base64}`} alt={file.name} className="w-8 h-8 object-cover rounded-md" />
                            : <PowerPointIcon className="w-8 h-8 text-orange-500 shrink-0" />
                        }
                        <p className="text-sm font-semibold truncate">{file.name}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Topic or Scope</label>
                        <input
                            type="text"
                            value={quizConfig.scope}
                            onChange={e => setQuizConfig({...quizConfig, scope: e.target.value})}
                            placeholder={t('examprep.topicPlaceholder')}
                            className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Quiz Type</label>
                        <select value={quizConfig.type} onChange={e => setQuizConfig({...quizConfig, type: e.target.value as QuizType})} className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                            {Object.values(QuizType).map(quizType => <option key={quizType} value={quizType}>{quizType}</option>)}
                        </select>
                    </div>
                    <button onClick={handleGenerateQuiz} disabled={isGenerating} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg disabled:bg-blue-400">
                        {isGenerating ? t('examprep.generatingQuiz') : t('examprep.generateQuiz')}
                    </button>
                    {error && <p className="mt-2 text-center text-red-500">{error}</p>}
                </div>
             </div>
        );
    }

    // Initial Upload View
    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center">{t('examprep.title')}</h2>
            <p className="text-gray-500 mt-1 mb-8 text-center">{t('examprep.subtitle')}</p>
            <div {...getRootProps()} className={`group p-12 border-2 border-dashed rounded-lg transition-colors ${isDragActive ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-300 dark:border-gray-600'} ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-teal-400'}`}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 transition-colors group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    <UploadIcon className="w-16 h-16 mb-4 transition-transform group-hover:scale-110" />
                    <p className="font-semibold text-lg">{isLoading ? loadingMessage : t('uploadslides.dropPrompt')}</p>
                    <p className="text-sm">{t('uploadslides.supportedFormats')}</p>
                </div>
            </div>
            {error && <p className="mt-4 text-center text-red-500">{error}</p>}
        </div>
    );
};

export default ExamPrep;
