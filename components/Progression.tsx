import React, { useMemo } from 'react';
// FIX: Added .ts extension to import path.
import { SmartPlan, ActivityType, DayOfWeek, TrackedSession } from '../types.ts';
import { DAYS_OF_WEEK } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface ProgressionProps {
  plan: SmartPlan | null;
  trackedData: TrackedSession[];
}

// Helper component for card layout
const StatsCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800/50 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 ${className}`}>
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
        <div>
            {children}
        </div>
    </div>
);

const DonutChart: React.FC<{ data: { type: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-48 w-48 rounded-full bg-gray-200 dark:bg-gray-700"><span className="text-gray-500">No Data</span></div>;

    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercentage = 0;

    return (
        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
            {data.map((item, index) => {
                if (item.value === 0) return null;
                const percentage = item.value / total;
                const strokeDasharray = `${percentage * circumference} ${circumference}`;
                const strokeDashoffset = -accumulatedPercentage * circumference;
                accumulatedPercentage += percentage;

                return (
                    <circle
                        key={index}
                        r={radius}
                        cx="100"
                        cy="100"
                        fill="transparent"
                        strokeWidth="30"
                        className={item.color}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        aria-label={`${item.type}: ${((item.value / total) * 100).toFixed(1)}%`}
                    />
                );
            })}
        </svg>
    );
};

const Progression: React.FC<ProgressionProps> = ({ plan, trackedData }) => {
  const { t } = useLanguage();
  const stats = useMemo(() => {
    if (!plan) return null;

    const totals = { study: 0, lecture: 0, agenda: 0, break: 0, free: 0 };
    const studyBySubject = new Map<string, number>();
    const dailyTotals = new Map<string, number>();

    // FIX: Updated timeToMinutes to correctly parse HH:MM AM/PM format.
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
            
            if (isNaN(hours) || isNaN(minutes)) return 0;

            return hours * 60 + minutes;
        } catch (e) {
            console.error("Malformed time value in timeToMinutes:", time, e);
            return 0;
        }
    };

    for (const day of plan) {
      let dayTotalMinutes = 0;
      for (const slot of day.slots) {
        if (!slot.startTime || !slot.endTime) continue;
        const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        if (duration <= 0) continue;

        const activityType = slot.type || ActivityType.FREE;
        dayTotalMinutes += duration;

        switch (activityType) {
          case ActivityType.STUDY:
            totals.study += duration;
            studyBySubject.set(slot.activity, (studyBySubject.get(slot.activity) || 0) + duration);
            break;
          case ActivityType.LECTURE:
            totals.lecture += duration;
            break;
          case ActivityType.AGENDA:
            totals.agenda += duration;
            break;
          case ActivityType.BREAK:
            totals.break += duration;
            break;
          case ActivityType.FREE:
            totals.free += duration;
            break;
        }
      }
      dailyTotals.set(day.day, dayTotalMinutes);
    }
    
    // Process tracked data
    const trackedStudyBySubject = new Map<string, number>();
    trackedData.forEach(session => {
        trackedStudyBySubject.set(session.subject, (trackedStudyBySubject.get(session.subject) || 0) + session.durationMinutes);
    });

    const scheduledSubjects = Array.from(studyBySubject.keys());
    const trackedSubjects = Array.from(trackedStudyBySubject.keys());
    const allSubjects = Array.from(new Set([...scheduledSubjects, ...trackedSubjects]));

    const trackedVsScheduled = allSubjects.map(subject => ({
        subject,
        scheduledHours: (studyBySubject.get(subject) || 0) / 60,
        trackedHours: (trackedStudyBySubject.get(subject) || 0) / 60,
    }));

    return {
      totalHours: {
        study: (totals.study / 60).toFixed(1),
        lecture: (totals.lecture / 60).toFixed(1),
        agenda: (totals.agenda / 60).toFixed(1),
        break: (totals.break / 60).toFixed(1),
        free: (totals.free / 60).toFixed(1),
      },
      dailyHours: DAYS_OF_WEEK.map(day => ({
        day: day.slice(0, 3),
        hours: (dailyTotals.get(day) || 0) / 60
      })),
      activityDistribution: [
        { type: 'Study', value: totals.study, color: 'stroke-blue-500', legendColor: 'bg-blue-500' },
        { type: 'Lecture', value: totals.lecture, color: 'stroke-red-500', legendColor: 'bg-red-500' },
        { type: 'Agenda', value: totals.agenda, color: 'stroke-yellow-500', legendColor: 'bg-yellow-500' },
        { type: 'Break', value: totals.break, color: 'stroke-green-500', legendColor: 'bg-green-500' },
        { type: 'Free', value: totals.free, color: 'stroke-gray-400', legendColor: 'bg-gray-400' },
      ],
      trackedVsScheduled,
    };
  }, [plan, trackedData]);

  if (!plan || !stats) {
    return (
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10 text-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{t('progression.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400">
          {t('progression.noPlan')}
        </p>
      </div>
    );
  }

  const maxDailyHours = Math.max(...stats.dailyHours.map(d => d.hours), 1);
  const totalWeekHours = stats.activityDistribution.reduce((acc, curr) => acc + curr.value, 0) / 60;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
       <div>
         <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('progression.title')}</h2>
         <p className="text-gray-500 dark:text-gray-400 mt-1">{t('progression.subtitle')}</p>
       </div>
       
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatsCard title={t('progression.weeklyOverview')} className="lg:col-span-1">
                <div className="space-y-4">
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalStudy')}</p><p className="font-bold text-2xl text-blue-600 dark:text-blue-400">{stats.totalHours.study}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalLecture')}</p><p className="font-bold text-lg text-red-600 dark:text-red-400">{stats.totalHours.lecture}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.personalAgenda')}</p><p className="font-bold text-lg text-yellow-600 dark:text-yellow-400">{stats.totalHours.agenda}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalBreak')}</p><p className="font-bold text-lg text-green-600 dark:text-green-400">{stats.totalHours.break}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalFree')}</p><p className="font-bold text-lg text-gray-500 dark:text-gray-400">{stats.totalHours.free}h</p></div>
                </div>
            </StatsCard>
            
            <StatsCard title={t('progression.activityBreakdown')} className="lg:col-span-2">
                <div className="flex flex-col md:flex-row items-center justify-around gap-6">
                    <DonutChart data={stats.activityDistribution} />
                    <div className="space-y-2 text-sm w-full max-w-xs">
                        {stats.activityDistribution.map(item => item.value > 0 && (
                            <div key={item.type} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className={`w-3 h-3 rounded-full mr-2 ${item.legendColor}`}></span>
                                    <span>{item.type}</span>
                                </div>
                                <span className="font-semibold">{totalWeekHours > 0 ? ((item.value / 60) / totalWeekHours * 100).toFixed(0) : 0}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </StatsCard>
       </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <StatsCard title={t('progression.trackedVsScheduled')}>
                {stats.trackedVsScheduled.length > 0 ? (
                    <div className="space-y-4">
                        {stats.trackedVsScheduled.map(item => (
                            <div key={item.subject}>
                                <div className="flex justify-between mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span>{item.subject}</span>
                                    <span>{item.trackedHours.toFixed(1)}h / {item.scheduledHours.toFixed(1)}h</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative">
                                    <div className="bg-blue-300 dark:bg-blue-800 h-4 rounded-full" style={{ width: `${(item.scheduledHours / Math.max(item.scheduledHours, item.trackedHours, 1)) * 100}%` }}></div>
                                    <div className="bg-blue-600 h-4 rounded-full absolute top-0 left-0" style={{ width: `${(item.trackedHours / Math.max(item.scheduledHours, item.trackedHours, 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                         <div className="flex items-center justify-end space-x-4 text-xs pt-2">
                            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-blue-600 mr-1.5"></span> Tracked</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-800 mr-1.5"></span> Scheduled</div>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('progression.noGoals')}</p>
                )}
            </StatsCard>
            <StatsCard title={t('progression.dailyScheduled')}>
                 <div className="flex justify-between items-end h-56 space-x-2 md:space-x-4" aria-label="Daily scheduled hours chart">
                    {stats.dailyHours.map(item => (
                      <div key={item.day} className="flex-1 flex flex-col items-center group transition-colors duration-300 p-1 rounded-t-md hover:bg-slate-100 dark:hover:bg-slate-800">
                          <div className="relative w-full h-full flex items-end">
                            <div 
                              className="w-full bg-blue-400 dark:bg-blue-600 rounded-t-md group-hover:bg-blue-500 transition-all duration-300"
                              style={{ height: `${(item.hours / maxDailyHours) * 100}%` }}
                              role="progressbar"
                              aria-valuenow={item.hours}
                              aria-valuemin={0}
                              aria-valuemax={maxDailyHours}
                            >
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block px-2 py-1 bg-gray-800 text-white text-xs rounded-md">
                                {item.hours.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        <span className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">{item.day}</span>
                      </div>
                    ))}
                </div>
            </StatsCard>
        </div>
    </div>
  );
};

export default Progression;