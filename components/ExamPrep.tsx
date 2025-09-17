import React, { useState } from 'react';
import UploadSlides from './UploadSlides';
import { generateQuiz, validateAnswer, generateQuizSummary } from '../services/geminiService';
import type { UploadedFile, QuizQuestion, AnswerFeedback, QuizSummary, ImagePart } from '../types';
import { QuizType } from '../types';

type QuizState = 'idle' | 'generating' | 'active' | 'validating' | 'finished';

const ExamPrep: React.FC = () => {
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [quizType, setQuizType] = useState<QuizType>(QuizType.MCQ);
    const [scope, setScope] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
    const [summary, setSummary] = useState<QuizSummary | null>(null);
    const [quizState, setQuizState] = useState<QuizState>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleGenerateQuiz = async () => {
        if (!file) {
            setError("Please upload a document first.");
            return;
        }
        setQuizState('generating');
        setError(null);
        setQuiz([]);
        setSummary(null);
        try {
            const imagePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const questions = await generateQuiz(imagePart, quizType, scope, questionCount);
            setQuiz(questions);
            setUserAnswers(new Array(questions.length).fill(''));
            setCurrentQuestionIndex(0);
            setQuizState('active');
        } catch (e: any) {
            setError(e.message || "Failed to generate quiz.");
            setQuizState('idle');
        }
    };

    const handleAnswerSubmit = async () => {
        if (!file) return;
        setQuizState('validating');
        setError(null);
        try {
            const imagePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
            const currentQuestion = quiz[currentQuestionIndex];
            const userAnswer = userAnswers[currentQuestionIndex];
            const result = await validateAnswer(imagePart, currentQuestion, userAnswer);
            setFeedback(result);
        } catch (e: any) {
            setError(e.message || "Failed to validate answer.");
            setQuizState('active');
        }
    };

    const handleNextQuestion = async () => {
        const isLastQuestion = currentQuestionIndex === quiz.length - 1;
        setFeedback(null);

        if (isLastQuestion) {
            setQuizState('generating'); // For summary generation
            if (file) {
                try {
                    const imagePart: ImagePart = { inlineData: { data: file.base64, mimeType: file.type } };
                    // Assuming feedback being non-null means we have an answer result
                    const performance = quiz.map((q, i) => ({ question: q.question, wasCorrect: feedback?.isCorrect || false /* Simplified */ }));
                    const summaryResult = await generateQuizSummary(imagePart, performance);
                    setSummary(summaryResult);
                } catch (e: any) {
                    setError(e.message || "Failed to generate summary.");
                }
            }
            setQuizState('finished');
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setQuizState('active');
        }
    };
    
    const startNewQuiz = () => {
        setQuiz([]);
        setQuizState('idle');
        setSummary(null);
        setError(null);
        setFeedback(null);
    }
    
    const renderQuizContent = () => {
        if (quizState === 'active' || quizState === 'validating') {
            const question = quiz[currentQuestionIndex];
            return (
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Question {currentQuestionIndex + 1} of {quiz.length}</p>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{question.question}</h3>
                    {question.type === QuizType.MCQ && question.options ? (
                        <div className="space-y-3">
                            {question.options.map((opt, i) => (
                                <label key={i} className="flex items-center p-3 rounded-lg border dark:border-gray-600 has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-400 dark:has-[:checked]:bg-indigo-900/30">
                                    <input type="radio" name={`q_${currentQuestionIndex}`} value={opt} checked={userAnswers[currentQuestionIndex] === opt} onChange={e => setUserAnswers(ua => ua.map((a, idx) => idx === currentQuestionIndex ? e.target.value : a))} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" disabled={!!feedback} />
                                    <span className="ml-3 text-gray-700 dark:text-gray-300">{opt}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <textarea value={userAnswers[currentQuestionIndex]} onChange={e => setUserAnswers(ua => ua.map((a, idx) => idx === currentQuestionIndex ? e.target.value : a))} rows={5} className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600" placeholder="Your answer..." disabled={!!feedback} />
                    )}
                    
                    {!feedback ? (
                         <button onClick={handleAnswerSubmit} disabled={quizState === 'validating'} className="mt-6 w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                             {quizState === 'validating' ? 'Checking...' : 'Check Answer'}
                         </button>
                    ) : (
                         <div className={`mt-4 p-4 rounded-md ${feedback.isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                            <p className={`font-bold ${feedback.isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                {feedback.isCorrect ? 'Correct!' : 'Incorrect.'}
                            </p>
                            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{feedback.explanation}</p>
                            <button onClick={handleNextQuestion} className="mt-4 w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                                {currentQuestionIndex === quiz.length - 1 ? 'Finish & View Summary' : 'Next Question'}
                            </button>
                        </div>
                    )}
                </div>
            );
        }
        
        if (quizState === 'finished' && summary) {
            return (
                 <div>
                    <h3 className="text-2xl font-bold text-center mb-4">Quiz Summary</h3>
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-center mb-6">
                        <p className="text-lg">Your Score</p>
                        <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-300">{summary.score}%</p>
                    </div>
                    <div className="space-y-4">
                        <div><h4 className="font-semibold text-green-600 dark:text-green-400">Strengths:</h4><ul className="list-disc list-inside text-sm">{summary.strengths.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
                        <div><h4 className="font-semibold text-red-600 dark:text-red-400">Weaknesses:</h4><ul className="list-disc list-inside text-sm">{summary.weaknesses.map((w,i) => <li key={i}>{w}</li>)}</ul></div>
                        <div><h4 className="font-semibold text-blue-600 dark:text-blue-400">Recommendations:</h4><ul className="list-disc list-inside text-sm">{summary.recommendations.map((r,i) => <li key={i}>{r}</li>)}</ul></div>
                    </div>
                    <button onClick={startNewQuiz} className="mt-8 w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                       Start New Quiz
                    </button>
                </div>
            );
        }
        
        return null;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Exam Prep Assistant</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Upload your notes or slides to generate a practice quiz.</p>
            </div>
            
            {quizState === 'idle' || quizState === 'generating' ? (
                <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1. Upload Document</label>
                        <UploadSlides file={file} setFile={setFile} disabled={quizState === 'generating'} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">2. Configure Quiz</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <select value={quizType} onChange={e => setQuizType(e.target.value as QuizType)} className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600" disabled={quizState === 'generating'}>
                                {Object.values(QuizType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input type="number" value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value, 10))} className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600" disabled={quizState === 'generating'}/>
                            <input type="text" value={scope} onChange={e => setScope(e.target.value)} placeholder="Topic/Pages (e.g., 'Chapter 3')" className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 sm:col-span-3" disabled={quizState === 'generating'}/>
                        </div>
                    </div>
                    <button onClick={handleGenerateQuiz} disabled={!file || quizState === 'generating'} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                        {quizState === 'generating' ? 'Generating Quiz...' : 'Generate Quiz'}
                    </button>
                </div>
            ) : (
                <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border dark:border-gray-700">
                    {renderQuizContent()}
                </div>
            )}
            {error && <p className="text-center text-red-500">{error}</p>}
        </div>
    );
};

export default ExamPrep;
