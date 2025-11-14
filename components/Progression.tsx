

import React, { useMemo, useState, useEffect } from 'react';
import { SmartPlan, ActivityType, DayOfWeek, TrackedSession, UserDetails } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useColorTheme } from '../contexts/ColorThemeContext';
import { timeToMinutes } from '../lib/utils';
import { generateWeeklyProgressComment } from '../services/geminiService';
import { GeminiIcon } from './icons/GeminiIcon';

interface ProgressionProps {
  plan: SmartPlan | null;
  trackedData: TrackedSession[];
  userDetails: UserDetails | null;
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
    const { t } = useLanguage();
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-48 w-48 rounded-full bg-gray-200 dark:bg-gray-700"><span className="text-gray-500">{t('progression.noData')}</span></div>;

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
                        style={{ stroke: item.color }}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        aria-label={`${item.type}: ${((item.value / total) * 100).toFixed(1)}%`}
                    />
                );
            })}
        </svg>
    );
};

const Progression: React.FC<ProgressionProps> = ({ plan, trackedData, userDetails }) => {
  const { t } = useLanguage();
  const { colorTheme } = useColorTheme();
  const [chartColors, setChartColors] = useState({ study: '', lecture: '', agenda: '', break: '', free: '' });
  const [weeklyComment, setWeeklyComment] = useState<string>('');
  const [isCommentLoading, setIsCommentLoading] = useState<boolean>(true);
  
  useEffect(() => {
    // This utility function creates a temporary DOM element with a given Tailwind class,
    // gets its computed background color, and then removes the element.
    // This is a reliable way to get the actual color value that Chart.js or other libraries can use.
    const getTailwindColor = (className: string): string => {
        const el = document.createElement('div');
        el.className = className;
        el.style.display = 'none'; // Keep it hidden
        document.body.appendChild(el);
        const color = window.getComputedStyle(el).backgroundColor;
        document.body.removeChild(el);
        return color;
    };

    // Use the utility to get the real, computed colors for our chart.
    const colors = {
      study: getTailwindColor('bg-study'),
      lecture: getTailwindColor('bg-lecture'),
      agenda: getTailwindColor('bg-agenda'),
      break: getTailwindColor('bg-break'),
      free: getTailwindColor('bg-free')
    };
    setChartColors(colors);
  }, [colorTheme]); // Rerun this effect whenever the color theme changes.


  const stats = useMemo(() => {
    if (!plan) return null;

    const totals = { study: 0, lecture: 0, agenda: 0, break: 0, free: 0 };
    const studyBySubject = new Map<string, number>();
    const dailyTotals = new Map<string, number>();

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
    
    // Process tracked data for the current week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Adjust so Monday is 0 and Sunday is 6
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - diffToMonday);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999); // Include all of Sunday

    const weeklyTrackedData = trackedData.filter(session => {
        // The date string is 'YYYY-MM-DD'. A robust way to parse is to split and construct.
        const parts = session.date.split('-').map(Number);
        if (parts.length !== 3) return false;
        const [year, month, day] = parts;
        // The month is 0-indexed in the Date constructor, so we subtract 1.
        const sessionDate = new Date(year, month - 1, day);
        return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
    });

    const trackedStudyBySubject = new Map<string, number>();
    weeklyTrackedData.forEach(session => {
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
        { type: t('progression.activity.study'), value: totals.study, color: chartColors.study, legendColor: 'bg-study' },
        { type: t('progression.activity.lecture'), value: totals.lecture, color: chartColors.lecture, legendColor: 'bg-lecture' },
        { type: t('progression.activity.agenda'), value: totals.agenda, color: chartColors.agenda, legendColor: 'bg-agenda' },
        { type: t('progression.activity.break'), value: totals.break, color: chartColors.break, legendColor: 'bg-break' },
        { type: t('progression.activity.free'), value: totals.free, color: chartColors.free, legendColor: 'bg-free' },
      ],
      trackedVsScheduled,
    };
  }, [plan, trackedData, chartColors, t]);

  useEffect(() => {
    if (stats?.trackedVsScheduled && userDetails) {
      const hasTrackedData = stats.trackedVsScheduled.some(item => item.trackedHours > 0);
      
      if (hasTrackedData) {
        setIsCommentLoading(true);
        generateWeeklyProgressComment(userDetails, stats.trackedVsScheduled)
          .then(comment => {
            setWeeklyComment(comment);
          })
          .catch(error => {
            console.error("Failed to generate weekly comment:", error);
            setWeeklyComment(''); // Or some error message
          })
          .finally(() => {
            setIsCommentLoading(false);
          });
      } else {
        setWeeklyComment('');
        setIsCommentLoading(false);
      }
    } else {
        setIsCommentLoading(false);
    }
  }, [stats?.trackedVsScheduled, userDetails]);

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
       
       <StatsCard title={t('progression.weeklyInsight.title')}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light rounded-full p-3">
             <GeminiIcon className="w-6 h-6" />
          </div>
          <div>
            {isCommentLoading ? (
              <p className="text-gray-500 dark:text-gray-400 italic">{t('progression.weeklyInsight.loading')}</p>
            ) : weeklyComment ? (
              <p className="text-gray-700 dark:text-gray-300">{weeklyComment}</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">{t('progression.weeklyInsight.noData')}</p>
            )}
          </div>
        </div>
      </StatsCard>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatsCard title={t('progression.weeklyOverview')} className="lg:col-span-1">
                <div className="space-y-4">
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalStudy')}</p><p className="font-bold text-2xl text-study">{stats.totalHours.study}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalLecture')}</p><p className="font-bold text-lg text-lecture">{stats.totalHours.lecture}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.personalAgenda')}</p><p className="font-bold text-lg text-agenda">{stats.totalHours.agenda}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalBreak')}</p><p className="font-bold text-lg text-break">{stats.totalHours.break}h</p></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">{t('progression.totalFree')}</p><p className="font-bold text-lg text-free">{stats.totalHours.free}h</p></div>
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
                                    <div className="bg-study/30 h-4 rounded-full" style={{ width: `${(item.scheduledHours / Math.max(item.scheduledHours, item.trackedHours, 1)) * 100}%` }}></div>
                                    <div className="bg-green-500 h-4 rounded-full absolute top-0 left-0" style={{ width: `${(item.trackedHours / Math.max(item.scheduledHours, item.trackedHours, 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                         <div className="flex items-center justify-end space-x-4 text-xs pt-2">
                            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-green-500 mr-1.5"></span>{t('progression.legend.tracked')}</div>
                            <div className="flex items-center"><span className="w-3 h-3 rounded-sm bg-study/30 mr-1.5"></span>{t('progression.legend.scheduled')}</div>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('progression.noGoals')}</p>
                )}
            </StatsCard>
            <StatsCard title={t('progression.dailyScheduled')}>
                 <div className="flex justify-between items-end h-56 space-x-2 md:space-x-4" aria-label={t('progression.dailyChartLabel')}>
                    {stats.dailyHours.map(item => (
                      <div key={item.day} className="flex-1 flex flex-col items-center group transition-colors duration-300 p-1 rounded-t-md hover:bg-slate-100 dark:hover:bg-slate-800">
                          <div className="relative w-full h-full flex items-end">
                            <div 
                              className="w-full bg-primary rounded-t-md group-hover:bg-primary-dark transition-all duration-300"
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