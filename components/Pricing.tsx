import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { UserDetails } from '../types';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { CrownIcon } from './icons/CrownIcon';
import { AlertCircleIcon } from './icons/AlertCircleIcon';

interface PricingProps {
  userDetails: UserDetails | null;
  onUpgrade: (isYearly: boolean) => void;
}

const Pricing: React.FC<PricingProps> = ({ userDetails, onUpgrade }) => {
  const { t } = useLanguage();
  const [isYearly, setIsYearly] = useState(false);
  
  const isPremium = userDetails?.subscriptionTier === 'premium';

  const freeFeatures = [
    { textKey: "pricing.feature.timetables.free", included: true },
    { textKey: "pricing.feature.materials.free", included: true },
    { textKey: "pricing.feature.quizzes.free", included: true },
    { textKey: "pricing.feature.solver.free", included: true },
    { textKey: "pricing.feature.ads.free", included: false },
    { textKey: "pricing.feature.export", included: false },
  ];

  const premiumFeatures = [
    { textKey: "pricing.feature.timetables.premium", included: true },
    { textKey: "pricing.feature.materials.premium", included: true },
    { textKey: "pricing.feature.quizzes.premium", included: true },
    { textKey: "pricing.feature.solver.premium", included: true },
    { textKey: "pricing.feature.ads.premium", included: true },
    { textKey: "pricing.feature.export", included: true },
  ];


  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">{t('pricing.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{t('pricing.subtitle')}</p>
      </div>

      <div className="flex justify-center items-center gap-4">
        <span className={`font-semibold ${!isYearly ? 'text-primary' : ''}`}>{t('pricing.monthly')}</span>
        <button
          onClick={() => setIsYearly(!isYearly)}
          className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors bg-gray-200 dark:bg-gray-700"
        >
          <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
              isYearly ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`font-semibold ${isYearly ? 'text-primary' : ''}`}>{t('pricing.yearly')}</span>
        {isYearly && <span className="text-sm font-bold text-green-500 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">{t('pricing.yearly.savings')}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Free Plan */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border dark:border-gray-700 flex flex-col">
            <h3 className="text-2xl font-bold">{t('pricing.free.title')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 h-10">{t('pricing.free.desc')}</p>
            <p className="text-4xl font-bold my-6">{t('pricing.free.price')}</p>
            <button disabled={!isPremium} className="w-full py-3 font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                {t('pricing.button.free')}
            </button>
            <ul className="space-y-3 mt-8 flex-1">
                {freeFeatures.map(feature => (
                    <li key={feature.textKey} className={`flex items-start gap-3 ${!feature.included ? 'text-gray-400 dark:text-gray-500' : ''}`}>
                        {feature.included ? <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /> : <AlertCircleIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />}
                        <span>{t(feature.textKey as any)}</span>
                    </li>
                ))}
            </ul>
        </div>

        {/* Premium Plan */}
        <div className="bg-gradient-to-br from-primary to-sky-400 dark:from-primary-dark dark:to-sky-700 text-white rounded-2xl shadow-2xl p-8 flex flex-col ring-4 ring-primary/50">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold flex items-center gap-2"><CrownIcon className="w-6 h-6" /> {t('pricing.premium.title')}</h3>
                <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">{t('pricing.premium.popular')}</span>
            </div>
            <p className="opacity-80 mt-1 h-10">{t('pricing.premium.desc')}</p>
            <p className="text-4xl font-bold my-6">
                {isYearly ? t('pricing.premium.price.yearly') : t('pricing.premium.price.monthly')}
                <span className="text-base font-medium opacity-80">/{isYearly ? t('pricing.yearly.short') : t('pricing.monthly.short')}</span>
            </p>
            <button
                onClick={() => onUpgrade(isYearly)}
                disabled={isPremium}
                className="w-full py-3 font-bold text-lg rounded-lg bg-white text-primary hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
                {isPremium ? t('pricing.button.current') : t('pricing.button.upgrade')}
            </button>
             <ul className="space-y-3 mt-8 flex-1">
                <li className="font-bold pb-2 border-b border-white/20">
                    {t('pricing.premium.includesFree' as any)}
                </li>
                {premiumFeatures.map(feature => (
                    <li key={feature.textKey} className="flex items-start gap-3 pt-3">
                        <CheckCircleIcon className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                        <span>{t(feature.textKey as any)}</span>
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </div>
  );
};

export default Pricing;