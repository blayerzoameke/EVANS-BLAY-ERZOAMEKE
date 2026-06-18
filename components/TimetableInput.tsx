import React from 'react';
import { DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import type { Lecture, StudyGoal, AgendaItem } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import TimeInput from './TimeInput';
import { useLanguage } from '../contexts/LanguageContext';

interface TimetableInputProps {
  lectures: Lecture[];
  setLectures: React.Dispatch<React.SetStateAction<Lecture[]>>;
  studyGoals: StudyGoal[];
  setStudyGoals: React.Dispatch<React.SetStateAction<StudyGoal[]>>;
  agendaItems: AgendaItem[];
  setAgendaItems: React.Dispatch<React.SetStateAction<AgendaItem[]>>;
  generalGoals: string;
  setGeneralGoals: (goals: string) => void;
  disabled?: boolean;
  manualSectionsDisabled?: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-5">
            <span className="h-6 w-1 bg-gradient-to-b from-primary-light to-primary rounded-full mr-3"></span>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        {children}
    </div>
);

const TimetableInput: React.FC<TimetableInputProps> = ({
  lectures, setLectures, studyGoals, setStudyGoals,
  agendaItems, setAgendaItems,
  generalGoals, setGeneralGoals, disabled, manualSectionsDisabled
}) => {
  const { t } = useLanguage();
  
  const updateLecture = (id: string, field: keyof Lecture, value: any) => {
    setLectures(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeLecture = (id: string) => {
    setLectures(prev => prev.filter(item => item.id !== id));
  };
  const updateStudyGoal = (id: string, field: keyof StudyGoal, value: any) => {
    setStudyGoals(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeStudyGoal = (id: string) => {
    setStudyGoals(prev => prev.filter(item => item.id !== id));
  };
  const updateAgendaItem = (id: string, field: keyof AgendaItem, value: any) => {
    setAgendaItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeAgendaItem = (id: string) => {
    setAgendaItems(prev => prev.filter(item => item.id !== id));
  };

  const addLecture = () => setLectures(p => [...p, { id: Date.now().toString() + Math.random().toString(), subject: '', day: DayOfWeek.Monday, startTime: '09:00 AM', endTime: '10:00 AM', location: '' }]);
  const addStudyGoal = () => setStudyGoals(p => [...p, { id: Date.now().toString() + Math.random().toString(), subject: '', hours: 3 }]);
  const addAgendaItem = () => setAgendaItems(p => [...p, { id: Date.now().toString() + Math.random().toString(), title: '', day: DayOfWeek.Monday, startTime: '12:00 PM', endTime: '01:00 PM', location: '' }]);

  const inputClasses = "block w-full h-10 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-inner text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700";
  const selectClasses = `${inputClasses} pr-8`;
  const primaryButtonClasses = "flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-primary-text bg-primary rounded-lg shadow-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark disabled:opacity-50 transition-all transform hover:-translate-y-0.5";
  
  return (
    <div className="space-y-8">
      {/* Lectures */}
      <Section title={t('timetableinput.lectures')}>
        <div className="space-y-4">
          {lectures.map(lec => (
            <div key={lec.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-end gap-4">
              <div className="w-full">
                  <label htmlFor={`lec-subject-${lec.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.subject')}</label>
                  <input id={`lec-subject-${lec.id}`} type="text" placeholder={t('timetableinput.subject')} value={lec.subject} onChange={e => updateLecture(lec.id, 'subject', e.target.value)} className={inputClasses} disabled={disabled || manualSectionsDisabled} />
              </div>
               <div>
                  <label htmlFor={`lec-location-${lec.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.location')}</label>
                  <input id={`lec-location-${lec.id}`} type="text" placeholder="e.g. Room 204" value={lec.location} onChange={e => updateLecture(lec.id, 'location', e.target.value)} className={inputClasses} disabled={disabled || manualSectionsDisabled} />
              </div>
              <div>
                  <label htmlFor={`lec-day-${lec.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('common.day')}</label>
                  <select id={`lec-day-${lec.id}`} value={lec.day} onChange={e => updateLecture(lec.id, 'day', e.target.value as DayOfWeek)} className={selectClasses} disabled={disabled || manualSectionsDisabled}>
                    {DAYS_OF_WEEK.map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
              </div>
              <div>
                <label htmlFor={`lec-start-${lec.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.itemStartTime')}</label>
                <TimeInput id={`lec-start-${lec.id}`} value={lec.startTime} onChange={val => updateLecture(lec.id, 'startTime', val)} disabled={disabled || manualSectionsDisabled} />
              </div>
              <div>
                <label htmlFor={`lec-end-${lec.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.itemEndTime')}</label>
                <TimeInput id={`lec-end-${lec.id}`} value={lec.endTime} onChange={val => updateLecture(lec.id, 'endTime', val)} disabled={disabled || manualSectionsDisabled} />
              </div>
              <button onClick={() => removeLecture(lec.id)} className="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md disabled:bg-red-300 transition-all transform hover:-translate-y-0.5" disabled={disabled || manualSectionsDisabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <button onClick={addLecture} className={`${primaryButtonClasses} mt-4`} disabled={disabled || manualSectionsDisabled}><PlusIcon className="w-4 h-4" /> {t('timetableinput.addLecture')}</button>
      </Section>

      {/* Study Goals */}
      <Section title={t('timetableinput.studyGoals')}>
        <div className="space-y-4">
          {studyGoals.map(goal => (
            <div key={goal.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-4 items-end">
              <div>
                  <label htmlFor={`goal-subject-${goal.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.subjectToStudy')}</label>
                  <input id={`goal-subject-${goal.id}`} type="text" placeholder={t('timetableinput.subjectToStudy')} value={goal.subject} onChange={e => updateStudyGoal(goal.id, 'subject', e.target.value)} className={inputClasses} disabled={disabled || manualSectionsDisabled} />
              </div>
              <div>
                <label htmlFor={`goal-hours-${goal.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.hoursPerWeek')}</label>
                <div className="flex items-center gap-2">
                    <input id={`goal-hours-${goal.id}`} type="number" placeholder="Hours" value={isNaN(goal.hours) ? '' : goal.hours} min="1" onChange={e => updateStudyGoal(goal.id, 'hours', parseInt(e.target.value, 10) || 0)} className={inputClasses} disabled={disabled || manualSectionsDisabled} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.hours')}</span>
                </div>
              </div>
              <button onClick={() => removeStudyGoal(goal.id)} className="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md disabled:bg-red-300 transition-all transform hover:-translate-y-0.5" disabled={disabled || manualSectionsDisabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
         <button onClick={addStudyGoal} className={`${primaryButtonClasses} mt-4`} disabled={disabled || manualSectionsDisabled}><PlusIcon className="w-4 h-4" /> {t('timetableinput.addStudyGoal')}</button>
      </Section>

      {/* Agenda Items */}
      <Section title={t('timetableinput.agenda')}>
        <div className="space-y-4">
          {agendaItems.map(item => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-end gap-4">
              <div className="w-full">
                <label htmlFor={`agenda-title-${item.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.activityTitle')}</label>
                <input id={`agenda-title-${item.id}`} type="text" placeholder={t('timetableinput.activityTitle')} value={item.title} onChange={e => updateAgendaItem(item.id, 'title', e.target.value)} className={inputClasses} disabled={disabled} />
              </div>
              <div>
                  <label htmlFor={`agenda-location-${item.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.location')}</label>
                  <input id={`agenda-location-${item.id}`} type="text" placeholder="e.g. Gym" value={item.location} onChange={e => updateAgendaItem(item.id, 'location', e.target.value)} className={inputClasses} disabled={disabled} />
              </div>
              <div>
                <label htmlFor={`agenda-day-${item.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('common.day')}</label>
                <select id={`agenda-day-${item.id}`} value={item.day} onChange={e => updateAgendaItem(item.id, 'day', e.target.value as DayOfWeek)} className={selectClasses} disabled={disabled}>
                  {DAYS_OF_WEEK.map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`agenda-start-${item.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.itemStartTime')}</label>
                <TimeInput id={`agenda-start-${item.id}`} value={item.startTime} onChange={val => updateAgendaItem(item.id, 'startTime', val)} disabled={disabled} />
              </div>
              <div>
                <label htmlFor={`agenda-end-${item.id}`} className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('timetableinput.itemEndTime')}</label>
                <TimeInput id={`agenda-end-${item.id}`} value={item.endTime} onChange={val => updateAgendaItem(item.id, 'endTime', val)} disabled={disabled} />
              </div>
              <button onClick={() => removeAgendaItem(item.id)} className="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md disabled:bg-red-300 transition-all transform hover:-translate-y-0.5" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <button onClick={addAgendaItem} className={`${primaryButtonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> {t('timetableinput.addAgendaItem')}</button>
      </Section>

      {/* General Goals */}
      <Section title={t('timetableinput.generalGoals')}>
        <textarea
          value={generalGoals}
          onChange={(e) => setGeneralGoals(e.target.value)}
          rows={3}
          className={`${inputClasses} resize-y h-auto`}
          placeholder={t('timetableinput.generalGoalsPlaceholder')}
          disabled={disabled}
        />
      </Section>
    </div>
  );
};

export default TimetableInput;