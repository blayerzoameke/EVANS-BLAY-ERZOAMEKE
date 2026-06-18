import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { UserCircleIcon } from './icons/UserCircleIcon.tsx';
import { UploadCloudIcon } from './icons/UploadCloudIcon.tsx';
import { EditIcon } from './icons/EditIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { BookOpenIcon } from './icons/BookOpenIcon.tsx';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon.tsx';
import { QuizIcon } from './icons/QuizIcon.tsx';
import { CalculatorIcon } from './icons/CalculatorIcon.tsx';
import { ChartBarIcon } from './icons/ChartBarIcon.tsx';
import { DocumentDuplicateIcon } from './icons/DocumentDuplicateIcon.tsx';
import { PencilIcon } from './icons/PencilIcon.tsx';
import YouTubeThumbnail from './YouTubeThumbnail.tsx';

interface TutorialProps {
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    tutorialVideoUrl: string;
}

interface TutorialStepProps {
    step: number;
    titleKey: string;
    descKey: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const TutorialStep: React.FC<TutorialStepProps> = ({ step, titleKey, descKey, Icon }) => {
    const { t } = useLanguage();

    return (
        <div className="w-full text-left bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-start gap-6">
                <div className="flex-shrink-0 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light rounded-full w-16 h-16 flex items-center justify-center">
                    <Icon className="w-8 h-8"/>
                </div>
                <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">
                        <span className="text-primary">{t('tutorial.step')} {step}:</span> {t(titleKey as any)}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">{t(descKey as any)}</p>
                </div>
            </div>
        </div>
    );
};

const Tutorial: React.FC<TutorialProps> = ({ addToast, tutorialVideoUrl }) => {
    const { t } = useLanguage();
    
    const steps = [
        { step: 1, titleKey: 'tutorial.step1.title', descKey: 'tutorial.step1.desc', Icon: UserCircleIcon },
        { step: 2, titleKey: 'tutorial.step2.title', descKey: 'tutorial.step2.desc', Icon: UploadCloudIcon },
        { step: 3, titleKey: 'tutorial.step3.title', descKey: 'tutorial.step3.desc', Icon: EditIcon },
        { step: 4, titleKey: 'tutorial.step4.title', descKey: 'tutorial.step4.desc', Icon: CalendarIcon },
        { step: 5, titleKey: 'tutorial.step5.title', descKey: 'tutorial.step5.desc', Icon: BookOpenIcon },
        { step: 6, titleKey: 'tutorial.step6.title', descKey: 'tutorial.step6.desc', Icon: ChatBubbleIcon },
        { step: 7, titleKey: 'tutorial.step7.title', descKey: 'tutorial.step7.desc', Icon: QuizIcon },
        { step: 8, titleKey: 'tutorial.step8.title', descKey: 'tutorial.step8.desc', Icon: CalculatorIcon },
        { step: 9, titleKey: 'tutorial.step9.title', descKey: 'tutorial.step9.desc', Icon: ChartBarIcon },
        { step: 10, titleKey: 'tutorial.step10.title', descKey: 'tutorial.step10.desc', Icon: DocumentDuplicateIcon },
    ];

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('tutorial.title')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('tutorial.subtitle')}</p>
                </div>
                
                <section className="bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{t('tutorial.video.title')}</h3>
                    </div>
                    {/* Use the new YouTubeThumbnail component */}
                    <YouTubeThumbnail videoUrl={tutorialVideoUrl} />
                </section>
                
                <div className="space-y-6">
                    {steps.map(stepInfo => (
                         <TutorialStep 
                            key={stepInfo.step}
                            step={stepInfo.step}
                            titleKey={stepInfo.titleKey}
                            descKey={stepInfo.descKey}
                            Icon={stepInfo.Icon}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};

export default Tutorial;