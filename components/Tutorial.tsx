import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';

const TutorialStep: React.FC<{
    step: number;
    titleKey: string;
    descKey: string;
    imageText: string;
    altKey: string;
}> = ({ step, titleKey, descKey, imageText, altKey }) => {
    const { t } = useLanguage();
    const imageUrl = `https://via.placeholder.com/800x450.png/1e293b/ffffff?text=${encodeURIComponent(imageText)}`;
    return (
        <section className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
                <span className="text-primary">{t('tutorial.step')} {step}:</span> {t(titleKey as any)}
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">{t(descKey as any)}</p>
            <div className="bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden">
                <img src={imageUrl} alt={t(altKey as any)} className="w-full h-auto" />
            </div>
        </section>
    );
};


const Tutorial: React.FC = () => {
    const { t } = useLanguage();

    const steps = [
        { step: 1, titleKey: 'tutorial.step1.title', descKey: 'tutorial.step1.desc', imageText: 'Step 1: Onboarding', altKey: 'tutorial.step1.alt' },
        { step: 2, titleKey: 'tutorial.step2.title', descKey: 'tutorial.step2.desc', imageText: 'Step 2: Upload Timetable', altKey: 'tutorial.step2.alt' },
        { step: 3, titleKey: 'tutorial.step3.title', descKey: 'tutorial.step3.desc', imageText: 'Step 3: Manual Input', altKey: 'tutorial.step3.alt' },
        { step: 4, titleKey: 'tutorial.step4.title', descKey: 'tutorial.step4.desc', imageText: 'Step 4: View Your Plan', altKey: 'tutorial.step4.alt' },
        { step: 5, titleKey: 'tutorial.step5.title', descKey: 'tutorial.step5.desc', imageText: 'Step 5: Learning Hub', altKey: 'tutorial.step5.alt' },
        { step: 6, titleKey: 'tutorial.step6.title', descKey: 'tutorial.step6.desc', imageText: 'Step 6: Interact with AI', altKey: 'tutorial.step6.alt' },
        { step: 7, titleKey: 'tutorial.step7.title', descKey: 'tutorial.step7.desc', imageText: 'Step 7: Generate a Quiz', altKey: 'tutorial.step7.alt' },
        { step: 8, titleKey: 'tutorial.step8.title', descKey: 'tutorial.step8.desc', imageText: 'Step 8: Solve a Problem', altKey: 'tutorial.step8.alt' },
        { step: 9, titleKey: 'tutorial.step9.title', descKey: 'tutorial.step9.desc', imageText: 'Step 9: Track Progression', altKey: 'tutorial.step9.alt' },
        { step: 10, titleKey: 'tutorial.step10.title', descKey: 'tutorial.step10.desc', imageText: 'Step 10: Manage Notes', altKey: 'tutorial.step10.alt' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('tutorial.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('tutorial.subtitle')}</p>
            </div>
            
            <section className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">{t('tutorial.video.title')}</h3>
                <div className="aspect-video bg-gray-200 dark:bg-gray-900 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">{t('tutorial.video.placeholder')}</p>
                </div>
            </section>
            
            <div className="space-y-6">
                {steps.map(stepInfo => <TutorialStep key={stepInfo.step} {...stepInfo} />)}
            </div>
        </div>
    );
};

export default Tutorial;
