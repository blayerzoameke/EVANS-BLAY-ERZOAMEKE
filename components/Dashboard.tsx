import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import UserDetailsForm from './UserDetailsForm';
import TimetableInput from './TimetableInput';
import SmartPlanView from './SmartPlanView';
import CourseCodeModal from './CourseCodeModal';
import LogStudyModal from './LogStudyModal';
import { generateSmartPlan, generatePlanFromImage, isImageTimetable } from '../services/geminiService';
// FIX: Moved DayOfWeek from type-only import to regular import to allow its use as a value.
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, StoredPlan, ImagePart, CourseCodeMap, Toast, ActiveSession, PlanSlot, TrackedSession } from '../types.ts';
import { EducationalLevel, ActivityType, DayOfWeek } from '../types.ts';
import { UploadIcon } from './icons/UploadIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon.tsx';

const emptyUserDetails: UserDetails = { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, institution: '', country: '', email: '' };

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

const Dashboard: React.FC<{
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
}> = ({ setSmartPlan, smartPlan, userDetails: initialUserDetails, setUserDetails: setGlobalUserDetails, savedTimetables, setSavedTimetables, addToast, setActiveSession, trackedData, setTrackedData }) => {
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
  const [selectedSlotForLog, setSelectedSlotForLog] = useState<{ slot: PlanSlot; day: DayOfWeek } | null>(null);
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setLectures([]);
      setAgendaItems([]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false,
    disabled: isLoading || isManualInputStarted,
  });
  
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
  
  const handleOpenLogModal = (slot: PlanSlot, day: DayOfWeek) => {
    setSelectedSlotForLog({ slot, day });
  };

  const handleStartSession = (slot: PlanSlot) => {
    const now = Date.now();
    const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    const endTime = now + (duration * 60 * 1000);
    const today = getDayOfWeek(new Date());
    const dayPlan = smartPlan?.find(d => d.day === today);
    const slotIndex = dayPlan?.slots.findIndex(s => s.startTime === slot.startTime && s.activity === slot.activity) ?? -1;
    const nextSlot = (dayPlan && slotIndex !== -1 && slotIndex + 1 < dayPlan.slots.length) ? dayPlan.slots[slotIndex + 1] : null;

    setActiveSession({
        startTime: now,
        endTime: endTime,
        subject: slot.activity,
        type: 'study',
        fromSlot: slot,
        nextSlot: (nextSlot && nextSlot.type === ActivityType.BREAK) ? nextSlot : null,
    });
    addToast(t('toasts.sessionStarted'), 'success');
    setSelectedSlotForLog(null);
  };

  const handleLogTime = (subject: string, durationMinutes: number, date: string) => {
    const newTrackedSession: TrackedSession = {
        subject,
        durationMinutes,
        date,
    };
    setTrackedData([...trackedData, newTrackedSession]);
    addToast(t('toasts.logSaved'), 'success');
  };

  if (smartPlan) {
    return (
        <div id="printable-area">
          <div className="flex justify-between items-center mb-6 no-print">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('dashboard.yourSmartPlan')}</h2>
            <div className="flex gap-2">
                <button
                    onClick={() => setSaveModalOpen(true)}
                    className="px-4 py-2 font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                    {t('common.save')}
                </button>
                <button
                onClick={() => { setSmartPlan(null); setStep(1); }}
                className="px-4 py-2 font-medium text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/50 rounded-md hover:bg-sky-200 dark:hover:bg-sky-800"
                >
                {t('dashboard.createNewPlan')}
                </button>
            </div>
          </div>
          <SmartPlanView plan={smartPlan} onStudySlotClick={handleOpenLogModal} />
           {saveModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
                      <h3 className="text-xl font-bold mb-4">{t('mytimetables.renameModalTitle')}</h3>
                      <input 
                          type="text"
                          value={planName}
                          onChange={e => setPlanName(e.target.value)}
                          placeholder={t('dashboard.planNamePlaceholder')}
                          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div className="flex justify-end gap-4 mt-4">
                          <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
                          <button onClick={handleSavePlan} className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-md">{t('common.save')}</button>
                      </div>
                  </div>
              </div>
          )}
          {selectedSlotForLog && (
            <LogStudyModal
                isOpen={!!selectedSlotForLog}
                onClose={() => setSelectedSlotForLog(null)}
                slot={selectedSlotForLog.slot}
                day={selectedSlotForLog.day}
                onStartSession={handleStartSession}
                onLogTime={handleLogTime}
            />
          )}
        </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-lg p-6 md:p-8 border dark:border-gray-700">
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-2">{t('dashboard.createPlanTitle')}</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">{t('dashboard.createPlanSubtitle')}</p>
        
        {step === 1 && (
            <>
                <div className="mt-8">
                    <UserDetailsForm userDetails={userDetails} setUserDetails={handleUserDetailsChange} disabled={isLoading} />
                </div>
                {error && <p className="mt-4 text-center text-red-500">{error}</p>}
                <div className="mt-8 pt-6 border-t dark:border-gray-700 flex justify-end">
                    <button
                        onClick={handleNextStep}
                        className="w-full sm:w-auto px-6 py-2 font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-500 rounded-md shadow-sm hover:from-sky-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        {t('common.next')}
                    </button>
                </div>
            </>
        )}

        {step === 2 && (
            <div className="space-y-8">
                 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <div className="flex items-center mb-5">
                       <span className="h-6 w-1 bg-gradient-to-b from-sky-500 to-blue-500 rounded-full mr-3"></span>
                       <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('dashboard.yourSchedule')}</h3>
                    </div>
                    <div className="py-6">
                        {!imagePreview ? (
                            <div {...getRootProps()} className={`group p-10 border-2 border-dashed rounded-lg transition-colors ${isDragActive ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-300 dark:border-gray-600'} ${isLoading || isManualInputStarted ? 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-gray-800' : 'cursor-pointer hover:border-teal-400'}`}>
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 transition-colors group-hover:text-teal-600 dark:group-hover:text-teal-400">
                                    <UploadIcon className="w-12 h-12 mb-4" />
                                    <p className="font-semibold">{t('dashboard.uploadTimetable')}</p>
                                    <p className="text-sm">{t('dashboard.manualEntry')}</p>
                                    {isManualInputStarted && <p className="text-xs text-gray-400 mt-2">{t('dashboard.uploadDisabled')}</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <img src={imagePreview} alt="Timetable preview" className="max-h-48 rounded-md shadow-md" />
                                <button onClick={clearImage} className="text-sm text-red-500 hover:underline" disabled={isLoading}>{t('dashboard.removeImage')}</button>
                            </div>
                        )}
                    </div>
                 </div>

                 <TimetableInput
                    lectures={lectures} setLectures={setLectures}
                    studyGoals={studyGoals} setStudyGoals={setStudyGoals}
                    agendaItems={agendaItems} setAgendaItems={setAgendaItems}
                    generalGoals={generalGoals} setGeneralGoals={setGeneralGoals}
                    disabled={isLoading}
                    manualSectionsDisabled={!!imageFile}
                />

                {error && <p className="mt-4 text-center text-red-500">{error}</p>}
                <div className="mt-8 pt-6 border-t dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                        onClick={() => setStep(1)}
                        className="w-full sm:w-auto px-6 py-2 font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        {t('common.previous')}
                    </button>
                    <button
                        onClick={handleGeneratePlan}
                        disabled={isLoading || !isInputSufficient}
                        className="w-full sm:w-auto px-10 py-3 text-lg font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg shadow-md hover:from-sky-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1"
                    >
                        {isLoading ? loadingMessage : t('dashboard.generatePlan')}
                    </button>
                </div>
            </div>
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