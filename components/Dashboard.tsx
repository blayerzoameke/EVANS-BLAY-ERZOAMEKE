import React, { useState, useEffect, useCallback } from 'react';
import UserDetailsForm from './UserDetailsForm';
import TimetableInput from './TimetableInput';
import SmartPlanView from './SmartPlanView';
import CourseCodeModal from './CourseCodeModal';
import { generateSmartPlan, generatePlanFromImage, isImageTimetable } from '../services/geminiService';
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, StoredPlan, ImagePart, AppSettings, CourseCodeMap, Toast } from '../types.ts';
import { EducationalLevel, ActivityType } from '../types.ts';
import { UploadIcon } from './icons/UploadIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon.tsx';

const emptyUserDetails: UserDetails = { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, institution: '', country: '', email: '' };

const Dashboard: React.FC<{
  setSmartPlan: (plan: SmartPlan | null) => void;
  smartPlan: SmartPlan | null;
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
  savedTimetables: StoredPlan[];
  setSavedTimetables: (plans: StoredPlan[]) => void;
  appSettings: AppSettings;
  addToast: (message: string, type: Toast['type']) => void;
}> = ({ setSmartPlan, smartPlan, userDetails: initialUserDetails, setUserDetails: setGlobalUserDetails, savedTimetables, setSavedTimetables, appSettings, addToast }) => {
  const [userDetails, setUserDetails] = useState<UserDetails>(initialUserDetails || emptyUserDetails);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [generalGoals, setGeneralGoals] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [tempSmartPlan, setTempSmartPlan] = useState<SmartPlan | null>(null);
  const [courseCodes, setCourseCodes] = useState<string[]>([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const { t } = useLanguage();

  useEffect(() => {
    if (initialUserDetails) {
      setUserDetails(initialUserDetails);
    }
  }, [initialUserDetails]);

  const handleUserDetailsChange = useCallback((details: UserDetails) => {
    setUserDetails(details);
    setGlobalUserDetails(details);
  }, [setGlobalUserDetails]);
  
  const isInputSufficient = !!imageFile ||
    lectures.some(l => l.subject.trim() !== '') ||
    studyGoals.some(g => g.subject.trim() !== '') ||
    agendaItems.some(a => a.title.trim() !== '');

  const extractCourseCodes = (plan: SmartPlan): string[] => {
    const codeRegex = /\b([A-Z]{2,5}\s?\d{2,4})\b/g;
    const codes = new Set<string>();
    plan.forEach(day => {
        day.slots.forEach(slot => {
            if (slot.type === ActivityType.LECTURE || slot.type === ActivityType.STUDY) {
                const matches = slot.activity.match(codeRegex);
                if (matches) {
                    matches.forEach(code => codes.add(code));
                }
            }
        });
    });
    return Array.from(codes);
  };

  const processPlanForCodes = (plan: SmartPlan) => {
      const extractedCodes = extractCourseCodes(plan);
      if (extractedCodes.length > 0) {
          setTempSmartPlan(plan);
          setCourseCodes(extractedCodes);
          setIsCodeModalOpen(true);
      } else {
          setSmartPlan(plan);
      }
  };
  
  const handleNextStep = () => {
    if (!userDetails.name || !userDetails.educationalLevel) {
        setError(t('dashboard.error.fillDetails'));
        return;
    }
    if (userDetails.educationalLevel !== EducationalLevel.HIGH_SCHOOL && !userDetails.country) {
      setError(t('dashboard.error.countryRequired'));
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleGeneratePlan = async () => {
    if (!isInputSufficient) {
        setError(t('dashboard.error.noInput'));
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      let plan;
      if (imageFile) {
        setLoadingMessage(t('dashboard.verifyingImage'));
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onloadend = async () => {
            try {
                const base64String = (reader.result as string).split(',')[1];
                const imagePart: ImagePart = {
                    inlineData: { data: base64String, mimeType: imageFile.type }
                };

                const isTimetable = await isImageTimetable(imagePart);
                if (!isTimetable) {
                    setError(t('dashboard.error.notATimetable'));
                    setIsLoading(false);
                    setLoadingMessage('');
                    return;
                }

                setLoadingMessage(t('dashboard.generating'));
                plan = await generatePlanFromImage(userDetails, studyGoals, generalGoals, imagePart);
                processPlanForCodes(plan);

            } catch (e: any) {
                 setError(e.message || "An unexpected error occurred during image processing.");
            } finally {
                setIsLoading(false);
                setLoadingMessage('');
            }
        };
      } else {
        setLoadingMessage(t('dashboard.generating'));
        plan = await generateSmartPlan(userDetails, lectures, studyGoals, agendaItems, generalGoals);
        processPlanForCodes(plan);
        setIsLoading(false);
        setLoadingMessage('');
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleCourseCodeConfirmation = (confirmedMap: CourseCodeMap) => {
    if (!tempSmartPlan) return;

    const finalPlan = tempSmartPlan.map(day => ({
        ...day,
        slots: day.slots.map(slot => {
            const codeRegex = /\b([A-Z]{2,5}\s?\d{2,4})\b/g;
            const matches = slot.activity.match(codeRegex);
            const code = matches?.[0];

            if (code && code in confirmedMap) {
                const newName = confirmedMap[code];
                if (newName && newName.trim() !== '') {
                    return { ...slot, activity: newName.trim(), code: code };
                } else {
                    return { ...slot, activity: code, code: undefined };
                }
            }
            return slot;
        })
    }));

    setSmartPlan(finalPlan);
    setIsCodeModalOpen(false);
    setTempSmartPlan(null);
    setCourseCodes([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setLectures([]);
      setAgendaItems([]);
    }
  };
  
  const clearImage = () => {
      setImageFile(null);
      setImagePreview(null);
  }

  const handleSavePlan = () => {
      if (smartPlan && planName) {
          const newPlan: StoredPlan = {
              id: Date.now().toString(),
              name: planName,
              createdAt: new Date().toISOString(),
              plan: smartPlan,
              isFavourite: false,
          };
          setSavedTimetables([...savedTimetables, newPlan]);
          setSaveModalOpen(false);
          setPlanName('');
          addToast(t('toasts.planSaved'), 'success');
      }
  };
  
  const handlePrint = () => {
      window.print();
  }
  
  if (smartPlan) {
    return (
        <div id="printable-area">
          <div className="flex justify-between items-center mb-6 no-print">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{t('dashboard.yourSmartPlan')}</h2>
            <div className="flex gap-2">
                <button
                    onClick={() => setSaveModalOpen(true)}
                    className="px-4 py-2 font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                    {t('common.save')}
                </button>
                 {appSettings.printButtonEnabled && (
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                    >
                        {t('dashboard.print')}
                    </button>
                 )}
                <button
                onClick={() => { setSmartPlan(null); setStep(1); }}
                className="px-4 py-2 font-medium text-blue-700 dark:text-blue-500 bg-blue-100 dark:bg-blue-900/50 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                {t('dashboard.createNewPlan')}
                </button>
            </div>
          </div>
          <SmartPlanView plan={smartPlan} />
           {saveModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
                      <h3 className="text-xl font-bold mb-4">{t('mytimetables.renameModalTitle')}</h3>
                      <input 
                          type="text"
                          value={planName}
                          onChange={e => setPlanName(e.target.value)}
                          placeholder={t('dashboard.planNamePlaceholder')}
                          className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
                      />
                      <div className="flex justify-end gap-4 mt-4">
                          <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-md">{t('common.cancel')}</button>
                          <button onClick={handleSavePlan} className="px-4 py-2 bg-blue-700 text-white rounded-md">{t('common.save')}</button>
                      </div>
                  </div>
              </div>
          )}
        </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 md:p-8">
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">{t('dashboard.createPlanTitle')}</h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">{t('dashboard.createPlanSubtitle')}</p>
        
        {step === 1 && (
            <>
                <div className="mt-8">
                    <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">{t('dashboard.yourDetails')}</h3>
                    <UserDetailsForm userDetails={userDetails} setUserDetails={handleUserDetailsChange} disabled={isLoading} />
                </div>
                {error && <p className="mt-4 text-center text-red-500">{error}</p>}
                <div className="mt-8 pt-6 border-t dark:border-slate-700 flex justify-end">
                    <button
                        onClick={handleNextStep}
                        className="px-6 py-2 font-semibold text-white bg-blue-700 rounded-md shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        {t('dashboard.nextStep')}
                    </button>
                </div>
            </>
        )}

        {step === 2 && (
            <>
                <div className="mt-8">
                    <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">{t('dashboard.yourSchedule')}</h3>
                    <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-center mb-6">
                        {!imagePreview ? (
                            <>
                            <label htmlFor="timetable-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600">
                                <UploadIcon className="w-5 h-5" />
                                {t('dashboard.uploadTimetable')}
                            </label>
                            <input id="timetable-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isLoading} />
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('dashboard.manualEntry')}</p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <img src={imagePreview} alt="Timetable preview" className="max-h-48 rounded-md" />
                                <button onClick={clearImage} className="text-sm text-red-500 hover:underline" disabled={isLoading}>{t('dashboard.removeImage')}</button>
                            </div>
                        )}
                    </div>
                     {!imageFile ? (
                        <TimetableInput
                            lectures={lectures} setLectures={setLectures}
                            studyGoals={studyGoals} setStudyGoals={setStudyGoals}
                            agendaItems={agendaItems} setAgendaItems={setAgendaItems}
                            generalGoals={generalGoals} setGeneralGoals={setGeneralGoals}
                            disabled={isLoading}
                        />
                    ) : (
                        <div className="w-full mt-8">
                            <TimetableInput
                                lectures={[]} setLectures={()=>{}}
                                studyGoals={studyGoals} setStudyGoals={setStudyGoals}
                                agendaItems={[]} setAgendaItems={()=>{}}
                                generalGoals={generalGoals} setGeneralGoals={setGeneralGoals}
                                disabled={isLoading}
                            />
                        </div>
                    )}
                </div>
                {error && <p className="mt-4 text-center text-red-500">{error}</p>}
                <div className="mt-8 pt-6 border-t dark:border-slate-700 flex items-center justify-between">
                    <button
                        onClick={() => setStep(1)}
                        className="px-6 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                        {t('dashboard.previousStep')}
                    </button>
                    <button
                        onClick={handleGeneratePlan}
                        disabled={isLoading || !isInputSufficient}
                        className="px-10 py-3 text-lg font-semibold text-white bg-blue-700 rounded-lg shadow-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? loadingMessage : t('dashboard.generatePlan')}
                    </button>
                </div>
            </>
        )}
      </div>
      
      {isCodeModalOpen && (
        <CourseCodeModal 
            isOpen={isCodeModalOpen}
            onClose={() => {
                setSmartPlan(tempSmartPlan);
                setIsCodeModalOpen(false);
                setTempSmartPlan(null);
                setCourseCodes([]);
            }}
            onConfirm={handleCourseCodeConfirmation}
            codes={courseCodes}
        />
      )}
    </div>
  );
};

export default Dashboard;