import React, { useState } from 'react';
import UserDetailsForm from './UserDetailsForm.tsx';
import { UserDetails, EducationalLevel, Toast } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { LogoIcon } from './icons/LogoIcon.tsx';

interface OnboardingProps {
  onComplete: (details: UserDetails) => void;
  addToast: (message: string, type: Toast['type']) => void;
}

const emptyUserDetails: UserDetails = { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, programmeOfStudy: '' };

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, addToast }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [userDetails, setUserDetails] = useState<UserDetails>(emptyUserDetails);

  const handleNext = () => {
    if (step === 2) {
      if (!userDetails.name.trim()) {
        addToast(t('onboarding.error.nameRequired'), 'error');
        return;
      }
    }
    setStep(s => s + 1);
  };
  
  const handleComplete = () => {
      if (!userDetails.name.trim()) {
        addToast(t('onboarding.error.nameRequired'), 'error');
        return;
      }
      onComplete(userDetails);
  }

  const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => (
    <div className="flex justify-center space-x-2 mb-8">
      {[1, 2].map(s => (
        <div key={s} className={`w-3 h-3 rounded-full ${currentStep === s ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <LogoIcon className="w-16 h-16 mx-auto text-primary mb-2"/>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">EduBlay</h1>
          <p className="text-gray-500">{t('onboarding.welcome')}</p>
        </div>

        <StepIndicator currentStep={step} />

        {step === 1 && (
          <div className="text-center animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">{t('onboarding.step1.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('onboarding.step1.body')}</p>
            <button onClick={handleNext} className="w-full py-3 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark transition-colors">
              {t('onboarding.step1.button')}
            </button>
          </div>
        )}
        
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-semibold text-center mb-4">{t('onboarding.step2.title')}</h2>
            <UserDetailsForm userDetails={userDetails} setUserDetails={setUserDetails} />
            <button onClick={handleComplete} className="mt-6 w-full py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors">
              {t('onboarding.step2.button')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Onboarding;