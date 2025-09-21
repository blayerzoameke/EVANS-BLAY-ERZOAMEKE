// FIX: Implement ExamPrep component.
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { generateQuiz } from '../services/geminiService.ts';
import type { Toast, QuizQuestion, AnswerFeedback, QuizSummary } from '../types.ts';
import { QuizType } from '../types.ts';
import type { View } from '../App.tsx';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon.tsx';
import { ArrowRightIcon } from './icons/ArrowRightIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';


interface ExamPrepProps {
    addToast: (message: string, type: Toast['type']) => void;
    setView: (view: View) => void;
}

const ExamPrep: React.FC<ExamPrepProps> = ({ addToast, setView }) => {
    const { t } = useLanguage();
    const [topic, setTopic] = useState('');
    const [numQuestions, setNumQuestions] = useState(5);
    const [quizType, setQuizType] = useState<QuizType>(QuizType.MCQ);
    const [isLoading, setIsLoading] =useState(false);

    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
    const [summary, setSummary] = useState<QuizSummary | null>(null);

    const handleGenerateQuiz = async () => {
        if (!topic.trim()) {
            addToast(t('examPrep.error.noTopic'), 'error');
            return;
        }
        setIsLoading(true);
        setQuiz([]);
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setFeedback(null);
        setSummary(null);
        try {
            const questions = await generateQuiz(topic, numQuestions, quizType);
            if (questions && questions.length > 0) {
                setQuiz(questions);
                setUserAnswers(new Array(questions.length).fill(null));
            } else {
                addToast(t('examPrep.error.noQuestions'), 'warning');
            }
        } catch (error: any) {
            addToast(error.message || t('examPrep.error.generic'), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerSubmit = (answer: string) => {
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = answer;
        setUserAnswers(newAnswers);

        const currentQuestion = quiz[currentQuestionIndex];
        const isCorrect = answer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
        setFeedback({
            isCorrect,
            explanation: currentQuestion.explanation,
        });
    };

    const handleNextQuestion = () => {
        setFeedback(null);
        if (currentQuestionIndex < quiz.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            // End of quiz
            calculateSummary();
        }
    };

    const calculateSummary = () => {
        const score = userAnswers.reduce((correctCount, answer, index) => {
            return answer?.toLowerCase() === quiz[index].correctAnswer.toLowerCase() ? correctCount + 1 : correctCount;
        }, 0);

        const topicCounts: { [topic: string]: { correct: number, total: number } } = {};
        quiz.forEach((q, i) => {
            if (!topicCounts[q.topic]) {
                topicCounts[q.topic] = { correct: 0, total: 0 };
            }
            topicCounts[q.topic].total++;
            if (userAnswers[i]?.toLowerCase() === q.correctAnswer.toLowerCase()) {
                topicCounts[q.topic].correct++;
            }
        });

        const strengths = Object.entries(topicCounts).filter(([, v]) => v.correct / v.total >= 0.7).map(([k]) => k);
        const weaknesses = Object.entries(topicCounts).filter(([, v]) => v.correct / v.total < 0.7).map(([k]) => k);

        setSummary({
            score: (score / quiz.length) * 100,
            strengths,
            weaknesses,
            recommendations: [`Focus on reviewing these topics: ${weaknesses.join(', ')}`],
        });
    };

    const resetQuiz = () => {
        setQuiz([]);
        setSummary(null);
        setTopic('');
    };

    if (isLoading) {
        return <div className="text-center p-8">{t('examPrep.loading')}</div>;
    }

    if (summary) {
        return (
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold text-center mb-4">{t('examPrep.summary.title')}</h2>
                <p className="text-5xl font-bold text-center text-blue-600 dark:text-blue-400 mb-6">{summary.score.toFixed(0)}%</p>
                <div className="space-y-4">
                    <div><h3 className="font-semibold">{t('examPrep.summary.strengths')}</h3><p>{summary.strengths.join(', ') || 'None identified'}</p></div>
                    <div><h3 className="font-semibold">{t('examPrep.summary.weaknesses')}</h3><p>{summary.weaknesses.join(', ') || 'None identified'}</p></div>
                    <div><h3 className="font-semibold">{t('examPrep.summary.recommendations')}</h3><p>{summary.recommendations.join(', ')}</p></div>
                </div>
                <button onClick={resetQuiz} className="mt-8 w-full py-2 bg-blue-700 text-white font-semibold rounded-md hover:bg-blue-800">{t('examPrep.tryAgain')}</button>
            </div>
        );
    }
    
    if (quiz.length > 0) {
        const currentQuestion = quiz[currentQuestionIndex];
        return (
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-semibold">{t('examPrep.question', { current: currentQuestionIndex + 1, total: quiz.length })}</span>
                    <span className="text-sm font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">{currentQuestion.topic}</span>
                </div>
                <p className="text-lg font-medium mb-6">{currentQuestion.question}</p>

                <div className="space-y-3">
                    {currentQuestion.options ? (
                        currentQuestion.options.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => handleAnswerSubmit(opt)}
                                disabled={!!feedback}
                                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                                    feedback && opt === currentQuestion.correctAnswer ? 'bg-green-100 dark:bg-green-900/50 border-green-500' :
                                    feedback && opt === userAnswers[currentQuestionIndex] && !feedback.isCorrect ? 'bg-red-100 dark:bg-red-900/50 border-red-500' :
                                    'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                {opt}
                            </button>
                        ))
                    ) : (
                        <textarea rows={4} onBlur={(e) => handleAnswerSubmit(e.target.value)} disabled={!!feedback} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                    )}
                </div>

                {feedback && (
                    <div className={`mt-6 p-4 rounded-lg ${feedback.isCorrect ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                        <div className="flex items-center gap-2">
                             {feedback.isCorrect ? <CheckIcon className="w-6 h-6 text-green-600" /> : <CloseIcon className="w-6 h-6 text-red-600" />}
                             <h4 className="font-bold text-lg">{feedback.isCorrect ? t('examPrep.correct') : t('examPrep.incorrect')}</h4>
                        </div>
                        <p className="text-sm mt-2">{feedback.explanation}</p>
                        <button onClick={handleNextQuestion} className="w-full mt-4 py-2 px-4 rounded-md text-white font-semibold bg-gray-800 dark:bg-gray-200 dark:text-gray-900">
                           {currentQuestionIndex < quiz.length - 1 ? t('examPrep.next') : t('examPrep.finish')}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('examPrep.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('examPrep.subtitle')}</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium">{t('examPrep.topic')}</label>
                    <input type="text" id="topic" value={topic} onChange={e => setTopic(e.target.value)} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="numQuestions" className="block text-sm font-medium">{t('examPrep.numQuestions')}</label>
                        <input type="number" id="numQuestions" value={numQuestions} onChange={e => setNumQuestions(parseInt(e.target.value, 10))} min="1" max="20" className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label htmlFor="quizType" className="block text-sm font-medium">{t('examPrep.quizType')}</label>
                        <select id="quizType" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                            {Object.values(QuizType).map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={handleGenerateQuiz} className="w-full py-3 bg-blue-700 text-white font-semibold rounded-md hover:bg-blue-800">{t('examPrep.generate')}</button>
            </div>
        </div>
    );
};

export default ExamPrep;