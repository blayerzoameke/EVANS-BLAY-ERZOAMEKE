import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';

const About: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4 text-center">{t('about.title')}</h2>
      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <p className="text-lg font-semibold text-center">{t('about.welcome')}</p>
        <p>{t('about.creator')}</p>
        <p>{t('about.intro')}</p>
        
        <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{t('about.keyFeatures')}</h3>
            <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                <li>{t('about.feature1')}</li>
                <li>{t('about.feature2')}</li>
                <li>{t('about.feature3')}</li>
                <li>{t('about.feature4')}</li>
                <li>{t('about.feature5')}</li>
                <li>{t('about.feature6')}</li>
            </ul>
        </div>

        <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{t('about.missionTitle')}</h3>
            <p className="mt-2 italic">{t('about.missionText')}</p>
        </div>
        <p className="text-center font-bold text-lg pt-4">{t('about.thankYou')}</p>
      </div>
    </div>
  );
};

export default About;