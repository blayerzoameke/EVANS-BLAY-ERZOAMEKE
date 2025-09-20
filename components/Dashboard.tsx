

import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import UserDetailsForm from './UserDetailsForm';
import TimetableInput from './TimetableInput';
import SmartPlanView from './SmartPlanView';
import CourseCodeModal from './CourseCodeModal';
import LogStudyModal from './LogStudyModal';
import { generateSmartPlan, generatePlanFromImage, isImageTimetable } from '../services/geminiService';
// FIX: Added .ts extension
import type { UserDetails, Lecture, StudyGoal, AgendaItem, SmartPlan, StoredPlan, ImagePart, CourseCodeMap, Toast, ActiveSession, PlanSlot, TrackedSession } from '../types.ts';
// FIX: Moved DayOfWeek from type-only import to regular import to allow its use as a value.
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
  
// FIX: Corrected the implementation of handleOpenLogModal to include the `day` property, resolving a type error.
  const handleOpenLogModal = (slot: PlanSlot, day: DayOfWeek) => {
    setSelectedSlotForLog({ slot, day });
  };
};

export default Dashboard;