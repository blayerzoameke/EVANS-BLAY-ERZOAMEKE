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

const emptyUserDetails: UserDetails = { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, institution: '', country: '', email: '', programmeOfStudy: '', institutionAbbreviation: '' };

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

  const { lectures, studyGoals, agendaItems, generalGoals, imageFile, imagePreview, step, isEditing } = dashboardInputs;

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

  const processPlanForCodes = (plan: SmartPlan, isInitialGeneration: boolean) => {
      const extractedCodes = extractCourseCodes(plan);
      if (isInitialGeneration && extractedCodes.length > 0) {
          setTempSmartPlan(plan);
          setCourseCodes(extractedCodes);
          setIsCodeModalOpen(true);
      } else {
          setSmartPlan(plan);
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
            
            const extractedLectures: Lecture[] = [];
            generatedPlan.forEach(dayPlan => {
                dayPlan.slots.forEach(slot => {
                    if (slot.type === ActivityType.LECTURE) {
                        extractedLectures.push({
                            id: `${dayPlan.day}-${slot.startTime}`,
                            subject: slot.activity,
                            day: dayPlan.day,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            location: slot.location
                        });
                    }
                });
            });

            checkForAgendaConflicts(generatedPlan, extractedLectures, agendaItems);
            processPlanForCodes(generatedPlan, !isRegeneration);
            setGenerationState({ isLoading: false, message: '', error: null, source: null });

        } catch (e) {
             const message = e instanceof Error ? e.message : String(e);
             addToast(message || t('toasts.error.unexpected'), 'error');
             setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    } else {
        setGenerationState(prev => ({ ...prev, message: t('dashboard.generating') }));
        try {
            const plan = await generateSmartPlan(userDetails, lectures, studyGoals, agendaItems, generalGoals, isRegeneration ? smartPlan : undefined);
            checkForAgendaConflicts(plan, lectures, agendaItems);
            processPlanForCodes(plan, !isRegeneration);
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        } catch (e: any) {
            const message = e instanceof Error ? e.message : String(e);
            addToast(message || t('toasts.error.unexpected'), 'error');
            setGenerationState({ isLoading: false, message: '', error: null, source: null });
        }
    }
  };
  
  const handleCourseCodeConfirmation = (confirmedMap: CourseCodeMap) => {
    if (!tempSmartPlan) return;

    const finalPlan = tempSmartPlan.map(day => ({
        ...day,
        slots: day.slots.map(slot => {
            const codeRegex = /\b([A-Z]{2,5}\s?\d{2,4})\b/g;
            // Prefer the dedicated code field, but fall back to regex on the activity.
            const codeToMatch = slot.code || slot.activity.match(codeRegex)?.[0];

            if (codeToMatch && codeToMatch in confirmedMap) {
                const newName = confirmedMap[codeToMatch];
                // If user provided a new name, update the activity and ensure the code field is set.
                if (newName && newName.trim() !== '') {
                    return { ...slot, activity: newName.trim(), code: codeToMatch };
                }
            }
            
            // If no new name was provided, or no code was found,
            // we still want to ensure the code field is populated if we found a code in the activity string.
            if (codeToMatch && !slot.code) {
                return { ...slot, code: codeToMatch };
            }

            // Otherwise, return the original slot from the temp plan.
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
        if (file.size > 25 * 1024 * 1024) { // 25MB limit
            addToast(t('toasts.fileSizeTooLarge', { fileName: file.name, size: 25 }), 'error');
            return;
        }
        setDashboardInputs(prev => ({
            ...prev,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            lectures: [],
            studyGoals: [],
        }));
    }
  }, [setDashboardInputs, addToast, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    multiple: false,
    disabled: generationState.isLoading || lectures.length > 0 || studyGoals.length > 0,
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

  const handleStartStudySession = (slot: PlanSlot, day: DayOfWeek) => {
    setLogStudyModalState({ isOpen: false, slot: null, day: null, nextSlot: null });

    let nextSlot: PlanSlot | null = null;
    if (smartPlan) {
        const dayPlan = smartPlan.find(d => d.day === day);
        if (dayPlan) {
            const sortedSlots = [...dayPlan.slots].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            const currentIndex = sortedSlots.findIndex(s => s.startTime === slot.startTime && s.activity === slot.activity);
            if (currentIndex !== -1 && currentIndex + 1 < sortedSlots.length) {
                nextSlot = sortedSlots[currentIndex + 1];
            }
        }
    }

    setLearningHubState({ file: null, analysisMode: 'none', analysisResults: { summarize: null, explain: null, read: null }, chatHistory: [], isProcessing: false });
    const now = Date.now();
    const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    const newSession: ActiveSession = {
        startTime: now,
        endTime: now + duration * 60 * 1000,
        subject: slot.activity,
        type: ActivityType.STUDY,
        fromSlot: slot,
        nextSlot: nextSlot,
        durationMinutes: duration,
        day: day,
    };
    setActiveSession(newSession);
    addToast(t('toasts.sessionStarted'), 'success');
  };

  const handleStudySlotClick = (slot: PlanSlot, day: DayOfWeek) => {
    let nextSlot: PlanSlot | null = null;
    if (smartPlan) {
        const dayPlan = smartPlan.find(d => d.day === day);
        if (dayPlan) {
            const sortedSlots = [...dayPlan.slots].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            const currentIndex = sortedSlots.findIndex(s => s.startTime === slot.startTime && s.activity === slot.activity);
            if (currentIndex !== -1 && currentIndex + 1 < sortedSlots.length) {
                nextSlot = sortedSlots[currentIndex + 1];
            }
        }
    }
    setLogStudyModalState({ isOpen: true, slot, day, nextSlot });
  };
  
  const handleUploadSlidesForSession = (slot: PlanSlot) => {
    setIntendedStudyContext({ subject: slot.activity, fromSlot: slot });
    setView('uploadslides');
    setLogStudyModalState({ isOpen: false, slot: null, day: null, nextSlot: null });
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
        isEditing: false,
    });
  };

  const isNow = (startTime: string, endTime: string): boolean => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    return startMinutes <= nowMinutes && nowMinutes < endMinutes;
  }
  
  const renderPlanCreationSteps = () => {
    if (!userDetails) return null; // Guard clause
    if (step === 1) {
        return (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{t('dashboard.createPlanTitle')}</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{t('dashboard.createPlanSubtitle')}</p>
              <UserDetailsForm userDetails={userDetails} setUserDetails={setUserDetails} />
              <button onClick={handleNextStep} className="mt-6 w-full py-3 bg-primary text-primary-text font-semibold rounded-lg shadow-md hover:bg-primary-dark transition-colors">{t('common.confirm')}</button>
            </div>
        );
    }
    
    if (step === 2) {
        return (
            <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">{t('dashboard.step2.title')}</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">{t('dashboard.step2.subtitle')}</p>
               <div {...getRootProps()} className={`group relative p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${!!imageFile ? 'border-green-500' : (lectures.length > 0 || studyGoals.length > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20')} border-gray-300 dark:border-gray-600 text-center ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : ''}`}>
                 <input {...getInputProps()} />
                 {imagePreview ? (
                     <>
                       <img src={imagePreview} alt={t('dashboard.alt.timetablePreview' as any)} className="max-h-52 mx-auto rounded-lg shadow-md" />
                       <button onClick={(e) => { e.stopPropagation(); clearImage(); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg leading-none">&times;</button>
                     </>
                 ) : (
                    <>
                        <UploadIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="font-semibold text-gray-700 dark:text-gray-300">{lectures.length > 0 || studyGoals.length > 0 ? t('dashboard.uploadDisabled') : t('dashboard.uploadTimetable')}</p>
                        <p className="text-sm text-gray-500">{t('dashboard.uploadTimetable.hint')}</p>
                    </>
                 )}
               </div>
               <div className="flex items-center my-6">
                 <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                 <span className="flex-shrink mx-4 text-gray-500 font-semibold">{t('common.or')}</span>
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
               <button onClick={handleGeneratePlan} className="mt-8 w-full py-4 bg-primary text-primary-text font-bold text-lg rounded-xl shadow-lg hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed transition-all" disabled={!isInputSufficient || generationState.isLoading}>
                 {generationState.isLoading ? t('dashboard.generating') : (smartPlan ? t('dashboard.regeneratePlan') : t('dashboard.generatePlan'))}
               </button>
             </div>
        );
    }
  };
  
  if (!userDetails) {
      return null;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {smartPlan ? (
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('dashboard.yourSmartPlan')}</h2>
            <div className="flex flex-wrap gap-2 w-full justify-start sm:w-auto sm:justify-end">
              <button onClick={handleEditInputs} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.editInputs')}</button>
              <button onClick={() => setDashboardInputs(prev => ({...prev, isEditing: true}))} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.editTimetable')}</button>
              <button onClick={handleStartOver} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">{t('dashboard.startOver')}</button>
              <button onClick={() => setSaveModalOpen(true)} className="px-4 py-2 text-sm font-medium text-primary-text bg-primary rounded-md hover:bg-primary-dark">{t('common.save')}</button>
            </div>
          </div>

          {smartPlan && (
            currentActivity ? (
                <div
                    onClick={handleScrollToCurrentActivity}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleScrollToCurrentActivity(); } }}
                    role="button"
                    tabIndex={0}
                    className="bg-gradient-to-br from-primary to-sky-400 dark:from-primary-dark dark:to-sky-700 rounded-2xl shadow-xl p-6 md:p-8 mb-8 text-white transition-transform duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-primary cursor-pointer"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold text-primary-text/80">{ isNow(currentActivity.slot.startTime, currentActivity.slot.endTime) ? "Happening Now" : "Up Next"} &bull; {currentActivity.day}</p>
                            <h3 className="text-3xl font-bold mt-1">{currentActivity.slot.activity}</h3>
                            <div className="flex items-center gap-2 mt-2 text-primary-text/90">
                                <ClockIcon className="w-5 h-5" />
                                <span>{currentActivity.slot.startTime} - {currentActivity.slot.endTime}</span>
                            </div>
                        </div>
                        {currentActivity.slot.type === 'study' && getDayOfWeek(new Date()) === currentActivity.day && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleStudySlotClick(currentActivity.slot, currentActivity.day); }}
                                className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-all backdrop-blur-sm"
                            >
                                <PlayIcon className="w-5 h-5"/> Start Session
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center mb-8">
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">You're all done for today! 🎉</h3>
                    <p className="text-gray-500 mt-1">Enjoy your free time.</p>
                </div>
            )
          )}

          <SmartPlanView plan={smartPlan} onStudySlotClick={handleStudySlotClick} dayRefs={dayRefs} addToast={addToast} userDetails={userDetails} />
        </div>
      ) : (
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-10">
            <LoadingOverlay isLoading={generationState.isLoading && generationState.source === 'dashboard'} message={generationState.message} />
             {renderPlanCreationSteps()}
        </div>
      )}

      {isEditing && smartPlan && (
        <EditTimetableModal
            isOpen={isEditing}
            onClose={() => setDashboardInputs(prev => ({...prev, isEditing: false}))}
            plan={smartPlan}
            setPlan={setSmartPlan}
            addToast={addToast}
        />
      )}

      {saveModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{t('dashboard.saveModal.title')}</h3>
            <input 
                type="text" 
                value={planName} 
                onChange={e => setPlanName(e.target.value)} 
                placeholder={t('dashboard.planNamePlaceholder')} 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
            />
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

      <LogStudyModal
        isOpen={logStudyModalState.isOpen}
        onClose={() => setLogStudyModalState({ isOpen: false, slot: null, day: null, nextSlot: null })}
        onStartSession={(slot) => handleStartStudySession(slot, logStudyModalState.day!)}
        onUploadSlides={handleUploadSlidesForSession}
        slot={logStudyModalState.slot}
        day={logStudyModalState.day}
        nextSlot={logStudyModalState.nextSlot}
      />

    </div>
  );
};

export default Dashboard;