import React from 'react';
import type { SmartPlan, PlanSlot } from '../types.ts';
import { ActivityType } from '../types.ts';
import { DAYS_OF_WEEK } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case ActivityType.LECTURE:
      return 'bg-violet-100 dark:bg-violet-500/20 border-l-4 border-violet-500 text-violet-900 dark:text-violet-100 print:bg-violet-100';
    case ActivityType.STUDY:
      return 'bg-blue-100 dark:bg-blue-500/20 border-l-4 border-blue-500 text-blue-900 dark:text-blue-100 print:bg-blue-100';
    case ActivityType.AGENDA:
      return 'bg-amber-100 dark:bg-amber-500/20 border-l-4 border-amber-500 text-amber-900 dark:text-amber-100 print:bg-amber-100';
    case ActivityType.BREAK:
      return 'bg-emerald-100 dark:bg-emerald-500/20 border-l-4 border-emerald-500 text-emerald-900 dark:text-emerald-100 print:bg-emerald-100';
    case ActivityType.FREE:
      return 'bg-slate-100 dark:bg-slate-700/50 border-l-4 border-slate-400 text-slate-800 dark:text-slate-300 print:bg-slate-100';
    default:
      return 'bg-slate-100 dark:bg-slate-800 border-l-4 border-slate-300 text-slate-800 dark:text-slate-300 print:bg-slate-100';
  }
};

const PlanSlotCard: React.FC<{ slot: PlanSlot }> = ({ slot }) => {
  const content = (
    <div className={`p-3 rounded-lg shadow-sm mb-3 transition-shadow duration-200 ${getActivityColor(slot.type)} ${slot.link ? 'hover:shadow-md' : ''} print:shadow-none print:rounded-md`}>
      <p className="font-bold text-sm print:text-black">{slot.activity}</p>
      {slot.code && <p className="text-xs font-mono mt-1 opacity-70 print:text-slate-600">{slot.code}</p>}
      <p className="text-xs opacity-80 print:text-black">{slot.startTime} - {slot.endTime}</p>
      <p className="text-xs capitalize mt-1 font-medium opacity-90 print:text-black">{slot.type}</p>
    </div>
  );

  if (slot.link) {
    return (
      <a href={slot.link} target="_blank" rel="noopener noreferrer" className="no-underline">
        {content}
      </a>
    );
  }

  return content;
};

interface SmartPlanViewProps {
    plan: SmartPlan;
}

const SmartPlanView: React.FC<SmartPlanViewProps> = ({ plan }) => {
  const { t } = useLanguage();
  const planByDay = DAYS_OF_WEEK.map(day => {
    return plan.find(p => p.day === day) || { day, slots: [] };
  });

  return (
    <div className="relative">
      <div className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
          {planByDay.map(({ day, slots }) => (
            <div key={day} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl shadow p-4 border border-slate-200 dark:border-slate-700 print:bg-white print:shadow-none print:border-slate-300 print:backdrop-blur-none">
              <h3 className="text-xl font-bold text-center mb-4 text-blue-700 dark:text-blue-500 print:text-black">{day}</h3>
              {slots.length > 0 ? (
                slots.map((slot, index) => <PlanSlotCard key={index} slot={slot} />)
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8 print:text-black">{t('smartplan.noActivities')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SmartPlanView;