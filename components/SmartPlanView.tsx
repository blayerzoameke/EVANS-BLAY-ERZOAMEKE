
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
    const endDate = parseTimeToDate(slot.endTime, startDate);

    const formatGoogleDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
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
                </div>
            </div>
        </div>
    );
};

// Fixed to ensure strings from AI (even if case varies) are matched to correct Tailwind colors
const getActivityColor = (type: string) => {
  const baseClasses = 'text-white shadow-md border-l-4 transition-all duration-200';
  const t = type.toLowerCase();
  
  switch (t) {
    case 'lecture':
      return `${baseClasses} bg-lecture border-lecture/80`;
    case 'study':
      return `${baseClasses} bg-study border-study/80`;
    case 'agenda':
      return `${baseClasses} bg-agenda border-agenda/80`;
    case 'break':
      return `${baseClasses} bg-break border-break/80`;
    case 'free':
      return `${baseClasses} bg-free border-free/80`;
    default:
      return `${baseClasses} bg-gray-600 border-gray-400`;
  }
};

const PlanSlotCard: React.FC<{ slot: PlanSlot; onClick?: () => void; tooltip?: string; isCurrent?: boolean; onAddToCalendarClick: () => void; }> = ({ slot, onClick, tooltip, isCurrent, onAddToCalendarClick }) => {
    const { t } = useLanguage();
    const isClickable = !!(slot.link || onClick);

    const cardClasses = `relative group p-2.5 rounded-lg shadow-sm mb-2 transform hover:scale-[1.02] ${getActivityColor(slot.type)} ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${isCurrent ? 'ring-2 ring-white/50 animate-pulse-slow' : ''}`;
    
    const content = (
        <div className={cardClasses}>
             {isCurrent && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-[10px] font-semibold bg-red-600 px-1.5 py-0.5 rounded-full text-white shadow-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                    <span>{t('smartplan.live')}</span>
                </div>
            )}
            <button 
                onClick={(e) => { e.stopPropagation(); onAddToCalendarClick(); }}
                className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors opacity-0 group-hover:opacity-100"
                title="Add to calendar"
            >
                <CalendarAddIcon className="w-3 h-3 text-white" />
            </button>
            <p className="font-bold text-sm leading-tight mb-1 pr-6 break-words line-clamp-2" title={slot.activity}>{slot.activity}</p>
            {slot.code && slot.code !== slot.activity && <p className="text-[10px] font-mono mt-0.5 text-white/90 bg-black/20 px-1.5 py-0.5 rounded inline-block uppercase">{slot.code}</p>}
            <p className="text-xs text-white/90 mt-1 font-medium">{slot.startTime} - {slot.endTime}</p>
            {slot.location && slot.type.toLowerCase() === 'lecture' && (
                <p className="flex items-center gap-1 text-xs text-white/90 mt-0.5 truncate">
                    <LocationPinIcon className="w-3 h-3 flex-shrink-0" /> {slot.location}
                </p>
            )}
            <p className="text-[10px] uppercase mt-1.5 font-bold text-white/80 bg-black/10 px-1.5 py-0.5 rounded-full inline-block">{slot.type}</p>
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[180px] px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 pointer-events-none text-center">
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
            )}
        </div>
    );

    if (onClick) {
        return (
            <div 
                onClick={onClick} 
                className="w-full text-left block" 
                role="button" 
                tabIndex={0} 
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            >
                {content}
            </div>
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
        const timer = setInterval(() => setNow(new Date()), 60000);
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
        <div ref={el => { if(dayRefs && dayRefs.current) dayRefs.current[day] = el }} className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-md p-3 border border-gray-200 dark:border-gray-700 h-full transition-all duration-300 hover:shadow-xl">
          <h3 className={`text-lg font-extrabold text-center mb-4 pb-2 border-b dark:border-gray-700 ${isWeekend ? 'text-green-600 dark:text-green-400' : 'text-primary dark:text-primary-light'}`}>{day}</h3>
          {sortedSlots.length > 0 ? (
            <div className="space-y-1">
                {sortedSlots.map((slot, index) => {
                const isClickable = slot.type.toLowerCase() === 'study' && day === currentDay && !!onStudySlotClick;
                const tooltip = isClickable ? t('smartplan.clickToStudy') : undefined;
                
                let isCurrent = false;
                if (day === currentDay) {
                    const startMinutes = timeToMinutes(slot.startTime);
                    const endMinutes = timeToMinutes(slot.endTime);
                    if (endMinutes < startMinutes) {
                        isCurrent = nowMinutes >= startMinutes || nowMinutes < endMinutes;
                    } else {
                        isCurrent = nowMinutes >= startMinutes && nowMinutes < endMinutes;
                    }
                }
                
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
                })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
                <div className="text-center opacity-60">
                    <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-lg">📅</span>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-tighter">{t('smartplan.noActivities')}</p>
                </div>
            </div>
          )}
        </div>
    );
  };
  
  return (
    <div className="relative">
      <div className="relative z-10 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {weekdaysData.map(({ day, slots }) => (
            <DayCard key={day} day={day} slots={slots} />
          ))}
        </div>

        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-2/5">
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
