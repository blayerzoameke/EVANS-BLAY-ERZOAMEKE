import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { QuizIcon } from './icons/QuizIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentDuplicateIcon } from './icons/DocumentDuplicateIcon';
import { LockIcon } from './icons/LockIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { UploadCloudIcon } from './icons/UploadCloudIcon';
import type { View } from '../types';

interface AboutProps {
    setView: (view: View) => void;
}

const FeatureCard: React.FC<{ Icon: React.FC<React.SVGProps<SVGSVGElement>>; text: string }> = ({ Icon, text }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border dark:border-gray-700 flex items-start gap-4 h-full">
        <div className="flex-shrink-0 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light rounded-lg p-3">
            <Icon className="w-6 h-6" />
        </div>
        <p className="text-gray-700 dark:text-gray-300">{text}</p>
    </div>
);

const HowItWorksStep: React.FC<{ Icon: React.FC<React.SVGProps<SVGSVGElement>>; title: string; description: string; step: number; }> = ({ Icon, title, description, step }) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-primary dark:text-primary-light rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
            {step}
        </div>
        <div>
            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">{title}</h4>
            <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>
    </div>
);

const About: React.FC<AboutProps> = ({ setView }) => {
  const { t } = useLanguage();
  const appVersion = "1.0.0";

  const features = [
    { text: t('about.feature1' as any), Icon: CalendarIcon },
    { text: t('about.feature2' as any), Icon: BookOpenIcon },
    { text: t('about.feature3' as any), Icon: QuizIcon },
    { text: t('about.feature4' as any), Icon: ChartBarIcon },
    { text: t('about.feature5' as any), Icon: DocumentDuplicateIcon },
    { text: t('about.feature6' as any), Icon: LockIcon },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-8">
        <div className="text-center p-8 bg-gradient-to-br from-primary/10 to-transparent dark:from-primary/20 dark:to-transparent rounded-2xl">
            <LogoIcon className="w-24 h-24 mx-auto text-primary mb-4" />
            <h2 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">{t('about.title')}</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">{t('about.welcome')}</p>
        </div>

        <section>
            <p className="text-lg text-center text-gray-700 dark:text-gray-300">{t('about.creator')}</p>
            <p className="mt-4 text-center text-gray-600 dark:text-gray-400">{t('about.intro')}</p>
        </section>

        <section className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
            <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">{t('about.howItWorks')}</h3>
            <div className="space-y-8">
                <HowItWorksStep Icon={UploadCloudIcon} step={1} title={t('about.step1.title')} description={t('about.step1.desc')}/>
                <HowItWorksStep Icon={CalendarIcon} step={2} title={t('about.step2.title')} description={t('about.step2.desc')}/>
                <HowItWorksStep Icon={BookOpenIcon} step={3} title={t('about.step3.title')} description={t('about.step3.desc')}/>
                <HowItWorksStep Icon={ChartBarIcon} step={4} title={t('about.step4.title')} description={t('about.step4.desc')}/>
            </div>
        </section>

        <section>
            <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">{t('about.keyFeatures')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map((feature, index) => (
                    <FeatureCard key={index} Icon={feature.Icon} text={feature.text} />
                ))}
            </div>
        </section>
        
        <section className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700 flex flex-col items-center text-center">
            <LockIcon className="w-12 h-12 text-green-500 mb-3" />
            <h4 className="text-xl font-bold text-gray-800 dark:text-white">{t('about.privacy.title')}</h4>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">{t('about.privacy.desc')}</p>
        </section>

         <section className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
            <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-4">{t('about.missionTitle')}</h3>
            <blockquote className="text-center text-xl italic text-gray-600 dark:text-gray-400 border-l-4 border-primary pl-4">
                {t('about.missionText')}
            </blockquote>
        </section>
        
        <section className="text-center">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{t('about.getInvolved.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('about.getInvolved.desc')}</p>
            <div className="flex justify-center gap-4">
                <button 
                    onClick={() => setView('feedback')}
                    className="flex items-center gap-2 px-6 py-3 font-semibold text-primary-text bg-primary rounded-lg shadow-md hover:bg-primary-dark transition-colors"
                >
                    {t('about.getInvolved.feedback')} <ArrowRightIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setView('report')}
                    className="flex items-center gap-2 px-6 py-3 font-semibold text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    {t('about.getInvolved.report')} <ArrowRightIcon className="w-4 h-4" />
                </button>
            </div>
        </section>

        <p className="text-center font-bold text-lg pt-4 text-gray-700 dark:text-gray-300">{t('about.thankYou')}</p>

        <footer className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4 border-t dark:border-gray-700">
            {t('about.version', { version: appVersion })}
        </footer>
    </div>
  );
};

export default About;
