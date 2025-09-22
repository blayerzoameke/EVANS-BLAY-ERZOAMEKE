import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { StarIcon } from './icons/StarIcon';
import type { FeedbackDraft } from '../types.ts';

interface FeedbackProps {
    feedbackDraft: FeedbackDraft;
    setFeedbackDraft: React.Dispatch<React.SetStateAction<FeedbackDraft>>;
}

const Feedback: React.FC<FeedbackProps> = ({ feedbackDraft, setFeedbackDraft }) => {
    const { t } = useLanguage();
    const [hoverRating, setHoverRating] = useState(0);
    const [successMessage, setSuccessMessage] = useState('');
    const { rating, category, comments, canUseAsTestimonial } = feedbackDraft;

    const updateDraft = <K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]) => {
        setFeedbackDraft(prev => ({...prev, [key]: value}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = `[EduBlay Feedback] - ${rating}-Star Rating (${t(`feedback.category.${category}` as any)})`;
        let body = `Rating: ${rating}/5\n`;
        body += `Category: ${t(`feedback.category.${category}` as any)}\n\n`;
        body += `Comments:\n${comments}\n\n`;
        body += `Permission to use as testimonial: ${canUseAsTestimonial ? 'Yes' : 'No'}`;
        
        window.location.href = `mailto:blayerzoameke@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        setSuccessMessage('Thank you for your feedback! Your email client should open shortly.');
        setFeedbackDraft({ rating: 0, category: 'compliment', comments: '', canUseAsTestimonial: false });
    };
    
    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('feedback.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('feedback.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('feedback.rating')}</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('feedback.ratingDesc')}</p>
                    <div className="flex items-center mt-2" onMouseLeave={() => setHoverRating(0)}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onMouseEnter={() => setHoverRating(star)}
                                onClick={() => updateDraft('rating', star)}
                                className="p-1 text-gray-300 dark:text-gray-600 focus:outline-none"
                            >
                                <StarIcon
                                    className={`w-8 h-8 transition-colors ${(hoverRating || rating) >= star ? 'text-yellow-400' : ''}`}
                                    style={{ fill: (hoverRating || rating) >= star ? 'currentColor' : 'none' }}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('feedback.category')}</label>
                     <select id="category" value={category} onChange={e => updateDraft('category', e.target.value)} className={`${inputClasses} mt-1`}>
                        <option value="compliment">{t('feedback.category.compliment')}</option>
                        <option value="usability">{t('feedback.category.usability')}</option>
                        <option value="suggestion">{t('feedback.category.suggestion')}</option>
                    </select>
                </div>
                
                <div>
                    <label htmlFor="comments" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('feedback.comments')}</label>
                    <textarea
                        id="comments"
                        rows={6}
                        value={comments}
                        onChange={(e) => updateDraft('comments', e.target.value)}
                        className={`${inputClasses} mt-1`}
                        placeholder={t('feedback.commentsPlaceholder')}
                    />
                </div>

                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input
                        id="permission"
                        name="permission"
                        type="checkbox"
                        checked={canUseAsTestimonial}
                        onChange={(e) => updateDraft('canUseAsTestimonial', e.target.checked)}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-700 border-gray-300 rounded"
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="permission" className="font-medium text-gray-700 dark:text-gray-300">{t('feedback.permission')}</label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={rating === 0}
                    className="w-full px-4 py-3 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-blue-400 dark:disabled:bg-blue-800"
                >
                    {t('feedback.submit')}
                </button>
                {successMessage && <p className="text-center text-green-600 dark:text-green-400 mt-4">{successMessage}</p>}
            </form>
        </div>
    );
};

export default Feedback;