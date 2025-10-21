import React, { useState, useEffect } from 'react';
import type { SmartPlan, PlanSlot } from '../types.ts';
import { ActivityType, DayOfWeek } from '../types.ts';
import { DAYS_OF_WEEK } from '../constants.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';

const getActivityColor = (type: ActivityType) => {
  const baseClasses = 'text-white shadow-lg border-l-4';
  switch (type) {
    case ActivityType.LECTURE:
      return `${baseClasses} bg-lecture border-lecture/80`;
    case ActivityType.STUDY:
      return `${baseClasses} bg-study border-study/80`;
    case ActivityType.AGENDA:
      return `${baseClasses} bg-agenda border-agenda/80`;
    case ActivityType.BREAK:
      return `${baseClasses} bg-break border-break/80`;
    case ActivityType.FREE:
      return `${baseClasses} bg-free border-free/80`;
    default:
      return `${baseClasses} bg-slate-500 border-slate-300`;
  }
};

const PlanSlotCard: React.FC<{ slot: PlanSlot; onClick?: () => void; tooltip?: string; isCurrent?: boolean }> = ({ slot, onClick, tooltip, isCurrent }) => {
    const isClickable = !!(slot.link || onClick);

    const cardClasses = `relative group p-4 rounded-xl shadow-md mb-4 transition-all duration-300 transform hover:shadow-xl hover:scale-105 ${getActivityColor(slot.type)} ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${isCurrent ? 'ring-2 ring-primary dark:ring-primary-light' : ''}`;
    
    const content = (
        <div className={cardClasses}>
             {isCurrent && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold bg-red-600 px-2 py-1 rounded-full text-white shadow-md">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    Live
                </div>
            )}
            <p className="font-bold text-base mb-1 pr-12">{slot.activity}</p>
            {slot.code && <p className="text-sm font-mono mt-1 text-white/90 bg-black/20 px-2 py-1 rounded">{slot.code}</p>}
            <p className="text-sm text-white/90 mt-2 font-medium">{slot.startTime} - {slot.endTime}</p>
            <p className="text-sm capitalize mt-2 font-semibold text-white/95 bg-white/20 px-2 py-1 rounded-full inline-block">{slot.type}</p>
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 text-sm font-medium text-white bg-gray-900 dark:bg-black rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 dark:border-t-black"></div>
                </div>
            )}
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
    dayRefs?: React.MutableRefObject<Record<DayOfWeek, HTMLDivElement | null>>;
}

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    try {
        const timeLower = time.toLowerCase().replace(/\s/g, '');
        const isPM = timeLower.includes('pm');
        const isAM = timeLower.includes('am');

        const timeOnly = timeLower.replace('am', '').replace('pm', '');
        
        let [hourStr, minuteStr] = timeOnly.split(':');
        
        if (!minuteStr) minuteStr = '0';

        let hours = parseInt(hourStr, 10);
        const minutes = parseInt(minuteStr, 10);

        if (isNaN(hours) || isNaN(minutes)) {
            console.warn(`Could not parse time: ${time}`);
            return 0;
        }
        
        if (isPM && hours !== 12) {
            hours += 12;
        }
        if (isAM && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    } catch (e) {
        console.error("Failed to parse time string:", time, e);
        return 0;
    }
};

const SmartPlanView: React.FC<SmartPlanViewProps> = ({ plan, onStudySlotClick, dayRefs }) => {
  const { t } = useLanguage();
  const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000); // Update time every minute to check for day change
        return () => clearInterval(timer);
    }, []);
    
    const DAYS_MAP: DayOfWeek[] = [
      DayOfWeek.Sunday,
      DayOfWeek.Monday,
      DayOfWeek.Tuesday,
      DayOfWeek.Wednesday,
      DayOfWeek.Thursday,
      DayOfWeek.Friday,
      DayOfWeek.Saturday,
    ];

    const getCurrentDay = (date: Date): DayOfWeek => DAYS_MAP[date.getDay()];

  const weekdaysData = DAYS_OF_WEEK.slice(0, 5).map(day => 
    plan.find(p => p.day === day) || { day, slots: [] }
  );
  const weekendsData = DAYS_OF_WEEK.slice(5).map(day => 
    plan.find(p => p.day === day) || { day, slots: [] }
  );

  const DayCard: React.FC<{ day: DayOfWeek; slots: PlanSlot[]; isWeekend?: boolean }> = ({ day, slots, isWeekend = false }) => {
    const currentDay = getCurrentDay(now);
    const sortedSlots = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return (
        <div ref={el => { if(dayRefs) dayRefs.current[day] = el }} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50 h-full transition-all duration-300 hover:shadow-2xl">
          <h3 className={`text-2xl font-bold text-center mb-6 bg-gradient-to-r ${isWeekend ? 'from-green-500 to-teal-500' : 'from-primary to-purple-600'} bg-clip-text text-transparent`}>{day}</h3>
          {sortedSlots.length > 0 ? (
            sortedSlots.map((slot, index) => {
              const isClickable = slot.type === ActivityType.STUDY && day === currentDay && !!onStudySlotClick;
              const tooltip = isClickable ? t('smartplan.clickToStudy') : undefined;
              const isCurrent = day === currentDay && nowMinutes >= timeToMinutes(slot.startTime) && nowMinutes < timeToMinutes(slot.endTime);
              
              return (
                  <PlanSlotCard 
                      key={index} 
                      slot={slot} 
                      onClick={isClickable ? () => onStudySlotClick!(slot, day) : undefined} 
                      tooltip={tooltip}
                      isCurrent={isCurrent}
                  />
              );
            })
          ) : (
            <div className="flex items-center justify-center h-56">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-2xl text-gray-400">📅</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">{t('smartplan.noActivities')}</p>
                </div>
            </div>
          )}
        </div>
    );
  };
  
  return (
    <div className="relative">
      <div className="relative z-10 space-y-8">
        {/* Weekdays Row */}
        <div className="grid grid-flow-col auto-cols-[20rem] lg:auto-cols-fr lg:grid-flow-row lg:grid-cols-5 gap-6 overflow-x-auto pb-6 -mx-4 px-4">
          {weekdaysData.map(({ day, slots }) => (
            <DayCard key={day} day={day} slots={slots} />
          ))}
        </div>

        {/* Weekends Row */}
        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full lg:w-2/5">
            {weekendsData.map(({ day, slots }) => (
              <DayCard key={day} day={day} slots={slots} isWeekend />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPlanView;