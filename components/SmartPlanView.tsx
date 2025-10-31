import React, { useState, useEffect } from 'react';
import type { SmartPlan, PlanSlot, Toast, UserDetails } from '../types';
import { ActivityType, DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { getNextDateForDay, timeToMinutes, parseTimeToDate } from '../lib/utils';
import { CloseIcon } from './icons/CloseIcon';
import { MailIcon } from './icons/MailIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { LocationPinIcon } from './icons/LocationPinIcon';

const CalendarAddIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
        <line x1="12" y1="14" x2="12" y2="20"></line>
        <line x1="9" y1="17" x2="15" y2="17"></line>
    </svg>
);


interface AddToCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    slot: PlanSlot | null;
    day: DayOfWeek | null;
    addToast: (message: string, type: Toast['type']) => void;
    userDetails: UserDetails | null;
}

const AddToCalendarModal: React.FC<AddToCalendarModalProps> = ({ isOpen, onClose, slot, day, addToast, userDetails }) => {
    const { t } = useLanguage();
    if (!isOpen || !slot || !day) return null;

    const startDate = getNextDateForDay(day, slot.startTime);
    const endDate = parseTimeToDate(slot.endTime, startDate); // Ensure end date is on the same day

    // Formatter for Google Calendar (YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS)
    const formatGoogleDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    // Formatter for Outlook (YYYY-MM-DDTHH:MM:SS)
    const formatOutlookDate = (date: Date): string => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        return `${datePart}T${timePart}`;
    };

    const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(slot.activity)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(slot.location || '')}`;
    const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(slot.activity)}&startdt=${formatOutlookDate(startDate)}&enddt=${formatOutlookDate(endDate)}&location=${encodeURIComponent(slot.location || '')}`;
    
    const downloadICSFile = () => {
        const formatICSDate = (date: Date) => {
          return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EduBlay Study Hub//EN
BEGIN:VEVENT
UID:${Date.now()}@edublay.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${slot.activity}
DESCRIPTION:${slot.code || ''}
LOCATION:${slot.location || ''}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder: ${slot.activity}
END:VALARM
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${slot.activity.replace(/\s+/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const sendEmailReminder = () => {
        if (!userDetails?.email) {
            addToast(t('reminders.setEmail'), 'warning');
            return;
        }
        // Mock implementation as there is no backend
        addToast(t('reminders.emailSuccess', { email: userDetails.email }), 'info');
    };

    const actionButtonClasses = "flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors text-sm";


    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold">{t('addToCalendar.title')}</h2>
                    <button onClick={onClose}><CloseIcon className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <p className="text-sm font-semibold text-gray-500">{t('addToCalendar.subject')}</p>
                        <p className="font-bold text-lg">{slot.activity}</p>
                        <p className="text-sm font-semibold text-gray-500 mt-2">{t('addToCalendar.time')}</p>
                        <p className="font-medium">{day}, {slot.startTime} - {slot.endTime}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <a href={googleLink} target="_blank" rel="noopener noreferrer" className={`${actionButtonClasses} bg-blue-100 text-blue-700 hover:bg-blue-200`}>
                            <CalendarIcon className="w-5 h-5" />
                            {t('addToCalendar.google')}
                            <ExternalLinkIcon className="w-4 h-4" />
                        </a>
                        <a href={outlookLink} target="_blank" rel="noopener noreferrer" className={`${actionButtonClasses} bg-sky-100 text-sky-700 hover:bg-sky-200`}>
                             <CalendarIcon className="w-5 h-5" />
                            {t('addToCalendar.outlook')}
                            <ExternalLinkIcon className="w-4 h-4" />
                        </a>
                         <button onClick={downloadICSFile} className={`${actionButtonClasses} bg-purple-100 text-purple-700 hover:bg-purple-200`}>
                            <DownloadIcon className="w-5 h-5" />
                            {t('addToCalendar.download')}
                        </button>
                        <button onClick={sendEmailReminder} disabled={!userDetails?.email} className={`${actionButtonClasses} bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed`}>
                            <MailIcon className="w-5 h-5" />
                            {t('addToCalendar.email')}
                        </button>
                    </div>
                    {!userDetails?.email && <p className="text-xs text-center text-gray-500 mt-2">{t('reminders.emailInfo')}</p>}
                </div>
            </div>
        </div>
    );
};

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

const PlanSlotCard: React.FC<{ slot: PlanSlot; onClick?: () => void; tooltip?: string; isCurrent?: boolean; onAddToCalendarClick: () => void; }> = ({ slot, onClick, tooltip, isCurrent, onAddToCalendarClick }) => {
    const isClickable = !!(slot.link || onClick);

    const cardClasses = `relative group p-4 rounded-xl shadow-md mb-4 transition-all duration-300 transform hover:shadow-xl hover:scale-105 ${getActivityColor(slot.type)} ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${isCurrent ? 'ring-2 ring-primary dark:ring-primary-light' : ''}`;
    
    const content = (
        <div className={cardClasses}>
             {isCurrent && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs font-semibold bg-red-600 px-2 py-1 rounded-full text-white shadow-md">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                    <span>Live</span>
                </div>
            )}
            <button 
                onClick={(e) => { e.stopPropagation(); onAddToCalendarClick(); }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors opacity-0 group-hover:opacity-100"
                title="Add to calendar"
            >
                <CalendarAddIcon className="w-4 h-4 text-white" />
            </button>
            <p className="font-bold text-base mb-1 pr-12">{slot.activity}</p>
            {slot.code && <p className="text-sm font-mono mt-1 text-white/90 bg-black/20 px-2 py-1 rounded">{slot.code}</p>}
            <p className="text-sm text-white/90 mt-2 font-medium">{slot.startTime} - {slot.endTime}</p>
            {slot.location && (
                <p className="flex items-center gap-1 text-sm text-white/90 mt-1">
                    <LocationPinIcon className="w-4 h-4" /> {slot.location}
                </p>
            )}
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
    addToast: (message: string, type: Toast['type']) => void;
    userDetails: UserDetails | null;
}

const SmartPlanView: React.FC<SmartPlanViewProps> = ({ plan, onStudySlotClick, dayRefs, addToast, userDetails }) => {
  const { t } = useLanguage();
  const [now, setNow] = useState(new Date());
  const [calendarModalState, setCalendarModalState] = useState<{ isOpen: boolean; slot: PlanSlot | null; day: DayOfWeek | null }>({ isOpen: false, slot: null, day: null });

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
    
    const handleAddToCalendarClick = (slot: PlanSlot, day: DayOfWeek) => {
        setCalendarModalState({ isOpen: true, slot, day });
    };

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
                      onAddToCalendarClick={() => handleAddToCalendarClick(slot, day)}
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
      <AddToCalendarModal
        isOpen={calendarModalState.isOpen}
        onClose={() => setCalendarModalState({ isOpen: false, slot: null, day: null })}
        slot={calendarModalState.slot}
        day={calendarModalState.day}
        addToast={addToast}
        userDetails={userDetails}
       />
    </div>
  );
};

export default SmartPlanView;