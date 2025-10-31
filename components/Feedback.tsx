import React, { useState, useEffect } from 'react';
import { StarIcon } from './icons/StarIcon.tsx';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon.tsx';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon.tsx';
import { TrendingUpIcon } from './icons/TrendingUpIcon.tsx';
import { UserIcon } from './icons/UserIcon.tsx';
import { AwardIcon } from './icons/AwardIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import type { Note, StoredPlan } from '../types.ts';
import { mockReviews } from '../data/mockReviews.ts';

interface FeedbackProps {
    notes: Note[];
    savedTimetables: StoredPlan[];
    totalUsers: number;
}

const calculateInitialStats = (reviews: any[]) => {
    const totalRatings = reviews.length;
    if (totalRatings === 0) {
        return { averageRating: 0, totalRatings: 0, distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 } };
    }
    const distribution = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let totalScore = 0;
    reviews.forEach(review => {
        (distribution as any)[review.rating]++;
        totalScore += review.rating;
    });
    const averageRating = parseFloat((totalScore / totalRatings).toFixed(1));
    return { averageRating, totalRatings, distribution };
};

const Feedback: React.FC<FeedbackProps> = ({ notes, savedTimetables, totalUsers }) => {
  const { t } = useLanguage();
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [likedReviews, setLikedReviews] = useState<number[]>([]);
  
  const [stats, setStats] = useState({
    averageRating: 0,
    totalRatings: 0,
    distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
  });

  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  useEffect(() => {
    const savedData = localStorage.getItem('feedbackData');
    if (savedData) {
        const data = JSON.parse(savedData);
        setStats(data.stats);
        setRecentReviews(data.reviews);
        setLikedReviews(data.likedReviews || []);
        if (data.userRatingData) {
            setUserRating(data.userRatingData.rating);
            setReview(data.userRatingData.comment);
            setHasRated(true);
        }
    } else {
        const initialStats = calculateInitialStats(mockReviews);
        setStats(initialStats);
        setRecentReviews(mockReviews);
    }
  }, []);

  const persistFeedbackData = (data: any) => {
    localStorage.setItem('feedbackData', JSON.stringify(data));
  };

  const handleRatingClick = (rating: number) => {
    setUserRating(rating);
  };

  const handleSubmitRating = () => {
    if (userRating === 0) {
      alert('Please select a rating');
      return;
    }

    const newReview = {
        id: Date.now(),
        name: 'You',
        rating: userRating,
        comment: review,
        date: 'Just now',
        helpful: 0
    };

    const reviewsWithoutPreviousUser = recentReviews.filter(r => r.name !== 'You');
    const updatedReviews = review.trim() ? [newReview, ...reviewsWithoutPreviousUser] : reviewsWithoutPreviousUser;

    const allReviewsForStats = [...reviewsWithoutPreviousUser, { rating: userRating }];
    const newStats = calculateInitialStats(allReviewsForStats);
    
    setStats(newStats);
    setRecentReviews(updatedReviews);
    setHasRated(true);
    
    persistFeedbackData({
        stats: newStats,
        reviews: updatedReviews,
        userRatingData: { rating: userRating, comment: review },
        likedReviews,
    });
    
    setShowThankYou(true);
    setTimeout(() => setShowThankYou(false), 3000);
  };

  const handleEditRating = () => {
    setHasRated(false);
  };

  const handleLikeClick = (reviewId: number) => {
    const isLiked = likedReviews.includes(reviewId);
    const updatedLikedReviews = isLiked
        ? likedReviews.filter(id => id !== reviewId)
        : [...likedReviews, reviewId];
    
    setLikedReviews(updatedLikedReviews);

    const updatedReviews = recentReviews.map(reviewItem => {
        if (reviewItem.id === reviewId) {
            return { ...reviewItem, helpful: isLiked ? reviewItem.helpful - 1 : reviewItem.helpful + 1 };
        }
        return reviewItem;
    });
    
    setRecentReviews(updatedReviews);
    
    persistFeedbackData({
        stats,
        reviews: updatedReviews,
        userRatingData: hasRated ? { rating: userRating, comment: review } : null,
        likedReviews: updatedLikedReviews
    });
  };


  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => interactive && handleRatingClick(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            disabled={!interactive}
            className={`transition-all ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          >
            <StarIcon
              className={`w-8 h-8 ${
                star <= (interactive ? (hoverRating || userRating) : rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              } transition-colors`}
            />
          </button>
        ))}
      </div>
    );
  };
  
    const renderSmallStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon
              key={star}
              className={`w-5 h-5 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              } transition-colors`}
            />
        ))}
      </div>
    );
  };

  const calculatePercentage = (count: number) => {
    if (stats.totalRatings === 0) return '0';
    return ((count / stats.totalRatings) * 100).toFixed(0);
  };
  
  const satisfactionPercentage = stats.totalRatings > 0 ? Math.round((stats.averageRating / 5) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <AwardIcon className="text-yellow-500 w-8 h-8" />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('feedback.title')}</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{t('feedback.subtitle')}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-lg p-6 text-white mb-6">
            <div className="flex items-center gap-3">
                <TrendingUpIcon className="w-6 h-6" />
                <h3 className="font-semibold text-lg">{t('feedback.highlights.title')}</h3>
            </div>
            <div className="mt-6 space-y-3">
                <div className="flex justify-between items-baseline">
                    <span className="font-bold text-2xl">{t('feedback.highlights.activeUsers')}</span>
                    <p className="font-bold text-2xl">{totalUsers}</p>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="font-bold text-2xl">{t('feedback.highlights.totalRatings')}</span>
                    <p className="font-bold text-2xl">{stats.totalRatings}</p>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="font-bold text-2xl">{t('feedback.highlights.satisfaction')}</span>
                    <p className="font-bold text-2xl">{satisfactionPercentage}%</p>
                </div>
            </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="text-center mb-4">
                {stats.totalRatings > 0 ? (
                    <>
                        <div className="text-5xl font-bold text-gray-800 dark:text-white mb-2">
                          {stats.averageRating}
                        </div>
                        <div className="flex justify-center mb-2">
                          {renderSmallStars(Math.round(stats.averageRating))}
                        </div>
                        <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                          <UserIcon className="w-4 h-4" />
                          <span className="text-sm">{stats.totalRatings.toLocaleString()} ratings</span>
                        </div>
                    </>
                ) : (
                    <div className="py-4">
                        <p className="text-xl font-bold text-gray-700 dark:text-gray-300">No Ratings Yet</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Be the first to share your feedback!</p>
                    </div>
                )}
              </div>

              <div className="space-y-2 mt-6">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-8">{stars}★</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-yellow-400 h-full transition-all"
                        style={{ width: `${calculatePercentage((stats.distribution as any)[stars])}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-10 text-right">
                      {calculatePercentage((stats.distribution as any)[stars])}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {showThankYou && (
              <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-2xl p-6 flex items-center gap-4 animate-fade-in-down">
                <ThumbsUpIcon className="text-green-600 w-8 h-8" />
                <div>
                  <h3 className="font-bold text-green-800 dark:text-green-300 text-lg">Thank You!</h3>
                  <p className="text-green-700 dark:text-green-400">Your feedback helps us improve</p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
                {hasRated ? 'Your Rating' : 'Rate Your Experience'}
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('feedback.ratingDesc')}</label>
                {renderStars(userRating, !hasRated)}
                {userRating > 0 && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {userRating === 5 ? '⭐ Excellent!' :
                     userRating === 4 ? '😊 Great!' :
                     userRating === 3 ? '👍 Good' :
                     userRating === 2 ? '😐 Okay' : '😔 Needs improvement'}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('feedback.comments')}</label>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  disabled={hasRated}
                  placeholder={t('feedback.commentsPlaceholder' as any)}
                  className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-100 resize-none disabled:bg-gray-50 dark:disabled:bg-gray-700/50"
                  rows={4}
                />
              </div>

              {!hasRated ? (
                <button
                  onClick={handleSubmitRating}
                  className="w-full bg-primary text-primary-text py-3 rounded-lg hover:bg-primary-dark transition-colors font-medium"
                >
                  Submit Rating
                </button>
              ) : (
                <button
                  onClick={handleEditRating}
                  className="w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Edit Rating
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-2 mb-6">
                <ChatBubbleIcon className="text-primary w-6 h-6" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Recent Reviews</h2>
              </div>

              <div className="space-y-4">
                {recentReviews.length > 0 ? recentReviews.map((reviewItem) => {
                    const isLiked = likedReviews.includes(reviewItem.id);
                    return (
                      <div key={reviewItem.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{reviewItem.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {renderSmallStars(reviewItem.rating)}
                              <span className="text-xs text-gray-500 dark:text-gray-400">{reviewItem.date}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">{reviewItem.comment}</p>
                        <button 
                            onClick={() => handleLikeClick(reviewItem.id)}
                            className={`flex items-center gap-1 text-xs transition-colors ${isLiked ? 'text-primary font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light'}`}
                        >
                          <ThumbsUpIcon className={`w-3.5 h-3.5 ${isLiked ? 'fill-primary' : ''}`} />
                          Helpful ({reviewItem.helpful})
                        </button>
                      </div>
                    )
                }) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">Be the first to leave a review!</p>
                )}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default Feedback;