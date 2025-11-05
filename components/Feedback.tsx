import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { storageService } from '../src/services/authService';
import type { UserDetails, Toast } from '../types';

// Icons
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { UserIcon } from './icons/UserIcon';
import { StarIcon } from './icons/StarIcon';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon';
import { SendIcon } from './icons/SendIcon';

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
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [hasRated, setHasRated] = useState(false);
    const [likedComments, setLikedComments] = useState<string[]>([]);
    
    const getLocalStorageItem = (key: string, defaultValue: any) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`Error reading ${key} from localStorage`, e);
            return defaultValue;
        }
    };
    
    const setLocalStorageItem = (key: string, value: any) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error writing ${key} to localStorage`, e);
        }
    };

    const loadGlobalData = useCallback(() => {
        const stats = getLocalStorageItem('eduBlay_globalStats', {
            totalRatings: 0,
            satisfaction: 0,
            totalComments: 0,
            averageRating: 0
        });

        const allAppUsers = storageService.loadItem<any[]>('users') || [];
        stats.activeUsers = allAppUsers.length || 1;

        const allUsersData = storageService.loadItem<any>('usersData') || {};
        let totalMaterials = 0;
        for (const email in allUsersData) {
            const userData = allUsersData[email];
            if (userData) {
                totalMaterials += (userData.notes?.length || 0);
                totalMaterials += (userData.savedTimetables?.length || 0);
                totalMaterials += (userData.uploadedMaterials?.length || 0);
            }
        }
        stats.studyMaterials = totalMaterials;
        setGlobalStats(stats);

        const comments = getLocalStorageItem('eduBlay_comments', []);
        setAllComments(comments.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

        if(currentUser?.id) {
            const userFeedbackData = getLocalStorageItem(`eduBlay_feedback_${currentUser.id}`, { rating: 0, likedComments: [] });
            if (userFeedbackData.rating > 0) {
                setNewRating(userFeedbackData.rating);
                setHasRated(true);
            } else {
                setHasRated(false);
                setNewRating(0);
            }
            setLikedComments(userFeedbackData.likedComments || []);
        }
    }, [currentUser]);
    
    useEffect(() => {
        if (userDetails?.email && userDetails.name) {
             setCurrentUser({ id: userDetails.email, name: userDetails.name });
        }
    }, [userDetails]);

    useEffect(() => {
        loadGlobalData();
        const interval = setInterval(loadGlobalData, 10000); // Refresh for real-time feel
        return () => clearInterval(interval);
    }, [currentUser, loadGlobalData]);

    const handleRatingSubmit = () => {
        if (newRating === 0) {
            addToast(t('feedback.error.selectRating' as any), 'warning');
            return;
        }
        if (hasRated) return;

        const stats = getLocalStorageItem('eduBlay_globalStats', globalStats);
        
        const totalScore = (stats.averageRating * stats.totalRatings) + newRating;
        stats.totalRatings += 1;
        stats.averageRating = totalScore / stats.totalRatings;
        stats.satisfaction = Math.round((stats.averageRating / 5) * 100);

        setLocalStorageItem('eduBlay_globalStats', stats);
        setGlobalStats(stats);
        
        if (currentUser) {
            const userFeedbackData = getLocalStorageItem(`eduBlay_feedback_${currentUser.id}`, { likedComments: [] });
            userFeedbackData.rating = newRating;
            setLocalStorageItem(`eduBlay_feedback_${currentUser.id}`, userFeedbackData);
        }

        setHasRated(true);
        addToast(t('feedback.ratingThankYou' as any), 'success');
    };

    const handleCommentSubmit = () => {
        if (!newComment.trim()) {
            addToast(t('feedback.error.writeComment' as any), 'warning');
            return;
        }
        if (!currentUser) {
            addToast(t('feedback.error.waitProfile' as any), 'error');
            return;
        }

        const comments = getLocalStorageItem('eduBlay_comments', []);
        comments.push({
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.name,
            text: newComment,
            timestamp: new Date().toISOString(),
            likes: 0
        });
        setLocalStorageItem('eduBlay_comments', comments);

        const stats = getLocalStorageItem('eduBlay_globalStats', globalStats);
        stats.totalComments = (stats.totalComments || 0) + 1;
        setLocalStorageItem('eduBlay_globalStats', stats);

        setNewComment('');
        loadGlobalData();
    };

    const handleLikeComment = (commentId: string) => {
        if (!currentUser) return;

        let userFeedbackData = getLocalStorageItem(`eduBlay_feedback_${currentUser.id}`, { likedComments: [] });
        const userLikedComments = new Set(userFeedbackData.likedComments || []);
        
        const comments = getLocalStorageItem('eduBlay_comments', []);
        const updatedComments = comments.map((c: any) => {
            if (c.id === commentId) {
                if (userLikedComments.has(commentId)) {
                    userLikedComments.delete(commentId);
                    return { ...c, likes: Math.max(0, c.likes - 1) };
                } else {
                    userLikedComments.add(commentId);
                    return { ...c, likes: c.likes + 1 };
                }
            }
            return c;
        });
        
        setLocalStorageItem('eduBlay_comments', updatedComments);
        userFeedbackData.likedComments = Array.from(userLikedComments);
        setLocalStorageItem(`eduBlay_feedback_${currentUser.id}`, userFeedbackData);
        
        loadGlobalData();
    };

    const getTimeAgo = (timestamp: string) => {
        const now = new Date();
        const past = new Date(timestamp);
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

                    <button onClick={handleRatingSubmit} disabled={hasRated || newRating === 0} className="w-full bg-primary text-primary-text py-3 rounded-xl hover:bg-primary-dark transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                        {hasRated ? t('feedback.ratingThankYou' as any) : t('feedback.submitRating' as any)}
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
                    <button onClick={handleCommentSubmit} disabled={!newComment.trim()} className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-500 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2">
                        <SendIcon width={20} height={20} />{t('feedback.postComment' as any)}
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
                                    <button onClick={() => handleLikeComment(comment.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${likedComments.includes(comment.id) ? 'bg-primary/10 text-primary' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>
                                        <ThumbsUpIcon width={16} height={16} />
                                        <span className="font-semibold text-sm">{comment.likes}</span>
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