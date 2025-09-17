import React from 'react';
import { DayOfWeek } from '../types';
import type { Lecture, StudyGoal, AgendaItem, BreakPreference } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import TimeInput from './TimeInput';

interface TimetableInputProps {
  lectures: Lecture[];
  setLectures: React.Dispatch<React.SetStateAction<Lecture[]>>;
  studyGoals: StudyGoal[];
  setStudyGoals: React.Dispatch<React.SetStateAction<StudyGoal[]>>;
  agendaItems: AgendaItem[];
  setAgendaItems: React.Dispatch<React.SetStateAction<AgendaItem[]>>;
  breakPreferences: BreakPreference[];
  setBreakPreferences: React.Dispatch<React.SetStateAction<BreakPreference[]>>;
  generalGoals: string;
  setGeneralGoals: (goals: string) => void;
  disabled?: boolean;
}

const TimetableInput: React.FC<TimetableInputProps> = ({
  lectures, setLectures, studyGoals, setStudyGoals,
  agendaItems, setAgendaItems, breakPreferences, setBreakPreferences,
  generalGoals, setGeneralGoals, disabled
}) => {
  
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
  const updateBreakPreference = createUpdater(setBreakPreferences);
  const removeBreakPreference = createRemover(setBreakPreferences);

  const addLecture = () => setLectures(p => [...p, { id: Date.now().toString(), subject: '', day: DayOfWeek.Monday, startTime: '09:00 AM', endTime: '10:00 AM' }]);
  const addStudyGoal = () => setStudyGoals(p => [...p, { id: Date.now().toString(), subject: '', hours: 3 }]);
  const addAgendaItem = () => setAgendaItems(p => [...p, { id: Date.now().toString(), title: '', day: DayOfWeek.Monday, startTime: '12:00 PM', endTime: '01:00 PM' }]);
  const addBreakPreference = () => setBreakPreferences(p => [...p, { id: Date.now().toString(), activity: '' }]);

  const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700";
  const selectClasses = `${inputClasses} pr-8`;
  const buttonClasses = "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 dark:disabled:bg-indigo-800";
  
  return (
    <div className="space-y-8">
      {/* Lectures */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Fixed Lectures / Classes</h3>
        <div className="space-y-4">
          {lectures.map(lec => (
            <div key={lec.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border dark:border-gray-700">
              <input type="text" placeholder="Subject" value={lec.subject} onChange={e => updateLecture(lec.id, 'subject', e.target.value)} className={inputClasses} disabled={disabled} />
              <select value={lec.day} onChange={e => updateLecture(lec.id, 'day', e.target.value)} className={selectClasses} disabled={disabled}>
                {Object.values(DayOfWeek).map(day => <option key={day} value={day}>{day}</option>)}
              </select>
              <TimeInput value={lec.startTime} onChange={val => updateLecture(lec.id, 'startTime', val)} />
              <TimeInput value={lec.endTime} onChange={val => updateLecture(lec.id, 'endTime', val)} />
              <button onClick={() => removeLecture(lec.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <button onClick={addLecture} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> Add Lecture</button>
      </section>

      {/* Study Goals */}
      <section>
         <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Weekly Study Goals</h3>
        <div className="space-y-4">
          {studyGoals.map(goal => (
            <div key={goal.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border dark:border-gray-700">
              <input type="text" placeholder="Subject to Study" value={goal.subject} onChange={e => updateStudyGoal(goal.id, 'subject', e.target.value)} className={inputClasses} disabled={disabled} />
              <div className="flex items-center gap-2">
                 <input type="number" placeholder="Hours/week" value={goal.hours} min="1" onChange={e => updateStudyGoal(goal.id, 'hours', parseInt(e.target.value, 10))} className={inputClasses} disabled={disabled} />
                 <span className="text-sm text-gray-600 dark:text-gray-400">hours/week</span>
              </div>
              <button onClick={() => removeStudyGoal(goal.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
         <button onClick={addStudyGoal} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> Add Study Goal</button>
      </section>

      {/* Agenda Items */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Personal Agenda (Appointments, etc.)</h3>
        <div className="space-y-4">
          {agendaItems.map(item => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border dark:border-gray-700">
              <input type="text" placeholder="Activity Title" value={item.title} onChange={e => updateAgendaItem(item.id, 'title', e.target.value)} className={inputClasses} disabled={disabled} />
              <select value={item.day} onChange={e => updateAgendaItem(item.id, 'day', e.target.value)} className={selectClasses} disabled={disabled}>
                {Object.values(DayOfWeek).map(day => <option key={day} value={day}>{day}</option>)}
              </select>
              <TimeInput value={item.startTime} onChange={val => updateAgendaItem(item.id, 'startTime', val)} />
              <TimeInput value={item.endTime} onChange={val => updateAgendaItem(item.id, 'endTime', val)} />
              <button onClick={() => removeAgendaItem(item.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
        <button onClick={addAgendaItem} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> Add Agenda Item</button>
      </section>

      {/* Break Preferences */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Break Preferences</h3>
         <div className="space-y-4">
          {breakPreferences.map(pref => (
            <div key={pref.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border dark:border-gray-700">
              <input type="text" placeholder="e.g., Watch YouTube, Walk" value={pref.activity} onChange={e => updateBreakPreference(pref.id, 'activity', e.target.value)} className={`${inputClasses} md:col-span-1`} disabled={disabled} />
              <input type="text" placeholder="Optional: relevant link" value={pref.link || ''} onChange={e => updateBreakPreference(pref.id, 'link', e.target.value)} className={`${inputClasses} md:col-span-1`} disabled={disabled} />
              <button onClick={() => removeBreakPreference(pref.id)} className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400" disabled={disabled}><TrashIcon className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
         <button onClick={addBreakPreference} className={`${buttonClasses} mt-4`} disabled={disabled}><PlusIcon className="w-4 h-4" /> Add Break Preference</button>
      </section>
      
      {/* General Goals */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">General Goals for the Week</h3>
        <textarea
          value={generalGoals}
          onChange={(e) => setGeneralGoals(e.target.value)}
          rows={3}
          className={`${inputClasses} resize-y`}
          placeholder="e.g., Finish Calculus assignment, Prepare for Physics quiz..."
          disabled={disabled}
        />
      </section>
    </div>
  );
};

export default TimetableInput;
