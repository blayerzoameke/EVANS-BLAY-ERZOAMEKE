import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Gift, Play, Crown, X, Clock, Zap, TrendingUp } from 'lucide-react';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdWatched: () => void;
  onUpgrade: () => void;
  featureName: string;
  rewardAmount: number;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  onAdWatched,
  onUpgrade,
  featureName,
  rewardAmount,
}) => {
  const { t } = useLanguage();
  const [stage, setStage] = useState<'offer' | 'watching' | 'reward'>('offer');
  const [countdown, setCountdown] = useState(15);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal is closed
      setTimeout(() => {
        setStage('offer');
        setCountdown(15);
        setProgress(0);
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stage === 'watching') {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setStage('reward');
            return 0;
          }
          return prev - 1;
        });
        setProgress((prev) => Math.min(prev + (100 / 15), 100));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [stage]);

  const handleWatchAd = () => {
    setStage('watching');
  };

  const handleClaimReward = () => {
    onAdWatched();
    onClose(); 
  };
  
  const handleUpgradeClick = () => {
      onUpgrade();
      onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-down">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl">
        
        {stage === 'offer' && (
          <>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {t('rewardedAd.title')}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {featureName}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-4">{t('rewardedAd.message')}</p>

              <div className="space-y-3">
                <button
                  onClick={handleWatchAd}
                  className="w-full bg-gradient-to-r from-blue-600 to-sky-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  {t('rewardedAd.watchAdButton', { rewardAmount })}
                </button>

                <button
                  onClick={handleUpgradeClick}
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Crown className="w-5 h-5" />
                  {t('rewardedAd.upgradeButton')}
                </button>

                <button
                  onClick={onClose}
                  className="w-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 py-2 px-6 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                >
                  {t('rewardedAd.maybeLaterButton')}
                </button>
              </div>
            </div>
          </>
        )}

        {stage === 'watching' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-sky-500 rounded-full flex items-center justify-center mx-auto mb-4 relative">
              <Clock className="w-10 h-10 text-white" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-200 animate-ping" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('rewardedAd.watching.title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('rewardedAd.watching.body', { countdown })}
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-600 to-sky-600 h-full rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">{t('rewardedAd.watching.simulationNotice')}</p>
          </div>
        )}

        {stage === 'reward' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-4 py-2 rounded-full mb-4">
              <TrendingUp className="w-4 h-4" />
              <span className="font-semibold">{t('rewardedAd.reward.unlocked')}</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('rewardedAd.reward.title', { rewardAmount })}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('rewardedAd.reward.body', { featureName })}
            </p>
            <button
              onClick={handleClaimReward}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              {t('rewardedAd.reward.claimButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
