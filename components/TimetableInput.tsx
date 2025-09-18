import React from 'react';
import { DayOfWeek } from '../types.ts';
import type { Lecture, StudyGoal, AgendaItem } from '../types.ts';
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
}

const TimetableInput: React.FC<TimetableInputProps> = ({
  lectures, setLectures, studyGoals, setStudyGoals,
  agendaItems, setAgendaItems,
  generalGoals, setGeneralGoals, disabled
}) => {
  const { t } = useLanguage();
  
  const createUpdater = <T extends {id: string}>(setter: React.Dispatch<React.SetStateAction<T[]>>) => 
    (id: string, field: keyof T, value: any) => {
      setter(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const createRemover = <T extends {id: string}>(setter: React.Dispatch<React.SetStateAction<T[]>>) => 
    (id: string) => {
      setter(prev => prev.filter(item => item.id !== id));
  };

  const updateLecture = createUpdater(setLectures);
  const removeLecture = createRemover(setLectures);
  const updateStudyGoal = createUpdater(setStudyGoals);
  const removeStudyGoal = createRemover(setStudyGoals);
  const updateAgendaItem = createUpdater(setAgendaItems);
  const removeAgendaItem = createRemover(setAgendaItems);

  const addLecture = () => setLectures(p => [...p, { id: Date.now().toString(), subject: '', day: DayOfWeek.Monday, startTime: '09:00 AM', endTime: '10:00 AM' }]);
  const addStudyGoal = () => setStudyGoals(p => [...p, { id: Date.now().toString(), subject: '', hours: 3 }]);
  const addAgendaItem = () => setAgendaItems(p => [...p, { id: Date.now().toString(), title: '', day: DayOfWeek.Monday, startTime: '12:00 PM', endTime: '01:00 PM' }]);

  const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-100 dark:disabled:bg-slate-700";
  const selectClasses = `${inputClasses} pr-8`;
  const buttonClasses = "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 border border-transparent rounded-md shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-800";
  
  return (
    <div className="space-y-8">
      {/* Lectures */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">{t('timetableinput.lectures')}</h3>
        <div className="space-y-4">
          {lectures.map(lec => (
            <div key={lec.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-end gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
              <div className="sm:col-span-2 md:col-span-1">
                  <label htmlFor={`lec-subject-${lec.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('timetableinput.subject')}</label>
                  <input id={`lec-subject-${lec.id}`} type="text" placeholder={t('timetableinput.subject')} value={lec.subject} onChange={e => updateLecture(lec.id, 'subject', e.target.value)} className={inputClasses} disabled={disabled} />
              </div>
              <div>
                  <label htmlFor={`lec-day-${lec.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('common.day')}</label>
                  <select id={`lec-day-${lec.id}`} value={lec.day} onChange={e => updateLecture(lec.id, 'day', e.target.value)} className={selectClasses} disabled={disabled}>
                    {Object.values(DayOfWeek).map(day => <option key={day} value={day}>{day}</option>)}
                  </select>
              </div>
              <div>
                <label htmlFor={`lec-start-${lec.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('timetableinput.itemStartTime')}</label>
                <TimeInput id={`lec-start-${lec.id}`} value={lec.startTime} onChange={val => updateLecture(lec.id, 'startTime', val)} />
              </div>
              <div>
                <label htmlFor={`lec-end-${lec.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('timetableinput.itemEndTime')}</label>
                <TimeInput id={`lec-end-${lec.id}`} value={lec.endTime} onChange={val => updateLecture(lec.id, 'endTime', val)} />
              </div>
              <button onClick={() => removeLecture(lec.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-slate-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <button onClick={addLecture} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> {t('timetableinput.addLecture')}</button>
      </section>

      {/* Study Goals */}
      <section>
         <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">{t('timetableinput.studyGoals')}</h3>
        <div className="space-y-4">
          {studyGoals.map(goal => (
            <div key={goal.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
              <input type="text" placeholder={t('timetableinput.subjectToStudy')} value={goal.subject} onChange={e => updateStudyGoal(goal.id, 'subject', e.target.value)} className={inputClasses} disabled={disabled} />
              <div className="flex items-center gap-2">
                 <input type="number" placeholder="Hours/week" value={goal.hours} min="1" onChange={e => updateStudyGoal(goal.id, 'hours', parseInt(e.target.value, 10))} className={inputClasses} disabled={disabled} />
                 <span className="text-sm text-slate-600 dark:text-slate-400">{t('timetableinput.hoursPerWeek')}</span>
              </div>
              <button onClick={() => removeStudyGoal(goal.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-slate-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
         <button onClick={addStudyGoal} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> {t('timetableinput.addStudyGoal')}</button>
      </section>

      {/* Agenda Items */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">{t('timetableinput.agenda')}</h3>
        <div className="space-y-4">
          {agendaItems.map(item => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-end gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
              <div className="sm:col-span-2 md:col-span-1">
                <label htmlFor={`agenda-title-${item.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('timetableinput.activityTitle')}</label>
                <input id={`agenda-title-${item.id}`} type="text" placeholder={t('timetableinput.activityTitle')} value={item.title} onChange={e => updateAgendaItem(item.id, 'title', e.target.value)} className={inputClasses} disabled={disabled} />
              </div>
              <div>
                <label htmlFor={`agenda-day-${item.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('common.day')}</label>
                <select id={`agenda-day-${item.id}`} value={item.day} onChange={e => updateAgendaItem(item.id, 'day', e.target.value)} className={selectClasses} disabled={disabled}>
                  {Object.values(DayOfWeek).map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`agenda-start-${item.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('timetableinput.itemStartTime')}</label>
                <TimeInput id={`agenda-start-${item.id}`} value={item.startTime} onChange={val => updateAgendaItem(item.id, 'startTime', val)} />
              </div>
              <div>
                <label htmlFor={`agenda-end-${item.id}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('timetableinput.itemEndTime')}</label>
                <TimeInput id={`agenda-end-${item.id}`} value={item.endTime} onChange={val => updateAgendaItem(item.id, 'endTime', val)} />
              </div>
              <button onClick={() => removeAgendaItem(item.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-slate-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <button onClick={addAgendaItem} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> {t('timetableinput.addAgendaItem')}</button>
      </section>

      {/* General Goals */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-200">{t('timetableinput.generalGoals')}</h3>
        <textarea
          value={generalGoals}
          onChange={(e) => setGeneralGoals(e.target.value)}
          rows={3}
          className={`${inputClasses} resize-y`}
          placeholder={t('timetableinput.generalGoalsPlaceholder')}
          disabled={disabled}
        />
      </section>
    </div>
  );
};

export default TimetableInput;