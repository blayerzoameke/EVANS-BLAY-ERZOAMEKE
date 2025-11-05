import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
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

interface TutorialProps {
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    tutorialVideoUrl: string;
    setTutorialVideoUrl: (url: string) => void;
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

const getEmbedUrl = (url: string): string => {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        let videoId = null;
        if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtu.be')) {
            videoId = urlObj.pathname.slice(1);
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}?origin=${window.location.origin}` : url;
    } catch (e) {
        return url; // Return original if parsing fails
    }
};

const Tutorial: React.FC<TutorialProps> = ({ addToast, tutorialVideoUrl, setTutorialVideoUrl }) => {
    const { t } = useLanguage();
    const [isEditingVideo, setIsEditingVideo] = useState(false);
    const [tempVideoUrl, setTempVideoUrl] = useState(tutorialVideoUrl);
    
    const handleSaveVideoUrl = () => {
        setTutorialVideoUrl(tempVideoUrl);
        setIsEditingVideo(false);
    };

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
                        {!isEditingVideo && (
                            <button onClick={() => { setTempVideoUrl(tutorialVideoUrl); setIsEditingVideo(true); }} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                                <PencilIcon className="w-4 h-4" /> {t('tutorial.video.edit' as any)}
                            </button>
                        )}
                    </div>
                     {isEditingVideo ? (
                        <div className="space-y-2">
                            <input
                                type="url"
                                value={tempVideoUrl}
                                onChange={(e) => setTempVideoUrl(e.target.value)}
                                placeholder={t('tutorial.video.urlPlaceholder' as any)}
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsEditingVideo(false)} className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 rounded-md">{t('tutorial.video.cancel' as any)}</button>
                                <button onClick={handleSaveVideoUrl} className="px-4 py-1.5 text-sm bg-primary text-primary-text rounded-md">{t('tutorial.video.save' as any)}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-video bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden shadow-lg">
                            <iframe
                                className="w-full h-full"
                                src={getEmbedUrl(tutorialVideoUrl)}
                                title={t('tutorial.video.title' as any)}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    )}
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