import React from 'react';
import type { SmartPlan, PlanSlot, DayOfWeek } from '../types.ts';
import { ActivityType } from '../types.ts';
import { DAYS_OF_WEEK } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case ActivityType.LECTURE:
      return 'bg-fuchsia-100 dark:bg-fuchsia-900/50 border-l-4 border-fuchsia-500 text-fuchsia-800 dark:text-fuchsia-100';
    case ActivityType.STUDY:
      return 'bg-sky-100 dark:bg-sky-900/50 border-l-4 border-sky-500 text-sky-800 dark:text-sky-100';
    case ActivityType.AGENDA:
      return 'bg-amber-100 dark:bg-amber-900/50 border-l-4 border-amber-500 text-amber-800 dark:text-amber-100';
    case ActivityType.BREAK:
      return 'bg-emerald-100 dark:bg-emerald-900/50 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-100';
    case ActivityType.FREE:
      return 'bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-400 text-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-300 text-gray-800 dark:text-gray-300';
  }
};

const PlanSlotCard: React.FC<{ slot: PlanSlot; onClick?: () => void }> = ({ slot, onClick }) => {
  const content = (
    <div className={`p-3 rounded-lg shadow-sm mb-3 transition-shadow duration-200 ${getActivityColor(slot.type)} ${slot.link || onClick ? 'hover:shadow-md' : ''}`}>
      <p className="font-bold text-sm">{slot.activity}</p>
      {slot.code && <p className="text-xs font-mono mt-1 opacity-70">{slot.code}</p>}
      <p className="text-xs opacity-80">{slot.startTime} - {slot.endTime}</p>
      <p className="text-xs capitalize mt-1 font-medium opacity-90">{slot.type}</p>
    </div>
  );
  
  if (onClick) {
      return (
          <button onClick={onClick} className="w-full text-left block">
              {content}
          </button>
      );
  }

  if (slot.link) {
    return (
      <a href={slot.link} target="_blank" rel="noopener noreferrer" className="no-underline block">
        {content}
      </a>
    );
  }

  return content;
};

interface SmartPlanViewProps {
    plan: SmartPlan;
    onStudySlotClick?: (slot: PlanSlot, day: DayOfWeek) => void;
}

const SmartPlanView: React.FC<SmartPlanViewProps> = ({ plan, onStudySlotClick }) => {
  const { t } = useLanguage();
  const planByDay = DAYS_OF_WEEK.map(day => {
    return plan.find(p => p.day === day) || { day, slots: [] };
  });

  return (
    <div className="relative">
      <div className="relative z-10">
        <div className="grid grid-flow-col auto-cols-[18rem] lg:auto-cols-fr lg:grid-flow-row lg:grid-cols-7 gap-4 overflow-x-auto pb-4 -mx-4 px-4">
          {planByDay.map(({ day, slots }) => (
            <div key={day} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700 h-full">
              <h3 className="text-xl font-bold text-center mb-4 text-sky-600 dark:text-sky-400">{day}</h3>
              {slots.length > 0 ? (
                slots.map((slot, index) => <PlanSlotCard key={index} slot={slot} onClick={ (slot.type === ActivityType.STUDY && onStudySlotClick) ? () => onStudySlotClick(slot, day) : undefined } />)
              ) : (
                <div className="flex items-center justify-center h-48">
                    <p className="text-center text-gray-500 dark:text-gray-400">{t('smartplan.noActivities')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SmartPlanView;