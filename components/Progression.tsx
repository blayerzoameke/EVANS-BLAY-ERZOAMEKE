
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SmartPlan, TrackedSession, UserDetails, ActivityType, PlanSlot } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { timeToMinutes } from '../lib/utils';
import { generateWeeklyProgressComment } from '../services/geminiService';
import { storageService } from '../services/authService';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ClockIcon } from './icons/ClockIcon';
import { GeminiIcon } from './icons/GeminiIcon';
import { PieChartIcon } from './icons/PieChartIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { AwardIcon } from './icons/AwardIcon';

declare global {
    interface Window {
        Chart: any;
    }
}

interface ProgressionProps {
  plan: SmartPlan | null;
  trackedData: TrackedSession[];
  userDetails: UserDetails | null;
}

interface WeeklySnapshot {
  weekId: string;
  startDate: string;
  totalTracked: number;
  totalScheduled: number;
  subjectBreakdown: Record<string, number>;
  dailyTrend: { day: string; hours: number }[];
  aiComment: string;
  achievementScore: number;
}

const ProgressBar: React.FC<{ progress: number; colorClass: string; label?: string; subLabel?: string }> = ({ progress, colorClass, label, subLabel }) => (
    <div className="w-full">
        <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">{label}</span>
            <span className="text-[10px] font-bold text-gray-500">{subLabel}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700/40 rounded-full h-3.5 overflow-hidden shadow-inner border border-transparent dark:border-gray-600/20">
            <div 
                className={`h-full ${colorClass} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.2)]`}
                style={{ width: `${Math.min(100, progress)}%` }}
            />
        </div>
    </div>
);

