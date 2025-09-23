import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import UserDetailsForm from './UserDetailsForm.tsx';
import TimetableInput from './TimetableInput.tsx';
import SmartPlanView from './SmartPlanView.tsx';
import CourseCodeModal from './CourseCodeModal.tsx';
import LogStudyModal from './LogStudyModal.tsx';
import { generateSmartPlan, generatePlanFromImage, isImageTimetable } from '../services/geminiService.ts';
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, StoredPlan, ImagePart, CourseCodeMap, Toast, ActiveSession, PlanSlot, TrackedSession, GenerationState, DashboardInputState } from '../types.ts';
import { EducationalLevel, ActivityType, DayOfWeek } from '../types.ts';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { LogoIcon } from './icons/LogoIcon.tsx';
import { DAYS_OF_WEEK } from '../constants.ts';

const emptyUserDetails: UserDetails = { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, institution: '', country: '', email: '', programmeOfStudy: '', institutionAbbreviation: '' };

const timeToMinutes = (time: string): number => {
    if (!time || !time.includes(':')) return 0;
    try {
        const timeParts = time.split(' ');
        const [hourStr, minuteStr] = timeParts[0].split(':');
        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr, 10);

        if (timeParts.length > 1 && timeParts[1].toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
        }
        if (timeParts.length > 1 && timeParts[1].toUpperCase() === 'AM' && hours === 12) {
            hours = 0; // Midnight case
        }
        return hours * 60 + minutes;
    } catch {
        return 0;
    }
};

const getDayOfWeek = (date: Date): DayOfWeek => {
    const dayIndex = date.getDay(); // Sunday - 0, Monday - 1, ...
    const days: DayOfWeek[] = [DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday];
    return days[dayIndex];
};

const LoadingOverlay: React.FC<{ isLoading: boolean; message: string }> = ({ isLoading, message }) => {
    if (!isLoading) return null;
    return (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex flex-col items-center justify-center z-30 rounded-xl backdrop-blur-sm">
            <div className="animate-spin w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"></div>
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{message}</p>
        </div>
    );
};

interface DashboardProps {
  setSmartPlan: (plan: SmartPlan | null) => void;
  smartPlan: SmartPlan | null;
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
  savedTimetables: StoredPlan[];
  setSavedTimetables: (plans: StoredPlan[]) => void;
  addToast: (message: string, type: Toast['type']) => void;
  setActiveSession: (session: ActiveSession | null) => void;
  trackedData: TrackedSession[];
  setTrackedData: (data: TrackedSession[]) => void;
  generationState: GenerationState;
  setGenerationState: React.Dispatch<React.SetStateAction<GenerationState>>;
  dashboardInputs: DashboardInputState;
  setDashboardInputs: React.Dispatch<React.SetStateAction<DashboardInputState>>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    setSmartPlan, 
    smartPlan, 
    userDetails: initialUserDetails, 
    setUserDetails: setGlobalUserDetails, 
    savedTimetables, 
    setSavedTimetables, 
    addToast, 
    setActiveSession, 
    trackedData, 
    setTrackedData,
    generationState,
    setGenerationState,
    dashboardInputs,
    setDashboardInputs
}) => {
  const [userDetails, setUserDetails] = useState<UserDetails>(initialUserDetails || emptyUserDetails);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [tempSmartPlan, setTempSmartPlan] = useState<SmartPlan | null>(null);
  const [courseCodes, setCourseCodes] = useState<string[]>([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [selectedSlotForLog, setSelectedSlotForLog] = useState<{ slot: PlanSlot; day: DayOfWeek } | null>(null);
  const { t } = useLanguage();
  
  const { lectures, studyGoals, agendaItems, generalGoals, imageFile, imagePreview, step, isManualPlan } = dashboardInputs;

  // FIX: Moved useCallback hooks from JSX props to the top level of the component to follow the Rules of Hooks.
  const setLectures = useCallback((updater: React.SetStateAction<Lecture[]>) => {
      setDashboardInputs(prev => ({ ...prev, lectures: typeof updater === 'function' ? updater(prev.lectures) : updater }));
  }, [setDashboardInputs]);

  const setStudyGoals = useCallback((updater: React.SetStateAction<StudyGoal[]>) => {
      setDashboardInputs(prev => ({ ...prev, studyGoals: typeof updater === 'function' ? updater(prev.studyGoals) : updater }));
  }, [setDashboardInputs]);
  
  const setAgendaItems = useCallback((updater: React.SetStateAction<AgendaItem[]>) => {
      setDashboardInputs(prev => ({ ...prev, agendaItems: typeof updater === 'function' ? updater(prev.agendaItems) : updater }));
  }, [setDashboardInputs]);

  const setGeneralGoals = useCallback((goals: string) => {
      setDashboardInputs(prev => ({ ...prev, generalGoals: goals }));
  }, [setDashboardInputs]);

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
    
  const isManualInputStarted = lectures.some(l => l.subject.trim() !== '') || studyGoals.some(g => g.subject.trim() !== '');

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
        setGenerationState({ ...generationState, error: t('dashboard.error.fillDetails'), source: 'dashboard' });
        return;
    }
    if (userDetails.educationalLevel !== EducationalLevel.HIGH_SCHOOL && !userDetails.country) {
      setGenerationState({ ...generationState, error: t('dashboard.error.countryRequired'), source: 'dashboard' });
      return;
    }
    setGenerationState({ ...generationState, error: null, source: 'dashboard' });
    setDashboardInputs(prev => ({ ...prev, step: 2 }));
  };

  const handleGeneratePlan = async () => {
    if (!isInputSufficient) {
        setGenerationState({ ...generationState, error: t('dashboard.error.noInput'), source: 'dashboard' });
        return;
    }

    setGenerationState({ isLoading: true, message: '', error: null, source: 'dashboard' });
    try {
      let plan;
      if (imageFile) {
        setDashboardInputs(prev => ({ ...prev, isManualPlan: false }));
        setGenerationState(prev => ({ ...prev, message: t('dashboard.verifyingImage') }));
        
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
                    setGenerationState({ isLoading: false, message: '', error: t('dashboard.error.notATimetable'), source: 'dashboard' });
                    return;
                }

                setGenerationState(prev => ({ ...prev, message: t('dashboard.generating') }));
                plan = await generatePlanFromImage(userDetails, studyGoals, generalGoals, imagePart);
                processPlanForCodes(plan);
                setGenerationState({ isLoading: false, message: '', error: null, source: null });

            } catch (e: any) {
                 setGenerationState({ isLoading: false, message: '', error: e.message || "An unexpected error occurred during image processing.", source: 'dashboard' });
            }
        };
      } else {
        setDashboardInputs(prev => ({ ...prev, isManualPlan: true }));
        setGenerationState(prev => ({ ...prev, message: t('dashboard.generating') }));
        plan = await generateSmartPlan(userDetails, lectures, studyGoals, agendaItems, generalGoals);
        processPlanForCodes(plan);
        setGenerationState({ isLoading: false, message: '', error: null, source: null });
      }
    } catch (e: any) {
      setGenerationState({ isLoading: false, message: '', error: e.message || "An unexpected error occurred.", source: 'dashboard' });
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
        setDashboardInputs(prev => ({
            ...prev,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            lectures: [],
            agendaItems: [],
        }));
    }
  }, [setDashboardInputs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    multiple: false,
    disabled: generationState.isLoading || isManualInputStarted,
  });
  
  const clearImage = () => {
      setDashboardInputs(prev => ({ ...prev, imageFile: null, imagePreview: null }));
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
  
  const handleOpenLogModal = (slot: PlanSlot, day: DayOfWeek) => {
    setSelectedSlotForLog({ slot, day });
  };
  
  const handleEditInputs = () => {
    setSmartPlan(null);
    setDashboardInputs(prev => ({...prev, step: 2}));
  };

  const handleStartOver = () => {
    setSmartPlan(null);
    setDashboardInputs({
        lectures: [],
        studyGoals: [],
        agendaItems: [],
        generalGoals: '',
        imageFile: null,
        imagePreview: null,
        step: 1,
        isManualPlan: false,
    });
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {smartPlan ? (
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('dashboard.yourSmartPlan')}</h2>
            <div className="flex gap-2">
              <button onClick={handleEditInputs} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.editInputs')}</button>
              <button onClick={handleStartOver} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.startOver')}</button>
              <button onClick={() => setSaveModalOpen(true)} className="px-4 py-2 text-sm font-medium text-primary-text bg-primary rounded-md hover:bg-primary-dark">{t('common.save')}</button>
            </div>
          </div>
          <SmartPlanView plan={smartPlan} onStudySlotClick={handleOpenLogModal} />
        </div>
      ) : (
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-10">
            <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'dashboard'} message={generationState.message} />
             {step === 1 ? (
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{t('dashboard.createPlanTitle')}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">{t('dashboard.createPlanSubtitle')}</p>
                  <UserDetailsForm userDetails={userDetails} setUserDetails={handleUserDetailsChange} />
                  {generationState.error && generationState.source === 'dashboard' && <p className="text-red-500 mt-4">{generationState.error}</p>}
                  <button onClick={handleNextStep} className="mt-6 w-full py-3 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark transition-colors">{t('common.next')}</button>
                </div>
              ) : (
                 <div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">{t('dashboard.step2.title')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">{t('dashboard.step2.subtitle')}</p>
                   <div {...getRootProps()} className={`group p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isManualInputStarted ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'} border-gray-300 dark:border-gray-600 text-center ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : ''}`}>
                     <input {...getInputProps()} />
                     {imagePreview ? (
                         <div className="relative">
                           <img src={imagePreview} alt="Timetable preview" className="max-h-52 mx-auto rounded-lg shadow-md" />
                           <button onClick={(e) => { e.stopPropagation(); clearImage(); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg">&times;</button>
                         </div>
                     ) : (
                        <>
                            <UploadIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="font-semibold text-gray-700 dark:text-gray-300">{isManualInputStarted ? t('dashboard.uploadDisabled') : t('dashboard.uploadTimetable')}</p>
                            <p className="text-sm text-gray-500">{t('dashboard.uploadTimetable.hint')}</p>
                        </>
                     )}
                   </div>
                   <div className="flex items-center my-6">
                     <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                     <span className="flex-shrink mx-4 text-gray-500 font-semibold">OR</span>
                     <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                   </div>
                    <div className="text-center mb-4">
                        <p className="text-gray-600 dark:text-gray-400">{t('dashboard.manualEntry')}</p>
                    </div>
                   <TimetableInput 
                       lectures={lectures} setLectures={setLectures} 
                       studyGoals={studyGoals} setStudyGoals={setStudyGoals}
                       agendaItems={agendaItems} setAgendaItems={setAgendaItems}
                       generalGoals={generalGoals} setGeneralGoals={setGeneralGoals}
                       manualSectionsDisabled={!!imageFile}
                   />
                   {generationState.error && generationState.source === 'dashboard' && <p className="text-red-500 mt-4">{generationState.error}</p>}
                   <button onClick={handleGeneratePlan} className="mt-8 w-full py-4 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed transition-all" disabled={!isInputSufficient || generationState.isLoading}>
                     {t('dashboard.generatePlan')}
                   </button>
                 </div>
              )}
        </div>
      )}

      {saveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Save Plan</h3>
            <input type="text" value={planName} onChange={e => setPlanName(e.target.value)} placeholder={t('dashboard.planNamePlaceholder')} className="w-full p-2 border rounded-md dark:bg-gray-700" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
              <button onClick={handleSavePlan} className="px-4 py-2 bg-primary text-primary-text rounded-md">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
      
      {isCodeModalOpen && (
        <CourseCodeModal
            isOpen={isCodeModalOpen}
            onClose={() => setIsCodeModalOpen(false)}
            onConfirm={handleCourseCodeConfirmation}
            codes={courseCodes}
        />
      )}
      
       {selectedSlotForLog && (
        <LogStudyModal
          isOpen={!!selectedSlotForLog}
          onClose={() => setSelectedSlotForLog(null)}
          onStartSession={(slot) => {
              const now = Date.now();
              const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
              const newSession: ActiveSession = {
                  startTime: now,
                  endTime: now + duration * 60 * 1000,
                  subject: slot.activity,
                  type: ActivityType.STUDY,
                  fromSlot: slot,
                  nextSlot: null // This needs to be populated properly
              };
              setActiveSession(newSession);
              setSelectedSlotForLog(null);
              addToast(t('toasts.sessionStarted'), 'success');
          }}
          onLogTime={(subject, duration, date) => {
              setTrackedData([...trackedData, { subject, durationMinutes: duration, date }]);
              addToast(t('toasts.logSaved'), 'success');
          }}
          slot={selectedSlotForLog.slot}
          day={selectedSlotForLog.day}
        />
      )}

    </div>
  );
};

export default Dashboard;