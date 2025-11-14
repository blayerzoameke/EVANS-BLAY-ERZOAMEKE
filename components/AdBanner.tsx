import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';
import { CrownIcon } from './icons/CrownIcon';
import type { View } from '../types';

interface AdBannerProps {
  setView: (view: View) => void;
}

const AdBanner: React.FC<AdBannerProps> = ({ setView }) => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-3 text-center z-50 shadow-lg no-print animate-fade-in-down">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <CrownIcon className="w-6 h-6 text-yellow-400 hidden sm:block" />
            <p className="text-sm text-left">{t('monetization.adBanner.text')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={() => setView('pricing')} 
            className="px-4 py-2 text-sm font-semibold bg-primary text-primary-text rounded-md hover:bg-primary-dark whitespace-nowrap"
          >
            {t('monetization.adBanner.button')}
          </button>
          <button 
            onClick={() => setIsVisible(false)} 
            className="p-2 rounded-full hover:bg-white/20" 
            aria-label={t('common.close')}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdBanner;