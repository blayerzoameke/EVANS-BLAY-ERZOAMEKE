import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import UserDetailsForm from './UserDetailsForm';
import TimetableInput from './TimetableInput';
import SmartPlanView from './SmartPlanView';
import CourseCodeModal from './CourseCodeModal';
import { generateSmartPlan, generatePlanFromImage, isImageTimetable } from '../services/geminiService';
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, StoredPlan, ImagePart, CourseCodeMap, Toast, ActiveSession, PlanSlot, TrackedSession, GenerationState, DashboardInputState, LearningHubState } from '../types';
import { EducationalLevel, ActivityType, DayOfWeek } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon';
import { DAYS_OF_WEEK } from '../constants';
import EditTimetableModal from './EditTimetableModal';
import { RefreshIcon } from './icons/RefreshIcon';
import { LogIcon } from './icons/LogIcon';
import { ClockIcon } from './icons/ClockIcon';
import { PlayIcon } from './icons/PlayIcon';
import LogStudyModal from './LogStudyModal';
import { timeToMinutes, processAndResizeImage } from '../lib/utils';
import { initializeUsage, checkUsage } from '../lib/usageManager';
import UsageIndicator from './UsageIndicator';

// FIX: Added missing 'usage' property to initialize UserDetails correctly.
const emptyUserDetails: UserDetails = { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, institution: '', country: '', email: '', programmeOfStudy: '', institutionAbbreviation: '', usage: initializeUsage() };

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
  setView: (view: any) => void;
  setIntendedStudyContext: (context: { subject: string; fromSlot: PlanSlot } | null) => void;
  setLearningHubState: React.Dispatch<React.SetStateAction<LearningHubState>>;
  courseCodeMap: CourseCodeMap;
  setCourseCodeMap: (map: CourseCodeMap) => void;
  onSavePlanAttempt: (planName: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    setSmartPlan, 
    smartPlan, 
    userDetails, 
    setUserDetails, 
    savedTimetables, 
    setSavedTimetables, 
    addToast, 
    setActiveSession, 
    trackedData, 
    setTrackedData,
    generationState,
    setGenerationState,
    dashboardInputs,
    setDashboardInputs,
    setView,
    setIntendedStudyContext,
    setLearningHubState,
    courseCodeMap,
    setCourseCodeMap,
    onSavePlanAttempt
}) => {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [tempSmartPlan, setTempSmartPlan] = useState<SmartPlan | null>(null);
  const [courseCodes, setCourseCodes] = useState<string[]>([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const { t } = useLanguage();
  const [currentActivity, setCurrentActivity] = useState<{ slot: PlanSlot, day: DayOfWeek, nextSlot: PlanSlot | null } | null>(null);
  const dayRefs = useRef<Record<DayOfWeek, HTMLDivElement | null>>({} as any);
  
  const [logStudyModalState, setLogStudyModalState] = useState<{ isOpen: boolean; slot: PlanSlot | null; day: DayOfWeek | null; nextSlot: PlanSlot | null }>({ isOpen: false, slot: null, day: null, nextSlot: null });

  // FIX: Destructure isManualPlan from dashboardInputs.
  const { lectures, studyGoals, agendaItems, generalGoals, imageFile, imagePreview, step, isManualPlan, isEditing } = dashboardInputs;

  const checkForAgendaConflicts = useCallback((
    plan: SmartPlan, 
    originalLectures: Lecture[], 
    originalAgendaItems: AgendaItem[]
  ) => {
    originalAgendaItems.forEach(item => {
        if (!item.title.trim()) return;

        const isScheduled = plan.some(dayPlan => 
            dayPlan.day === item.day &&
            dayPlan.slots.some(slot => 
                slot.type === ActivityType.AGENDA &&
                slot.activity === item.title &&
                timeToMinutes(slot.startTime) === timeToMinutes(item.startTime)
            )
        );
        
        if (!isScheduled) {
            const itemStart = timeToMinutes(item.startTime);
            const itemEnd = timeToMinutes(item.endTime);

            const conflictingLecture = originalLectures.find(lec => 
                lec.day === item.day &&
                itemStart < timeToMinutes(lec.endTime) &&
                itemEnd > timeToMinutes(lec.startTime)
            );

            if (conflictingLecture) {
                addToast(t('toasts.agendaConflict', { title: item.title, lecture: conflictingLecture.subject }), 'warning');
            }
        }
    });
  }, [addToast, t]);

  const handleScrollToCurrentActivity = () => {
    if (currentActivity?.day && dayRefs.current[currentActivity.day]) {
      dayRefs.current[currentActivity.day]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  useEffect(() => {
    const updateCurrentActivity = () => {
        if (!smartPlan) {
            setCurrentActivity(null);
            return;
        }
        
        const now = new Date();
        const currentDay = getDayOfWeek(now);
        const dayPlan = smartPlan.find(d => d.day === currentDay);
        
        if (!dayPlan || dayPlan.slots.length === 0) {
            setCurrentActivity(null);
            return;
        }
        
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        
        const sortedSlots = [...dayPlan.slots].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        let relevantSlot: PlanSlot | null = null;
        let nextSlotForRelevant: PlanSlot | null = null;

        const currentSlotIndex = sortedSlots.findIndex(slot => {
            const startMinutes = timeToMinutes(slot.startTime);
            const endMinutes = timeToMinutes(slot.endTime);
            if (endMinutes < startMinutes) { // Crosses midnight
                return nowMinutes >= startMinutes || nowMinutes < endMinutes;
            }
            return startMinutes <= nowMinutes && nowMinutes < endMinutes;
        });

        if (currentSlotIndex !== -1) {
            relevantSlot = sortedSlots[currentSlotIndex];
            if (currentSlotIndex + 1 < sortedSlots.length) {
                nextSlotForRelevant = sortedSlots[currentSlotIndex + 1];
            }
        } else {
            const nextSlotIndex = sortedSlots.findIndex(slot => timeToMinutes(slot.startTime) > nowMinutes);
            if (nextSlotIndex !== -1) {
                relevantSlot = sortedSlots[nextSlotIndex];
                if (nextSlotIndex + 1 < sortedSlots.length) {
                    nextSlotForRelevant = sortedSlots[currentSlotIndex + 1];
                }
            }
        }

        if (relevantSlot) {
            setCurrentActivity({ slot: relevantSlot, day: currentDay, nextSlot: nextSlotForRelevant });
        } else {
            setCurrentActivity(null); 
        }
    };

    updateCurrentActivity();
    const interval = setInterval(updateCurrentActivity, 60000);
    return () => clearInterval(interval);
  }, [smartPlan]);

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
  
  const isInputSufficient = !!imageFile ||
    lectures.some(l => l.subject.trim() !== '') ||
    studyGoals.some(g => g.subject.trim() !== '') ||
    agendaItems.some(a => a.title.trim() !== '');

  const extractCourseCodes = (plan: SmartPlan): string[] => {
    const codeRegex = /\b([A-Z]{2,5}\s?\d{2,4})\b/g;
    const codes = new Set<string>();
    plan.forEach(day => {
        day.slots.forEach(slot => {
            // Check the dedicated code field first
            if (slot.code) {
                codes.add(slot.code);
            }
            // Fallback to checking the activity name
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

    const applyCourseCodeMap = (plan: SmartPlan, map: CourseCodeMap): SmartPlan => {
        if (Object.keys(map).length === 0) return plan;

        return plan.map(day => ({
            ...day,
            slots: day.slots.map(slot => {
                const codeRegex = /\b([A-Z]{2,5}\s?\d{2,4})\b/g;
                const codeToMatch = slot.code || slot.activity.match(codeRegex)?.[0];

                if (codeToMatch && codeToMatch in map) {
                    const newName = map[codeToMatch];
                    if (newName && newName.trim() !== '') {
                        return { ...slot, activity: newName.trim(), code: codeToMatch };
                    }
                }
                // Ensure code field is populated if found in activity
                if (codeToMatch && !slot.code) {
                    return { ...slot, code: codeToMatch };
                }
                return slot;
            })
        }));
    };

    const processPlanForCodes = (plan: SmartPlan, isInitialGeneration: boolean) => {
        const extractedCodes = extractCourseCodes(plan);
        // Only ask if it's the first generation and there are codes we don't already know.
        const newCodes = extractedCodes.filter(c => !courseCodeMap[c]);

        if (isInitialGeneration && newCodes.length > 0) {
            setTempSmartPlan(plan);
            setCourseCodes(extractedCodes); // Pass all codes to the modal
            setIsCodeModalOpen(true);
        } else {
            // If it's a regeneration, or all codes are known, just apply the map.
            const finalPlan = applyCourseCodeMap(plan, courseCodeMap);
            setSmartPlan(finalPlan);
        }
    };
  
  const handleNextStep = () => {
    if (!userDetails || !userDetails.name || !userDetails.educationalLevel) {
        addToast(t('dashboard.error.fillDetails'), 'error');
        return;
    }
    const isUniversityLevel = ![EducationalLevel.HIGH_SCHOOL, EducationalLevel.OTHER].includes(userDetails.educationalLevel);
    if (isUniversityLevel && !userDetails.country) {
        addToast(t('common.countryRequired'), 'error');
        return;
    }
    setDashboardInputs(prev => ({...prev, step: 2}));
  };

  const handleGeneratePlan = async () => {
    if (!isInputSufficient || !userDetails) {
        addToast(t('dashboard.error.noInput'), 'error');
        return;
    }

    const isRegeneration = !!smartPlan;
    setGenerationState({ isLoading: true, message: '', error: null, source: 'dashboard' });

    if (imageFile) {
        setGenerationState(prev => ({ ...prev, message: t('dashboard.verifyingImage') }));
        try {
            const { base64, mimeType } = await processAndResizeImage(imageFile);
            const imagePart: ImagePart = {
                inlineData: { data: base64, mimeType }
            };
            
            if (!isRegeneration) {
                const isTimetable = await isImageTimetable(imagePart);
                if (!isTimetable) {
                    addToast(t('dashboard.error.notATimetable'), 'error');
                    setGenerationState({ isLoading: false, message: '', error: null, source: null });
                    return;
                }
            }

            setGenerationState(prev => ({ ...prev, message: t('dashboard.generating') }));
            const generatedPlan = await generatePlanFromImage(userDetails, studyGoals, agendaItems, generalGoals, imagePart, isRegeneration ? smartPlan : undefined);
            
            if (!Array.isArray(generatedPlan)) {
                console.error("Received non-array response for plan from image:", generatedPlan);
                addToast(t('toasts.error.unexpected'), 'error');
                setGenerationState({ isLoading: false, message: '', error: t('toasts.error.unexpected'), source: null });
                return;
            }
            
            checkForAgendaConflicts(generatedPlan, lectures, agendaItems);
            processPlanForCodes(generatedPlan, !isRegeneration);
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        } catch (e: any) {
            addToast(e.message || 'Failed to generate plan from image.', 'error');
            setGenerationState({ isLoading: false, message: '', error: e.message, source: null });
        }
    } else { // Manual input
        try {
            setGenerationState(prev => ({ ...prev, message: t('dashboard.generating') }));
            const generatedPlan = await generateSmartPlan(userDetails, lectures, studyGoals, agendaItems, generalGoals, isRegeneration ? smartPlan : undefined);
            
            if (!Array.isArray(generatedPlan)) {
                console.error("Received non-array response for smart plan:", generatedPlan);
                addToast(t('toasts.error.unexpected'), 'error');
                setGenerationState({ isLoading: false, message: '', error: t('toasts.error.unexpected'), source: null });
                return;
            }

            checkForAgendaConflicts(generatedPlan, lectures, agendaItems);
            processPlanForCodes(generatedPlan, !isRegeneration);
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        } catch (e: any) {
            addToast(e.message || 'Failed to generate plan.', 'error');
            setGenerationState({ isLoading: false, message: '', error: e.message, source: null });
        }
    }
  };
  
  const handleStartOver = () => {
    setSmartPlan(null);
    setDashboardInputs({ lectures: [], studyGoals: [], agendaItems: [], generalGoals: '', imageFile: null, imagePreview: null, step: 1, isManualPlan: false, isEditing: false });
  };
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setDashboardInputs(prev => ({ ...prev, imageFile: file, imagePreview: e.target?.result as string, isManualPlan: false }));
      };
      reader.readAsDataURL(file);
    }
  }, [setDashboardInputs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': ['.jpeg', '.png', '.jpg'] }, multiple: false });

  const startManualPlan = () => {
      setDashboardInputs(prev => ({ ...prev, isManualPlan: true, imageFile: null, imagePreview: null}));
  };

  const handleSavePlan = () => {
    if (!planName.trim()) {
        addToast(t('toasts.planNameRequired'), 'error');
        return;
    }
    onSavePlanAttempt(planName);
    setSaveModalOpen(false);
    setPlanName('');
  };

    const handleCodeConfirm = (map: CourseCodeMap) => {
        const finalMap = { ...courseCodeMap, ...map };
        setCourseCodeMap(finalMap);
        if (tempSmartPlan) {
            const finalPlan = applyCourseCodeMap(tempSmartPlan, finalMap);
            setSmartPlan(finalPlan);
        }
        setTempSmartPlan(null);
        setIsCodeModalOpen(false);
    };

    const handleStudySlotClick = (slot: PlanSlot, day: DayOfWeek) => {
        const dayPlan = smartPlan?.find(d => d.day === day);
        if (!dayPlan) return;
        
        const sortedSlots = [...dayPlan.slots].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const slotIndex = sortedSlots.findIndex(s => s.startTime === slot.startTime && s.activity === slot.activity);
        
        const nextSlot = slotIndex !== -1 && slotIndex + 1 < sortedSlots.length ? sortedSlots[slotIndex + 1] : null;

        setLogStudyModalState({ isOpen: true, slot, day, nextSlot });
    };

    const handleStartSession = (slot: PlanSlot) => {
        const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const newSession: ActiveSession = {
            startTime: Date.now(),
            endTime: Date.now() + duration * 60 * 1000,
            subject: slot.activity,
            type: ActivityType.STUDY,
            fromSlot: slot,
            nextSlot: logStudyModalState.nextSlot,
            day: logStudyModalState.day,
        };
        setActiveSession(newSession);
        setView('uploadslides');
        setLogStudyModalState({isOpen: false, slot: null, day: null, nextSlot: null });
    };

    const handleUploadSlides = (slot: PlanSlot) => {
        setIntendedStudyContext({ subject: slot.activity, fromSlot: slot });
        setView('uploadslides');
        setLogStudyModalState({isOpen: false, slot: null, day: null, nextSlot: null });
    };


  if (!userDetails) {
      return null;
  }

  if (smartPlan) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('dashboard.yourSmartPlan')}</h2>
            <div className="flex items-center gap-2">
                <button onClick={handleStartOver} className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.startOver')}</button>
                <button onClick={() => setDashboardInputs(prev => ({...prev, isEditing: true}))} className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.editTimetable')}</button>
                <button onClick={handleGeneratePlan} disabled={generationState.isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-light/20 text-primary dark:bg-primary-dark/30 dark:text-primary-light rounded-md hover:bg-primary-light/30">
                    <RefreshIcon className={`w-4 h-4 ${generationState.isLoading ? 'animate-spin' : ''}`} />
                    {t('dashboard.regeneratePlan')}
                </button>
                <button onClick={() => setSaveModalOpen(true)} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">{t('common.save')}</button>
            </div>
        </div>
        
         {currentActivity && (
             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="flex-1">
                     <h3 className="font-bold text-lg">{t('dashboard.happeningNow')}: <span className="text-primary dark:text-primary-light">{currentActivity.slot.activity}</span></h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400">{currentActivity.slot.startTime} - {currentActivity.slot.endTime}</p>
                 </div>
                 <div className="flex-1 text-center sm:text-left">
                     <h3 className="font-bold text-lg">{t('dashboard.upNext')}:</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400">
                         {currentActivity.nextSlot ? `${currentActivity.nextSlot.activity} at ${currentActivity.nextSlot.startTime}` : t('dashboard.enjoyFreeTime')}
                     </p>
                 </div>
                 {currentActivity.slot.type === ActivityType.STUDY && (
                    <button onClick={() => handleStudySlotClick(currentActivity.slot, currentActivity.day)} className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark">
                        <PlayIcon className="w-5 h-5" />
                        {t('dashboard.startSession')}
                    </button>
                 )}
                 <button onClick={handleScrollToCurrentActivity} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                     <ClockIcon className="w-5 h-5"/>
                 </button>
             </div>
         )}
        
        <div className="relative">
            <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'dashboard'} message={generationState.message} />
            <SmartPlanView plan={smartPlan} onStudySlotClick={handleStudySlotClick} dayRefs={dayRefs} addToast={addToast} userDetails={userDetails} />
        </div>

        {isEditing && (
            <EditTimetableModal 
                isOpen={isEditing}
                onClose={() => setDashboardInputs(prev => ({...prev, isEditing: false}))}
                plan={smartPlan}
                setPlan={setSmartPlan}
                addToast={addToast}
            />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {step === 1 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-center mb-2">{t('dashboard.createPlanTitle')}</h2>
            <p className="text-gray-500 text-center mb-8">{t('dashboard.createPlanSubtitle')}</p>
            <UserDetailsForm userDetails={userDetails} setUserDetails={setUserDetails} />
            <button onClick={handleNextStep} className="mt-8 w-full py-3 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark transition-colors">{t('common.proceed')}</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 relative">
          <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'dashboard'} message={generationState.message} />
          <button onClick={() => setDashboardInputs(p => ({...p, step: 1}))} className="absolute top-6 left-6 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">
              <LogIcon className="w-4 h-4 rotate-180" /> {t('common.previous')}
          </button>
          <div className="text-center pt-8">
            <h2 className="text-3xl font-bold">{t('dashboard.step2.title')}</h2>
            <p className="text-gray-500 mb-8">{t('dashboard.step2.subtitle')}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Image Upload */}
            <div className="space-y-4">
                 <div {...getRootProps()} className={`p-8 border-4 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} ${dashboardInputs.isManualPlan ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                    <input {...getInputProps()} disabled={dashboardInputs.isManualPlan} />
                    <UploadIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="font-semibold">{t('dashboard.uploadTimetable')}</p>
                    <p className="text-sm text-gray-500">{t('dashboard.uploadTimetable.hint')}</p>
                </div>
                {imagePreview && (
                    <div className="text-center">
                        <img src={imagePreview} alt={t('dashboard.alt.timetablePreview')} className="max-h-40 mx-auto rounded-md shadow-lg" />
                    </div>
                )}
                 {dashboardInputs.isManualPlan && <p className="text-xs text-center text-yellow-600 dark:text-yellow-400">{t('dashboard.uploadDisabled')}</p>}
            </div>

             <div className="flex items-center gap-4">
                <hr className="flex-1 border-gray-300 dark:border-gray-600" />
                <span className="font-bold text-gray-500">{t('common.or')}</span>
                <hr className="flex-1 border-gray-300 dark:border-gray-600" />
            </div>

            {/* Manual Entry */}
             <div className="space-y-4 text-center">
                <p>{t('dashboard.manualEntry')}</p>
                <button onClick={startManualPlan} className="px-6 py-3 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark transition-colors">{t('common.proceed')}</button>
            </div>
          </div>
            
          {isManualPlan && (
            <div className="mt-8 pt-8 border-t dark:border-gray-700">
                <TimetableInput 
                  lectures={lectures} setLectures={setLectures} 
                  studyGoals={studyGoals} setStudyGoals={setStudyGoals}
                  agendaItems={agendaItems} setAgendaItems={setAgendaItems}
                  generalGoals={generalGoals} setGeneralGoals={setGeneralGoals}
                />
            </div>
          )}

          <div className="mt-8 text-center">
            <button onClick={handleGeneratePlan} disabled={!isInputSufficient || generationState.isLoading} className="px-8 py-4 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-50 transition-all">
                {t('dashboard.generatePlan')}
            </button>
          </div>
        </div>
      )}
      
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSaveModalOpen(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold p-4 border-b dark:border-gray-700">{t('dashboard.saveModal.title')}</h3>
                <div className="p-4">
                    <input type="text" value={planName} onChange={e => setPlanName(e.target.value)} placeholder={t('dashboard.planNamePlaceholder')} className="w-full p-2 border rounded-md dark:bg-gray-700" />
                </div>
                <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
                    <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
                    <button onClick={handleSavePlan} className="px-4 py-2 bg-primary text-primary-text rounded-md">{t('common.save')}</button>
                </div>
            </div>
        </div>
      )}
      {isCodeModalOpen && (
          <CourseCodeModal 
            isOpen={isCodeModalOpen}
            onClose={() => { 
                if (tempSmartPlan) setSmartPlan(tempSmartPlan);
                setIsCodeModalOpen(false); 
                setTempSmartPlan(null); 
            }}
            onConfirm={handleCodeConfirm}
            codes={courseCodes}
            existingMap={courseCodeMap}
          />
      )}
      <LogStudyModal 
        isOpen={logStudyModalState.isOpen}
        onClose={() => setLogStudyModalState({ isOpen: false, slot: null, day: null, nextSlot: null })}
        onStartSession={handleStartSession}
        onUploadSlides={handleUploadSlides}
        slot={logStudyModalState.slot}
        day={logStudyModalState.day}
        nextSlot={logStudyModalState.nextSlot}
      />
    </div>
  );
};

export default Dashboard;