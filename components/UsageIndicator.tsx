import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { FeatureName } from '../types';

interface UsageIndicatorProps {
  featureName: FeatureName;
  used: number;
  limit: number;
  period: 'day' | 'month' | 'total';
  className?: string;
}

const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  featureName,
  used,
  limit,
  period,
  className = '',
}) => {
  const { t } = useLanguage();
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isLow = limit > 0 && (limit - used) <= 2 && used < limit;
  const isDepleted = used >= limit;

  const featureKeyMap: Record<FeatureName, string> = {
    timetables: 'pricing.feature.timetables',
    uploads: 'pricing.feature.materials',
    quizzes: 'pricing.feature.quizzes',
    solves: 'pricing.feature.solver',
    collaboration: 'pricing.feature.collaboration',
  };

  const barColor = isDepleted ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500';

  let resetsText = '';
  if (period !== 'total' && isDepleted) {
    const periodResetKey = period === 'day' ? 'usage.period.tomorrow' : 'usage.period.nextMonth';
    resetsText = t('usage.resets', { period: t(periodResetKey) });
  }

  return (
    <div className={`p-3 rounded-lg border ${
      isLow || isDepleted
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' 
        : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
    } ${className}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t(featureKeyMap[featureName])} ({t(`usage.period.${period}`)})
        </span>
        <span className={`text-sm font-bold ${
          isLow || isDepleted ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-900 dark:text-white'
        }`}>
          {used} / {limit}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {resetsText && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {resetsText}
        </p>
      )}
    </div>
  );
};

export default UsageIndicator;