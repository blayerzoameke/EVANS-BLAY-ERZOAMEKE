import React, { useState } from 'react';
import UserDetailsForm from './UserDetailsForm';
import type { UserDetails, Toast } from '../types';
import { EducationalLevel } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon';

interface OnboardingProps {
    onComplete: (details: UserDetails) => void;
    addToast: (message: string, type: Toast['type']) => void;
}

const emptyUserDetails: UserDetails = {
    name: '',
    educationalLevel: EducationalLevel.UNDERGRADUATE,
    country: '',
    institution: '',
};

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, addToast }) => {
    const [step, setStep] = useState(1);
    const [userDetails, setUserDetails] = useState<UserDetails>(emptyUserDetails);
    const { t } = useLanguage();

    const handleNext = () => {
        if (step === 2) {
            if (!userDetails.name.trim()) {
                // @ts-ignore
                addToast(t('onboarding.error.nameRequired'), 'error');
                return;
            }
             if (userDetails.educationalLevel !== EducationalLevel.HIGH_SCHOOL && !userDetails.country) {
                // @ts-ignore
                addToast(t('onboarding.error.countryRequired'), 'error');
                return;
            }
        }
        setStep(prev => prev + 1);
    };

    const handleComplete = () => {
        if (!userDetails.name.trim()) {
            // @ts-ignore
            addToast(t('onboarding.error.nameRequired'), 'error');
            setStep(2); // Go back to details step
            return;
        }
        onComplete(userDetails);
    };

    const ProgressBar: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
                <div className="text-center mb-4">
                    <LogoIcon className="w-12 h-12 text-sky-600 dark:text-sky-400 mx-auto" />
                </div>
                
                <ProgressBar currentStep={step} totalSteps={3} />

                {step === 1 && (
                    <div className="text-center animate-fade-in">
                        {/* @ts-ignore */}
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('onboarding.welcome.title')}</h1>
                        {/* @ts-ignore */}
                        <p className="mt-2 text-gray-600 dark:text-gray-400">{t('onboarding.welcome.subtitle')}</p>
                        {/* @ts-ignore */}
                        <button onClick={handleNext} className="mt-8 w-full py-3 px-4 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800">{t('onboarding.welcome.cta')}</button>
                    </div>
                )}
                {step === 2 && (
                    <div className="animate-fade-in">
                        {/* @ts-ignore */}
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('onboarding.details.title')}</h2>
                        {/* @ts-ignore */}
                        <p className="mt-1 text-gray-600 dark:text-gray-400">{t('onboarding.details.subtitle')}</p>
                        <div className="mt-6">
                            <UserDetailsForm userDetails={userDetails} setUserDetails={setUserDetails} />
                        </div>
                        <div className="mt-8 flex justify-between">
                             <button onClick={() => setStep(1)} className="py-2 px-4 bg-gray-200 dark:bg-gray-600 font-semibold rounded-lg shadow-md">{t('common.previous')}</button>
                             <button onClick={handleNext} className="py-2 px-6 bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:bg-blue-800">{t('common.next')}</button>
                        </div>
                    </div>
                )}
                {step === 3 && (
                     <div className="text-center animate-fade-in">
                        {/* @ts-ignore */}
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('onboarding.finish.title')}</h2>
                        {/* @ts-ignore */}
                        <p className="mt-2 text-gray-600 dark:text-gray-400">{t('onboarding.finish.subtitle')}</p>
                        {/* @ts-ignore */}
                         <button onClick={handleComplete} className="mt-8 w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">{t('onboarding.finish.cta')}</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
