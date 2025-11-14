import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { globalFeedbackService } from '../src/services/globalFeedbackService';
import type { UserDetails, Toast } from '../types';

// Icons
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { UserIcon } from './icons/UserIcon';
import { StarIcon } from './icons/StarIcon';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon';
import { SendIcon } from './icons/SendIcon';
import { LockIcon } from './icons/LockIcon';


interface FeedbackProps {
    userDetails: UserDetails | null;
    addToast: (message: string, type: Toast['type']) => void;
}

const Feedback: React.FC<FeedbackProps> = ({ userDetails, addToast }) => {
    const { t } = useLanguage();

    const [globalStats, setGlobalStats] = useState({
        studyMaterials: 0,
        totalRatings: 0,
        satisfaction: 0,
        activeUsers: 0,
        totalComments: 0,
        averageRating: 0,
    });

    const [allComments, setAllComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [newRating, setNewRating] = useState(0);
    const [hasRated, setHasRated] = useState(false);
    const [likedComments, setLikedComments] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const unsubscribeStats = globalFeedbackService.subscribeToGlobalStats(setGlobalStats);
        const unsubscribeComments = globalFeedbackService.subscribeToComments(setAllComments);
        setIsLoading(false);

        return () => {
            unsubscribeStats();
            unsubscribeComments();
        };
    }, []);

    useEffect(() => {
        if (userDetails?.id) {
            const unsubscribeUserFeedback = globalFeedbackService.subscribeToUserFeedback(userDetails.id, (userFeedback) => {
                if(userFeedback) {
                    const userHasRated = userFeedback.rating > 0;
                    setHasRated(userHasRated);
                    if (userHasRated) {
                        setNewRating(userFeedback.rating);
                    } else {
                        setNewRating(0);
                    }
                    setLikedComments(userFeedback.likedComments || []);
                } else {
                    setHasRated(false);
                    setNewRating(0);
                    setLikedComments([]);
                }
            });

            return () => {
                unsubscribeUserFeedback();
            };
        } else {
            setHasRated(false);
            setNewRating(0);
            setLikedComments([]);
        }
    }, [userDetails?.id]);

    const handleRatingSubmit = async () => {
        if (newRating === 0) {
            addToast(t('feedback.error.selectRating' as any), 'warning');
            return;
        }
        if (hasRated || !userDetails?.id || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await globalFeedbackService.submitRating(userDetails.id, newRating);
            addToast(t('feedback.ratingThankYou' as any), 'success');
        } catch (error: any) {
            console.error("Failed to submit rating:", error);
            addToast(error.message || "Could not submit rating.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCommentSubmit = async () => {
        if (!newComment.trim()) {
            addToast(t('feedback.error.writeComment' as any), 'warning');
            return;
        }
        if (!userDetails || !userDetails.name || !userDetails.id || isSubmitting) {
            addToast(t('feedback.error.waitProfile' as any), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            await globalFeedbackService.postComment(userDetails.id, userDetails.name, newComment);
            setNewComment('');
        } catch (error: any) {
            console.error("Failed to post comment:", error);
            addToast(error.message || "Could not post comment.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLikeComment = async (commentId: string) => {
        if (!userDetails?.id || isSubmitting) return;
        
        setIsSubmitting(true);
        try {
            await globalFeedbackService.likeComment(userDetails.id, commentId);
        } catch (error: any) {
            console.error("Failed to like comment:", error);
            addToast(error.message || "Could not update like.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTimeAgo = (timestamp: any) => {
        if (!timestamp) return '';
        const now = new Date();
        const past = timestamp.toDate(); // Convert Firestore Timestamp to Date
        const diffMs = now.getTime() - past.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return t('feedback.timeAgo.justNow' as any);
        if (diffMins < 60) return t('feedback.timeAgo.minutes' as any, { count: diffMins });
        if (diffHours < 24) return t('feedback.timeAgo.hours' as any, { count: diffHours });
        if (diffDays < 30) return t('feedback.timeAgo.days' as any, { count: diffDays });
        return past.toLocaleDateString();
    };

    const StatCard: React.FC<{ icon: React.ReactNode, value: string | number, label: string, gradient: string }> = ({ icon, value, label, gradient }) => (
        <div className={`rounded-3xl p-6 shadow-2xl ${gradient}`}>
            <div className="mb-4">{icon}</div>
            <div className="text-5xl font-bold text-white mb-2">{value}</div>
            <div className="text-sm font-medium text-white/80">{label}</div>
        </div>
    );
    
    if (isLoading) {
        return (
             <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-2">{t('feedback.communityTitle' as any)}</h1>
                <p className="text-gray-600 dark:text-blue-200 text-lg">{t('feedback.communitySubtitle' as any)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<DocumentIcon className="text-yellow-300" width={32} height={32} />} value={globalStats.studyMaterials} label={t('feedback.studyMaterials' as any)} gradient="bg-gradient-to-br from-slate-700 to-slate-800" />
                <StatCard icon={<StarIcon className="text-yellow-300" width={32} height={32} />} value={globalStats.totalRatings} label={t('feedback.highlights.totalRatings' as any)} gradient="bg-gradient-to-br from-blue-600 to-blue-700" />
                <StatCard icon={<TrendingUpIcon className="text-white" width={32} height={32} />} value={`${globalStats.satisfaction}%`} label={t('feedback.highlights.satisfaction' as any)} gradient="bg-gradient-to-br from-green-600 to-green-700" />
                <StatCard icon={<UserIcon className="text-white" width={32} height={32} />} value={globalStats.activeUsers} label={t('feedback.highlights.activeUsers')} gradient="bg-gradient-to-br from-purple-600 to-purple-700" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6">
                        <StarIcon className="text-yellow-400" width={28} height={28} />
                        <h2 className="text-2xl font-bold">{t('feedback.rateAppTitle' as any)}</h2>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 mb-6">{t('feedback.ratingDesc' as any)}</p>

                    <div className="flex justify-center gap-3 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} onClick={() => !hasRated && setNewRating(star)} className="transition-transform hover:scale-110 disabled:cursor-not-allowed" disabled={hasRated}>
                                <StarIcon width={48} height={48} className={`w-10 h-10 ${star <= newRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'} transition-colors`} />
                            </button>
                        ))}
                    </div>

                    <button onClick={handleRatingSubmit} disabled={hasRated || newRating === 0 || isSubmitting} className="w-full bg-primary text-primary-text py-3 rounded-xl hover:bg-primary-dark transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2">
                        {isSubmitting ? "Submitting..." : hasRated ? t('feedback.ratingThankYou' as any) : t('feedback.submitRating' as any)}
                    </button>
                    {globalStats.totalRatings > 0 && (
                        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-300">{t('feedback.averageRating' as any)}</span>
                                <div className="flex items-center gap-2">
                                    <StarIcon className="fill-yellow-400 text-yellow-400" width={20} height={20} />
                                    <span className="font-bold text-xl">{globalStats.averageRating.toFixed(1)} / 5</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6">
                        <ChatBubbleIcon className="text-blue-500" width={28} height={28} />
                        <h2 className="text-2xl font-bold">{t('feedback.shareThoughtsTitle' as any)}</h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{t('feedback.shareThoughtsSubtitle' as any)}</p>
                    <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t('feedback.commentPlaceholder' as any)} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-4" rows={3}/>
                    <button onClick={handleCommentSubmit} disabled={!newComment.trim() || !userDetails || isSubmitting} className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-500 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2">
                         {isSubmitting ? "Posting..." : <><SendIcon width={20} height={20} /> {t('feedback.postComment' as any)}</>}
                    </button>
                    <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t('feedback.totalComments' as any, { count: globalStats.totalComments })}
                    </div>
                </div>
            </div>
            
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                    <ChatBubbleIcon className="text-green-500" width={28} height={28} />
                    <h2 className="text-2xl font-bold">{t('feedback.communityFeedbackTitle' as any)}</h2>
                </div>

                {allComments.length === 0 ? (
                    <div className="text-center py-12">
                        <ChatBubbleIcon className="mx-auto mb-4 text-gray-300 dark:text-gray-600" width={64} height={64} />
                        <p className="text-gray-500 dark:text-gray-400 text-lg">{t('feedback.noComments' as any)}</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                        {allComments.map((comment) => (
                            <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-bold text-lg">{comment.userName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{getTimeAgo(comment.timestamp)}</p>
                                    </div>
                                    <button onClick={() => handleLikeComment(comment.id)} disabled={!userDetails || isSubmitting} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors disabled:cursor-not-allowed ${likedComments.includes(comment.id) ? 'bg-primary/10 text-primary' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>
                                        <ThumbsUpIcon width={16} height={16} />
                                        <span className="font-semibold text-sm">{comment.likes || 0}</span>
                                    </button>
                                </div>
                                <p className="text-base leading-relaxed">{comment.text}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Feedback;