const HistoryCard: React.FC<{ snapshot: WeeklySnapshot }> = ({ snapshot }) => {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (!canvasRef.current || !window.Chart) return;
        
        if (chartRef.current) chartRef.current.destroy();
        
        const ctx = canvasRef.current.getContext('2d');
        const isDark = document.documentElement.classList.contains('dark');
        
        chartRef.current = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: snapshot.dailyTrend.map(d => d.day),
                datasets: [{
                    label: 'Hours',
                    data: snapshot.dailyTrend.map(d => d.hours),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { 
                        display: false,
                        beginAtZero: true
                    }
                }
            }
        });
        
        return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [snapshot]);

    return (
        <div className="group bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden transition-all hover:shadow-2xl">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 border-b dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest">
                        Week of {new Date(snapshot.startDate).toLocaleDateString()}
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{(snapshot.totalTracked / 60).toFixed(1)}h</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Studied</p>
                    </div>
                </div>
                <div className="h-20 w-full mb-4">
                    <canvas ref={canvasRef}></canvas>
                </div>
                <ProgressBar progress={snapshot.achievementScore} colorClass="bg-gradient-to-r from-emerald-500 to-teal-400" label="Achievement" subLabel={`${snapshot.achievementScore}%`} />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <GeminiIcon className="w-4 h-4" />
                        <h4 className="text-xs font-black uppercase tracking-widest">Coach Recommendation</h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 italic leading-relaxed">
                        "{snapshot.aiComment || "Blay's insight for this period was not captured."}"
                    </p>
                </div>
                <div className="mt-6 pt-6 border-t dark:border-gray-700">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Top Disciplines</h5>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(snapshot.subjectBreakdown)
                            .sort(([,a], [,b]) => (b as number) - (a as number))
                            .slice(0, 2)
                            .map(([subject, mins]) => (
                                <span key={subject} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                    {subject} ({((mins as number)/60).toFixed(1)}h)
                                </span>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Progression: React.FC<ProgressionProps> = ({ plan, trackedData, userDetails }) => {
  const { t } = useLanguage();
  const [history, setHistory] = useState<WeeklySnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [aiComment, setAiComment] = useState<string>('');
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);
  const chartRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stats = useMemo(() => {
    if (!plan) return null;
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const totals: Record<string, number> = { study: 0, lecture: 0, agenda: 0, break: 0, free: 0 };
    const subjectScheduled: Record<string, number> = {};
    const subjectTracked: Record<string, number> = {};
    const dailyTracked: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    plan.forEach(day => {
      day.slots.forEach(slot => {
        const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const type = slot.type.toLowerCase();
        if (totals[type] !== undefined) totals[type] += duration;
        
        if (type === 'study' || type === 'lecture') {
            subjectScheduled[slot.activity] = (subjectScheduled[slot.activity] || 0) + duration;
        }
      });
    });

    const thisWeekTracked = trackedData.filter(s => new Date(s.date) >= startOfWeek);
    let totalTrackedMinutes = 0;
    thisWeekTracked.forEach(s => {
        totalTrackedMinutes += s.durationMinutes;
        subjectTracked[s.subject] = (subjectTracked[s.subject] || 0) + s.durationMinutes;
        const dayKey = daysMap[new Date(s.date).getDay()];
        if (dailyTracked[dayKey] !== undefined) dailyTracked[dayKey] += s.durationMinutes;
    });

    const totalMinutes = Object.values(totals).reduce((a: number, b: number) => a + b, 0);
    const totalScheduledStudy = totals.study || 1;
    const overallAchievement = Math.round((totalTrackedMinutes / totalScheduledStudy) * 100);

    const activityBreakdown = Object.entries(totals).map(([type, mins]) => ({
        type,
        minutes: mins,
        percentage: totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0
    }));

    return {
      totals,
      totalTrackedMinutes,
      totalScheduledMinutes: totalMinutes,
      totalTrackedHours: (totalTrackedMinutes / 60).toFixed(1),
      activityBreakdown,
      overallAchievement,
      dailyData: Object.entries(dailyTracked).map(([day, mins]) => ({ day, hours: mins / 60 })),
      subjectComparison: Object.keys(subjectScheduled).map(subject => ({
          subject,
          scheduled: (subjectScheduled[subject] / 60).toFixed(1),
          tracked: ((subjectTracked[subject] || 0) / 60).toFixed(1),
          percentage: Math.min(100, Math.round(((subjectTracked[subject] || 0) / subjectScheduled[subject]) * 100))
      })),
      subjectTrackedRaw: subjectTracked
    };
  }, [plan, trackedData]);

  useEffect(() => {
    if (!canvasRef.current || !stats || activeTab !== 'current' || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext('2d');
    const colors: Record<string, string> = { study: '#2563eb', lecture: '#7c3aed', agenda: '#ea580c', break: '#16a34a', free: '#4b5563' };
    chartRef.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: stats.activityBreakdown.map(a => a.type),
            datasets: [{
                data: stats.activityBreakdown.map(a => a.minutes),
                backgroundColor: stats.activityBreakdown.map(a => colors[a.type] || '#cbd5e1'),
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { display: false } }
        }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [stats, activeTab]);

  useEffect(() => {
    const loadHistory = async () => {
        const savedHistory = await storageService.loadItem<WeeklySnapshot[]>('progression_history');
        if (savedHistory) setHistory(savedHistory);
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (!plan || !userDetails || !trackedData.length) return;
    const generateComment = async () => {
      setIsGeneratingComment(true);
      try {
          const weeklyData = stats?.subjectComparison.map(s => ({
              subject: s.subject,
              scheduledHours: parseFloat(s.scheduled),
              trackedHours: parseFloat(s.tracked)
          })) || [];
          const comment = await generateWeeklyProgressComment(userDetails, weeklyData);
          setAiComment(comment);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingComment(false);
      }
    };
    generateComment();
  }, [plan, userDetails, trackedData, stats]);

  const archiveCurrentWeek = async () => {
    if (!stats || !userDetails) return;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const weekId = startOfWeek.toISOString().split('T')[0];

    if (history.some(h => h.weekId === weekId)) {
        alert("This week's progress is already archived.");
        return;
    }

    const snapshot: WeeklySnapshot = {
        weekId,
        startDate: startOfWeek.toISOString(),
        totalTracked: stats.totalTrackedMinutes,
        totalScheduled: stats.totalScheduledMinutes,
        subjectBreakdown: stats.subjectTrackedRaw,
        dailyTrend: stats.dailyData,
        aiComment: aiComment,
        achievementScore: stats.overallAchievement
    };

    const newHistory = [snapshot, ...history];
    setHistory(newHistory);
    await storageService.saveItem('progression_history', newHistory);
    alert("Weekly progress archived!");
  };

  if (!plan) {
    return (
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-16 text-center border-2 border-gray-100 dark:border-gray-700">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <ChartBarIcon className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">{t('progression.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-lg font-medium">{t('progression.noPlan')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{t('progression.title')}</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Analyze your habits and view academic milestones.</p>
            </div>
            <div className="flex bg-gray-200 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner w-full md:w-auto">
                <button onClick={() => setActiveTab('current')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'current' ? 'bg-white dark:bg-gray-700 shadow-lg text-primary' : 'text-gray-500'}`}>Current Week</button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white dark:bg-gray-700 shadow-lg text-primary' : 'text-gray-500'}`}>Archived History</button>
            </div>
        </div>

        {activeTab === 'current' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 h-full flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-8 text-primary">
                        <ClockIcon className="w-5 h-5" />
                        <h3 className="text-lg font-black uppercase tracking-tight">{t('progression.weeklyOverview')}</h3>
                    </div>
                    <div className="bg-gray-900 rounded-2xl p-6 mb-8 text-white">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-light mb-1">{t('progression.totalStudy').toUpperCase()}</p>
                        <p className="text-5xl font-black tracking-tighter">{(stats!.totals.study / 60).toFixed(1)}h</p>
                    </div>
                    <div className="grid grid-cols-2 gap-y-6">
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('progression.totalLecture')}</p><p className="text-xl font-black text-purple-600">{(stats!.totals.lecture / 60).toFixed(1)}h</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('progression.personalAgenda')}</p><p className="text-xl font-black text-orange-600">{(stats!.totals.agenda / 60).toFixed(1)}h</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('progression.totalBreak')}</p><p className="text-xl font-black text-green-600">{(stats!.totals.break / 60).toFixed(1)}h</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('progression.totalFree')}</p><p className="text-xl font-black text-gray-500">{(stats!.totals.free / 60).toFixed(1)}h</p></div>
                    </div>
                </div>

                <div className="lg:col-span-8 bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700 h-full">
                    <div className="flex items-center gap-3 mb-8 text-primary"><PieChartIcon className="w-5 h-5" /><h3 className="text-lg font-black uppercase tracking-tight">{t('progression.activityBreakdown')}</h3></div>
                    <div className="flex flex-col md:flex-row items-center gap-12">
                        <div className="relative w-64 h-64 flex-shrink-0">
                            <canvas ref={canvasRef}></canvas>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <p className="text-xs font-black text-gray-400 uppercase">Achievement</p>
                                    <p className="text-3xl font-black text-gray-900 dark:text-white">{stats?.overallAchievement}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 space-y-4 w-full">
                            {stats!.activityBreakdown.map((activity, idx) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${activity.type === 'study' ? 'bg-blue-600' : activity.type === 'lecture' ? 'bg-purple-600' : activity.type === 'agenda' ? 'bg-orange-600' : activity.type === 'break' ? 'bg-green-600' : 'bg-gray-600'}`} />
                                        <span className="font-bold text-gray-700 dark:text-gray-300 capitalize">{t(`progression.activity.${activity.type}` as any)}</span>
                                    </div>
                                    <span className="font-black text-gray-900 dark:text-white">{activity.percentage}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-12 bg-gradient-to-br from-primary to-primary-dark rounded-[2.5rem] p-1 shadow-2xl">
                    <div className="bg-white dark:bg-gray-900 rounded-[2.3rem] p-8 md:p-12 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none"><AwardIcon className="w-64 h-64 text-white" /></div>
                         <div className="relative z-10">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary"><GeminiIcon className="w-7 h-7 animate-pulse" /></div>
                                    <div><h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Academic Coach</h3><p className="text-sm text-gray-500 font-bold">Smart insight for your week</p></div>
                                </div>
                                <button onClick={archiveCurrentWeek} className="px-6 py-3 bg-primary text-primary-text font-black rounded-2xl shadow-xl hover:bg-primary-dark transition-all text-sm uppercase tracking-widest">Archive Week</button>
                            </div>
                            <div className="prose prose-lg dark:prose-invert max-w-none">
                                <p className="text-gray-700 dark:text-gray-200 font-medium leading-relaxed italic border-l-4 border-primary pl-6 py-2 bg-primary/5 rounded-r-xl">
                                    "{aiComment || "Track study sessions to unlock coaching feedback."}"
                                </p>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-10 text-primary"><ChartBarIcon className="w-5 h-5" /><h3 className="text-lg font-black uppercase tracking-tight">{t('progression.dailyScheduled')}</h3></div>
                        <div className="flex items-end justify-between h-40 gap-2">
                            {stats!.dailyData.map((d, i) => {
                                const maxDailyHours = Math.max(...stats!.dailyData.map(x => x.hours), 1);
                                const fillPercentage = (d.hours / maxDailyHours) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                        <div className="relative w-full max-w-[24px] h-32">
                                            <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden border border-transparent dark:border-gray-600/30">
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-sky-400 transition-all duration-1000 ease-out" style={{ height: `${fillPercentage}%` }} />
                                            </div>
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20 font-bold">{d.hours.toFixed(1)}h</div>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase">{d.day}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-10 text-primary"><TrendingUpIcon className="w-5 h-5" /><h3 className="text-lg font-black uppercase tracking-tight">{t('progression.trackedVsScheduled')}</h3></div>
                        <div className="space-y-6 max-h-52 overflow-y-auto pr-2 scrollbar-hide">
                            {stats!.subjectComparison.length > 0 ? (
                                stats!.subjectComparison.map((s, idx) => (
                                    <ProgressBar 
                                        key={idx}
                                        label={s.subject} 
                                        subLabel={`${s.tracked}h / ${s.scheduled}h`} 
                                        progress={s.percentage}
                                        colorClass="bg-gradient-to-r from-emerald-500 to-teal-400"
                                    />
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-10 font-medium italic">{t('progression.noGoals')}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {history.length > 0 ? (
                    history.map((snapshot) => (
                        <HistoryCard key={snapshot.weekId} snapshot={snapshot} />
                    ))
                ) : (
                    <div className="col-span-full py-24 text-center bg-white dark:bg-gray-800 rounded-[3rem] shadow-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <HistoryIcon className="w-20 h-20 text-gray-200 dark:text-gray-700 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Academic History</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto font-medium">Archive your current week to begin building your historical study performance record with weekly activity graphs.</p>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};
export default Progression;
