import React, { useState } from 'react';
import UploadSlides from './UploadSlides';
import { generateQuiz, generateQuizSummary } from '../services/geminiService';
// FIX: Added .ts extension to import path.
import type { UploadedFile, QuizQuestion, AnswerFeedback, QuizSummary, ImagePart } from '../types.ts';
// FIX: Added .ts extension to import path.
import { QuizType } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import { View } from '../App';

type QuizStep = 'upload' | 'confirmStart' | 'configure' | 'generating' | 'active' | 'finished';

interface ExamPrepProps {
    setView: (view: View) => void;
}

const ExamPrep: React.FC<ExamPrepProps> = ({ setView }) => {
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [quizType, setQuizType] = useState<QuizType>(QuizType.MCQ);
    const [scope, setScope] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
    const [summary, setSummary] = useState<QuizSummary | null>(null);
    const [quizStep, setQuizStep] = useState<QuizStep>('upload');
    const [error, setError] = useState<string | null>(null);
    const [answerResults, setAnswerResults] = useState<{ [index: number]: boolean }>({});
    const { t } = useLanguage();

    const handleFileSelect = (selectedFile: UploadedFile | null) => {
        setFile(selectedFile);
        if (selectedFile) {
            setQuizStep('confirmStart');
        } else {
            setQuizStep('upload');
        }
    }

    const handleGenerateQuiz = async () => {
        if (!file) {
            setError(t('examprep.error.uploadFirst'));
            return;
        }
        setQuizStep('generating');
        setError(null);
        setQuiz([]);
        setSummary(null);
        setAnswerResults({});
        try {
            const imagePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const questions = await generateQuiz(imagePart, quizType, scope, questionCount);
            setQuiz(questions);
            setUserAnswers(new Array(questions.length).fill(''));
            setCurrentQuestionIndex(0);
            setQuizStep('active');
        } catch (e: any) {
            setError(e.message || "Failed to generate quiz.");
            setQuizStep('configure');
        }
    };

    const handleAnswerSubmit = () => {
        if (!file) return;
        setError(null);
        
        const currentQuestion = quiz[currentQuestionIndex];
        const userAnswer = userAnswers[currentQuestionIndex];

        const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
        
        setAnswerResults(prev => ({ ...prev, [currentQuestionIndex]: isCorrect }));

        setFeedback({
            isCorrect,
            explanation: currentQuestion.explanation,
        });
    };

    const handleNextQuestion = async () => {
        const isLastQuestion = currentQuestionIndex === quiz.length - 1;
        setFeedback(null);

        if (isLastQuestion) {
            setQuizStep('generating'); // For summary generation
            if (file) {
                try {
                    const imagePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
                    const performance = quiz.map((q, i) => ({ 
                        question: q.question, 
                        wasCorrect: answerResults[i] === true 
                    }));
                    const summaryResult = await generateQuizSummary(imagePart, performance);
                    setSummary(summaryResult);
                } catch (e: any) {
                    setError(e.message || "Failed to generate summary.");
                }
            }
            setQuizStep('finished');
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setQuizStep('active');
        }
    };
    
    const startNewQuiz = () => {
        setQuiz([]);
        setQuizStep('upload');
        setFile(null);
        setSummary(null);
        setError(null);
        setFeedback(null);
        setAnswerResults({});
    }
    
    return (
        <div className="max-w-4xl mx-auto space-y-8">
             <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('examprep.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('examprep.subtitle')}</p>
            </div>
            
            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700">
                {quizStep === 'upload' && (
                    <UploadSlides file={file} setFile={handleFileSelect} />
                )}

                {quizStep === 'confirmStart' && (
                    <div className="text-center">
                        <h3 className="text-xl font-semibold mb-4">{t('examprep.confirmStart.title')}</h3>
                        <p className="mb-6">{t('examprep.confirmStart.body', { fileName: file?.name || 'document' })}</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setView('uploadslides')} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('examprep.confirmStart.no')}</button>
                            <button onClick={() => setQuizStep('configure')} className="px-6 py-2 bg-blue-700 text-white rounded-md">{t('examprep.confirmStart.yes')}</button>
                        </div>
                    </div>
                )}
                
                {quizStep === 'configure' && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('examprep.configureQuiz')}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <select value={quizType} onChange={e => setQuizType(e.target.value as QuizType)} className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600">
                                    {Object.values(QuizType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input type="number" value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value, 10))} className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600" />
                                <input type="text" value={scope} onChange={e => setScope(e.target.value)} placeholder={t('examprep.topicPlaceholder')} className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 sm:col-span-3"/>
                            </div>
                        </div>
                        <button onClick={handleGenerateQuiz} className="w-full px-4 py-3 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800">
                            {t('examprep.generateQuiz')}
                        </button>
                    </div>
                )}
                
                {quizStep === 'generating' && (
                    <div className="text-center py-12">
                         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
                         <p className="mt-4 text-lg font-semibold">{summary ? t('examprep.generatingSummary') : t('examprep.generatingQuiz')}</p>
                    </div>
                )}

                {quizStep === 'active' && quiz.length > 0 && (() => {
                    const question = quiz[currentQuestionIndex];
                    return (
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('examprep.question', { current: currentQuestionIndex + 1, total: quiz.length })}</p>
                            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{question.question}</h3>
                            {question.type === QuizType.MCQ && question.options ? (
                                <div className="space-y-3">
                                    {question.options.map((opt, i) => (
                                        <label key={i} className="flex items-center p-3 rounded-lg border dark:border-gray-600 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 dark:has-[:checked]:bg-blue-900/30">
                                            <input type="radio" name={`q_${currentQuestionIndex}`} value={opt} checked={userAnswers[currentQuestionIndex] === opt} onChange={e => setUserAnswers(ua => ua.map((a, idx) => idx === currentQuestionIndex ? e.target.value : a))} className="w-4 h-4 text-blue-700 focus:ring-blue-500" disabled={!!feedback} />
                                            <span className="ml-3 text-gray-700 dark:text-gray-300">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <textarea value={userAnswers[currentQuestionIndex]} onChange={e => setUserAnswers(ua => ua.map((a, idx) => idx === currentQuestionIndex ? e.target.value : a))} rows={5} className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600" placeholder="Your answer..." disabled={!!feedback} />
                            )}
                            
                            {!feedback ? (
                                <button onClick={handleAnswerSubmit} disabled={!userAnswers[currentQuestionIndex]} className="mt-6 w-full px-4 py-2 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-blue-400 dark:disabled:bg-blue-800">
                                    {t('examprep.checkAnswer')}
                                </button>
                            ) : (
                                <div className={`mt-4 p-4 rounded-md ${feedback.isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                                    <p className={`font-bold ${feedback.isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                        {feedback.isCorrect ? t('examprep.correct') : t('examprep.incorrect')}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{feedback.explanation}</p>
                                    <button onClick={handleNextQuestion} className="mt-4 w-full px-4 py-2 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800">
                                        {currentQuestionIndex === quiz.length - 1 ? t('examprep.finishAndSummary') : t('examprep.nextQuestion')}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}
                
                {quizStep === 'finished' && summary && (
                     <div>
                        <h3 className="text-2xl font-bold text-center mb-4">{t('examprep.summaryTitle')}</h3>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center mb-6">
                            <p className="text-lg">{t('examprep.yourScore')}</p>
                            <p className="text-5xl font-bold text-blue-700 dark:text-blue-400">{summary.score}%</p>
                        </div>
                        <div className="space-y-4">
                            <div><h4 className="font-semibold text-green-600 dark:text-green-400">{t('examprep.strengths')}</h4><ul className="list-disc list-inside text-sm">{summary.strengths.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
                            <div><h4 className="font-semibold text-red-600 dark:text-red-400">{t('examprep.weaknesses')}</h4><ul className="list-disc list-inside text-sm">{summary.weaknesses.map((w,i) => <li key={i}>{w}</li>)}</ul></div>
                            <div><h4 className="font-semibold text-blue-600 dark:text-blue-400">{t('examprep.recommendations')}</h4><ul className="list-disc list-inside text-sm">{summary.recommendations.map((r,i) => <li key={i}>{r}</li>)}</ul></div>
                        </div>
                        <button onClick={startNewQuiz} className="mt-8 w-full px-4 py-2 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800">
                        {t('examprep.startNewQuiz')}
                        </button>
                    </div>
                )}
            </div>
            {error && <p className="text-center text-red-500 mt-4">{error}</p>}
        </div>
    );
};

export default ExamPrep;