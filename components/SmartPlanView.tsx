import React from 'react';
import type { SmartPlan, PlanSlot } from '../types';
import { ActivityType } from '../types';
import { DAYS_OF_WEEK } from '../constants';

interface SmartPlanViewProps {
  plan: SmartPlan;
  institution?: string;
  institutionLogo?: string;
}

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case ActivityType.LECTURE:
      return 'bg-red-100 dark:bg-red-900 border-l-4 border-red-500 print:bg-red-100';
    case ActivityType.STUDY:
      return 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 print:bg-blue-100';
    case ActivityType.AGENDA:
      return 'bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 print:bg-yellow-100';
    case ActivityType.BREAK:
      return 'bg-green-100 dark:bg-green-900 border-l-4 border-green-500 print:bg-green-100';
    case ActivityType.FREE:
      return 'bg-gray-100 dark:bg-gray-700 border-l-4 border-gray-400 print:bg-gray-100';
    default:
      return 'bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-300 print:bg-gray-50';
  }
};

const PlanSlotCard: React.FC<{ slot: PlanSlot }> = ({ slot }) => {
  const content = (
    <div className={`p-3 rounded-lg shadow-sm mb-3 transition-transform duration-200 ${getActivityColor(slot.type)} ${slot.link ? 'hover:scale-105' : ''} print:shadow-none print:rounded-md`}>
      <p className="font-bold text-sm text-gray-800 dark:text-gray-100 print:text-black">{slot.activity}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400 print:text-black">{slot.startTime} - {slot.endTime}</p>
      <p className="text-xs capitalize mt-1 font-medium text-gray-500 dark:text-gray-300 print:text-black">{slot.type}</p>
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

const SmartPlanView: React.FC<SmartPlanViewProps> = ({ plan, institution, institutionLogo }) => {
  const planByDay = DAYS_OF_WEEK.map(day => {
    return plan.find(p => p.day === day) || { day, slots: [] };
  });

  const institutionDomain = institution
    ? institution.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9.-]/gi, '')
    : '';

  const hasLogo = institutionLogo || (institution && institutionDomain);

  return (
    <div className="relative">
      {hasLogo && (
        <div className="absolute inset-0 flex items-center justify-center z-0 print:hidden">
          <img 
            src={institutionLogo || `https://logo.clearbit.com/${institutionDomain}`} 
            alt={`${institution || 'University'} logo`}
            className="w-1/2 h-1/2 object-contain opacity-5 pointer-events-none"
            onError={(e) => {
              // Only hide the logo if it's the fallback Clearbit logo that fails
              if (!institutionLogo) {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }
            }}
          />
        </div>
      )}
      <div className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
          {planByDay.map(({ day, slots }) => (
            <div key={day} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700 transition-transform duration-200 hover:scale-105 hover:shadow-lg print:bg-white print:shadow-none print:border-gray-300 print:backdrop-blur-none">
              <h3 className="text-xl font-bold text-center mb-4 text-indigo-600 dark:text-indigo-400 print:text-black">{day}</h3>
              {slots.length > 0 ? (
                slots.map((slot, index) => <PlanSlotCard key={index} slot={slot} />)
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8 print:text-black">No activities scheduled.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SmartPlanView;