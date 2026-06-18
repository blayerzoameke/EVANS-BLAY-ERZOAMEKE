import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { SmartPlan, PlanSlot, Toast, DayPlan } from '../types.ts';
import { DayOfWeek, ActivityType } from '../types.ts';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { PlusIcon } from './icons/PlusIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import TimeInput from './TimeInput.tsx';
import { DAYS_OF_WEEK } from '../constants.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { timeToMinutes, minutesToTime } from '../lib/utils.ts';

interface EditTimetableModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: SmartPlan;
    setPlan: (plan: SmartPlan) => void;
    addToast: (message: string, type: Toast['type']) => void;
}

type EditablePlanSlot = PlanSlot & { tempId: string };
type EditableDayPlan = Omit<DayPlan, 'slots'> & { slots: EditablePlanSlot[] };
type EditableSmartPlan = EditableDayPlan[];

interface NewSlotDraft {
    activity: string;
    startTime: string;
    endTime: string;
    type: ActivityType;
}

interface OverlapConflict {
    day: DayOfWeek;
    a: string;
    b: string;
    aTime: string;
    bTime: string;
}

const detectOverlaps = (plan: EditableSmartPlan): OverlapConflict[] => {
    const conflicts: OverlapConflict[] = [];
    for (const dayPlan of plan) {
        const slots = [...dayPlan.slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        for (let i = 0; i < slots.length - 1; i++) {
            const curr = slots[i];
            const next = slots[i + 1];
            if (timeToMinutes(curr.endTime) > timeToMinutes(next.startTime)) {
                conflicts.push({
                    day: dayPlan.day as DayOfWeek,
                    a: curr.activity,
                    b: next.activity,
                    aTime: `${curr.startTime} – ${curr.endTime}`,
                    bTime: `${next.startTime} – ${next.endTime}`,
                });
            }
        }
    }
    return conflicts;
};

const EditTimetableModal: React.FC<EditTimetableModalProps> = ({ isOpen, onClose, plan, setPlan, addToast }) => {
    const { t } = useLanguage();
    const [editedPlan, setEditedPlan] = useState<EditableSmartPlan>([]);
    const [slotToDelete, setSlotToDelete] = useState<{ day: DayOfWeek, tempId: string } | null>(null);
    const [drafts, setDrafts] = useState<Partial<Record<DayOfWeek, NewSlotDraft>>>({});
    const [overlapConflicts, setOverlapConflicts] = useState<OverlapConflict[]>([]);
    const [changedDays, setChangedDays] = useState<Set<DayOfWeek>>(new Set());
    const draftRefs = useRef<Partial<Record<DayOfWeek, HTMLDivElement | null>>>({});

    useEffect(() => {
        if (isOpen) {
            const newPlan: EditableSmartPlan = JSON.parse(JSON.stringify(plan));
            newPlan.forEach((dayPlan) => {
                dayPlan.slots.forEach((slot: any, index: number) => {
                    slot.tempId = `${dayPlan.day}-${index}-${Math.random()}`;
                });
                dayPlan.slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            });
            setEditedPlan(newPlan);
            setDrafts({});
            setOverlapConflicts([]);
            setChangedDays(new Set());
        }
    }, [isOpen, plan]);

    if (!isOpen) return null;

    // ─────────────────────────────────────────────────────────────
    //  KEY FIX: All state mutations are computed OUTSIDE of any
    //  setState updater function. We never call setState inside
    //  another setState callback — that triggers the React warning.
    //  Pattern: compute → setA(result) → setB(sideEffect)
    // ─────────────────────────────────────────────────────────────

    const handleSlotChange = (day: DayOfWeek, tempId: string, field: keyof PlanSlot, value: any) => {
        // Compute the new plan synchronously from current editedPlan
        const newPlan = editedPlan.map(dayPlan => {
            if (dayPlan.day !== day) return dayPlan;
            let newSlots = dayPlan.slots.map(slot =>
                slot.tempId === tempId ? { ...slot, [field]: value } : slot
            );
            if (field === 'startTime') {
                newSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            }
            return { ...dayPlan, slots: newSlots };
        });
        // Set both states at top level — no nesting
        setEditedPlan(newPlan);
        setOverlapConflicts(detectOverlaps(newPlan));
        // Mark this day as having unsaved changes
        setChangedDays(prev => new Set([...prev, day]));
    };

    const openDraft = (day: DayOfWeek) => {
        setDrafts(prev => ({
            ...prev,
            [day]: { activity: '', startTime: '12:00 PM', endTime: '01:00 PM', type: ActivityType.STUDY },
        }));
        setTimeout(() => {
            draftRefs.current[day]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
    };

    const updateDraft = (day: DayOfWeek, field: keyof NewSlotDraft, value: string) => {
        setDrafts(prev => ({ ...prev, [day]: { ...prev[day]!, [field]: value } }));
    };

    const commitDraft = (day: DayOfWeek) => {
        const draft = drafts[day];
        if (!draft) return;

        if (!draft.activity.trim()) {
            addToast('Please enter an activity name.', 'warning');
            return;
        }
        const startMins = timeToMinutes(draft.startTime);
        const endMins = timeToMinutes(draft.endTime);
        if (endMins <= startMins) {
            addToast('End time must be after start time.', 'warning');
            return;
        }

        const newSlot: EditablePlanSlot = {
            activity: draft.activity.trim(),
            startTime: draft.startTime,
            endTime: draft.endTime,
            type: draft.type,
            isLocked: false,
            tempId: `new-${Date.now()}`,
        };

        // Compute new plan from current editedPlan directly (no updater fn)
        const dayExists = editedPlan.some(p => p.day === day);
        let newPlan: EditableSmartPlan;

        if (dayExists) {
            newPlan = editedPlan.map(dayPlan => {
                if (dayPlan.day !== day) return dayPlan;
                const updatedSlots = [...dayPlan.slots, newSlot]
                    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                return { ...dayPlan, slots: updatedSlots };
            });
        } else {
            const newDayPlan = { day, slots: [newSlot] };
            newPlan = [...editedPlan, newDayPlan]
                .sort((a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day));
        }

        const conflicts = detectOverlaps(newPlan);

        // All top-level setState calls — never nested inside each other
        setEditedPlan(newPlan);
        setOverlapConflicts(conflicts);
        setDrafts(prev => { const next = { ...prev }; delete next[day]; return next; });

        const myConflicts = conflicts.filter(
            c => c.day === day && (c.a === newSlot.activity || c.b === newSlot.activity)
        );
        if (myConflicts.length > 0) {
            const c = myConflicts[0];
            addToast(`⚠️ Overlap on ${day}: "${c.a}" (${c.aTime}) overlaps "${c.b}" (${c.bTime}). Please fix the times.`, 'warning');
        } else {
            addToast(`✅ "${newSlot.activity}" added to ${day}!`, 'success');
        }
    };

    const cancelDraft = (day: DayOfWeek) => {
        setDrafts(prev => { const next = { ...prev }; delete next[day]; return next; });
    };

    const confirmRemoveSlot = () => {
        if (!slotToDelete) return;
        const { day, tempId } = slotToDelete;
        const newPlan = editedPlan.map(dayPlan => {
            if (dayPlan.day !== day) return dayPlan;
            return { ...dayPlan, slots: dayPlan.slots.filter(s => s.tempId !== tempId) };
        });
        setEditedPlan(newPlan);
        setOverlapConflicts(detectOverlaps(newPlan));
        setSlotToDelete(null);
    };

    const handleSaveChanges = () => {
        if (overlapConflicts.length > 0) {
            const c = overlapConflicts[0];
            addToast(`⚠️ Fix overlap on ${c.day}: "${c.a}" and "${c.b}" have conflicting times before saving.`, 'warning');
            return;
        }
        const finalPlan: SmartPlan = editedPlan.map(dayPlan => ({
            day: dayPlan.day,
            slots: dayPlan.slots.map(({ tempId, ...slot }) => slot),
        }));
        setPlan(finalPlan);
        addToast(t('toasts.timetableUpdated'), 'success');
        onClose();
    };

    const autoFixOverlaps = () => {
        const newPlan = editedPlan.map(dayPlan => {
            const lockedSlots = dayPlan.slots
                .filter(s => s.isLocked)
                .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            const unlockedSlots = dayPlan.slots
                .filter(s => !s.isLocked)
                .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            const placedSlots = [...lockedSlots];

            const fixedUnlocked = unlockedSlots.map(slot => {
                let startMins = timeToMinutes(slot.startTime);
                let duration = timeToMinutes(slot.endTime) - startMins;
                if (duration <= 0) duration = 60;

                let guard = 0;
                while (guard < 96) {
                    guard++;
                    const endMins = startMins + duration;
                    const overlap = placedSlots.find(p => {
                        const pStart = timeToMinutes(p.startTime);
                        const pEnd = timeToMinutes(p.endTime);
                        return startMins < pEnd && endMins > pStart;
                    });
                    if (!overlap) break;
                    startMins = Math.max(startMins + 15, timeToMinutes(overlap.endTime));
                }

                const fixed = {
                    ...slot,
                    startTime: minutesToTime(startMins),
                    endTime: minutesToTime(startMins + duration),
                };
                placedSlots.push(fixed);
                placedSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                return fixed;
            });

            return {
                ...dayPlan,
                slots: [...lockedSlots, ...fixedUnlocked]
                    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
            };
        });

        const remaining = detectOverlaps(newPlan);

        // Top-level — no nesting
        setEditedPlan(newPlan);
        setOverlapConflicts(remaining);

        if (remaining.length > 0) {
            addToast('Some overlaps remain (likely between locked slots). Please fix manually.', 'warning');
        } else {
            addToast('✅ All overlaps fixed!', 'success');
        }
    };

    const inputClasses = "block w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md shadow-inner sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400";
    const selectBaseClasses = "block w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-md shadow-inner sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed appearance-none";

    const activityTypeClasses: Record<ActivityType, string> = {
        [ActivityType.LECTURE]: 'bg-lecture text-white',
        [ActivityType.STUDY]:   'bg-study text-white',
        [ActivityType.AGENDA]:  'bg-agenda text-white',
        [ActivityType.BREAK]:   'bg-break text-white',
        [ActivityType.FREE]:    'bg-free text-white',
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black bg-opacity-60 flex items-start sm:items-center justify-center z-[1000] p-0 sm:p-4 no-print"
                onClick={onClose}
            >
                <div
                    className="bg-white dark:bg-gray-900 rounded-none sm:rounded-xl shadow-2xl w-full max-w-5xl flex flex-col h-dvh sm:h-[92vh] max-h-dvh sm:max-h-[92vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* ── Header with back button ── */}
                    <div 
                        className="flex items-center gap-3 px-4 pb-3 border-b dark:border-gray-700"
                        style={{
                            paddingTop: 'max(12px, calc(env(safe-area-inset-top) + 12px))'
                        }}
                    >
                        {/* ← Go Back button — always visible, especially important on mobile */}
                        <button
                            onClick={onClose}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm transition-colors flex-shrink-0"
                            title="Go back to dashboard"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            <span className="inline">Go Back</span>
                        </button>

                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">
                                {t('editTimetable.title')}
                            </h2>
                            {overlapConflicts.length > 0 && (
                                <p className="text-xs text-red-500 font-semibold">
                                    ⚠️ {overlapConflicts.length} overlap{overlapConflicts.length > 1 ? 's' : ''} — fix before saving
                                </p>
                            )}
                        </div>

                        {/* X close button — desktop redundancy */}
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0 hidden sm:flex">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* ── Overlap banner ── */}
                    {overlapConflicts.length > 0 && (
                        <div className="mx-5 mt-3 rounded-xl overflow-hidden border border-red-200 dark:border-red-700/50 flex-shrink-0">
                            <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2.5 flex items-center justify-between border-b border-red-100 dark:border-red-700/40">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">⚠️</span>
                                    <span className="text-sm font-bold text-red-700 dark:text-red-300">
                                        Time Conflicts Detected — Fix before saving
                                    </span>
                                </div>
                                <button
                                    onClick={autoFixOverlaps}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                                >
                                    Auto-Fix Overlaps
                                </button>
                            </div>
                            <div className="divide-y divide-red-100 dark:divide-red-800/30 max-h-28 overflow-y-auto">
                                {overlapConflicts.map((c, i) => (
                                    <div key={i} className="bg-red-50/60 dark:bg-red-900/10 px-4 py-2 flex items-start gap-3">
                                        <span className="text-xs font-bold text-red-500 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                                            {c.day}
                                        </span>
                                        <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                                            <strong>"{c.a}"</strong> <span className="text-red-400">({c.aTime})</span>
                                            {' '}overlaps with{' '}
                                            <strong>"{c.b}"</strong> <span className="text-red-400">({c.bTime})</span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Body ── */}
                    <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 text-sm rounded-r-lg">
                            <p><strong>{t('editTimetable.lockedInfo.title')}</strong></p>
                            <p>{t('editTimetable.lockedInfo.body')}</p>
                        </div>

                        {DAYS_OF_WEEK.map(day => {
                            const dayPlan = editedPlan.find(p => p.day === day);
                            const draft = drafts[day as DayOfWeek];
                            const dayHasOverlap = overlapConflicts.some(c => c.day === day);

                            return (
                                <div key={day}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-base font-bold text-gray-700 dark:text-gray-200">{day}</h3>
                                        {dayHasOverlap && (
                                            <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/40 px-2 py-0.5 rounded-full">
                                                ⚠️ overlap
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {(dayPlan?.slots?.length ?? 0) > 0 && (
                                            <div className="hidden sm:grid sm:grid-cols-[3fr_1.2fr_1.2fr_1.2fr_auto] gap-2 px-2 mb-1">
                                                {['Activity', 'Start', 'End', 'Type', ''].map((h, i) => (
                                                    <span key={i} className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</span>
                                                ))}
                                            </div>
                                        )}

                                        {dayPlan?.slots.map((slot) => {
                                            const isConflicted = overlapConflicts.some(
                                                c => c.day === day && (c.a === slot.activity || c.b === slot.activity)
                                            );
                                            return (
                                                <div
                                                    key={slot.tempId}
                                                    className={`grid grid-cols-1 sm:grid-cols-[3fr_1.2fr_1.2fr_1.2fr_auto] gap-2.5 sm:gap-2 items-stretch sm:items-center p-3 sm:p-2 rounded-xl sm:rounded-lg border transition-colors ${
                                                        isConflicted
                                                            ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                                                            : slot.isLocked
                                                            ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50'
                                                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                                                    }`}
                                                >
                                                    {/* Activity Column */}
                                                    <div className="relative">
                                                        <label className="block sm:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                                            Activity Name
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={slot.activity}
                                                                onChange={e => handleSlotChange(day as DayOfWeek, slot.tempId, 'activity', e.target.value)}
                                                                className={inputClasses + " truncate"}
                                                                disabled={slot.isLocked}
                                                                title={slot.activity}
                                                                style={{ minWidth: 0 }}
                                                                placeholder="e.g. algebra, lecture..."
                                                            />
                                                            {isConflicted && (
                                                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" title="Time overlap" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Start & End Times (grouped side-by-side on mobile, contents on desktop) */}
                                                    <div className="grid grid-cols-2 gap-2 sm:contents">
                                                        <div>
                                                            <label className="block sm:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                                                Start Time
                                                            </label>
                                                            <TimeInput value={slot.startTime} onChange={val => handleSlotChange(day as DayOfWeek, slot.tempId, 'startTime', val)} />
                                                        </div>
                                                        <div>
                                                            <label className="block sm:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                                                End Time
                                                            </label>
                                                            <TimeInput value={slot.endTime} onChange={val => handleSlotChange(day as DayOfWeek, slot.tempId, 'endTime', val)} />
                                                        </div>
                                                    </div>

                                                    {/* Activity Type Selection & Delete Button (grouped side-by-side on mobile, contents on desktop) */}
                                                    <div className="grid grid-cols-[1fr_auto] gap-2 items-end sm:contents">
                                                        <div>
                                                            <label className="block sm:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                                                Activity Type
                                                            </label>
                                                            <div className="relative">
                                                                <select
                                                                    value={slot.type}
                                                                    onChange={e => handleSlotChange(day as DayOfWeek, slot.tempId, 'type', e.target.value as ActivityType)}
                                                                    className={`${selectBaseClasses} ${activityTypeClasses[slot.type]} pr-8`}
                                                                    disabled={slot.isLocked}
                                                                >
                                                                    {Object.values(ActivityType).map(type => (
                                                                        <option key={type} value={type} className="bg-white dark:bg-gray-800 text-black dark:text-white">{type}</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-center w-10 h-10">
                                                            {slot.isLocked ? (
                                                                <span title={t('editTimetable.lockedTooltip')}>
                                                                    <LockIcon className="w-5 h-5 text-gray-400" />
                                                                </span>
                                                            ) : (
                                                                <button onClick={() => setSlotToDelete({ day: day as DayOfWeek, tempId: slot.tempId })} title={t('common.delete')}>
                                                                    <TrashIcon className="w-5 h-5 text-red-400 hover:text-red-600 transition-colors" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* ── Inline draft ── */}
                                        {/* ── Per-day Save/Cancel — appear as soon as user edits ── */}
                                        {changedDays.has(day as DayOfWeek) && !draft && (
                                            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800/40">
                                                <span className="text-xs text-indigo-500 dark:text-indigo-400 mr-auto font-medium">
                                                    ✎ Changes to {day}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        // Revert this day only
                                                        const original: EditableSmartPlan = JSON.parse(JSON.stringify(plan));
                                                        const origDay = original.find(d => d.day === day);
                                                        if (origDay) {
                                                            origDay.slots.forEach((s: any, i: number) => { s.tempId = `${day}-${i}-orig`; });
                                                        }
                                                        const reverted = editedPlan.map(d => d.day === day ? (origDay || d) : d);
                                                        setEditedPlan(reverted);
                                                        setOverlapConflicts(detectOverlaps(reverted));
                                                        setChangedDays(prev => { const next = new Set(prev); next.delete(day as DayOfWeek); return next; });
                                                    }}
                                                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    ✕ Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (overlapConflicts.some(c => c.day === day)) {
                                                            addToast(`⚠️ Fix overlaps in ${day} before saving`, 'warning');
                                                            return;
                                                        }
                                                        handleSaveChanges();
                                                        setChangedDays(new Set());
                                                    }}
                                                    className="px-3 py-1.5 text-sm font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm flex items-center gap-1"
                                                >
                                                    ✓ Save {day}
                                                </button>
                                            </div>
                                        )}

                                        {draft ? (
                                            <div
                                                ref={el => { draftRefs.current[day as DayOfWeek] = el; }}
                                                className="rounded-xl border-2 border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 overflow-hidden shadow-md"
                                                style={{ animation: 'slideDownFade 0.25s ease both' }}
                                            >
                                                <style>{`
                                                    @keyframes slideDownFade {
                                                        from { opacity:0; transform:translateY(-8px); }
                                                        to   { opacity:1; transform:translateY(0); }
                                                    }
                                                `}</style>
                                                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/40 border-b border-indigo-200 dark:border-indigo-700">
                                                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">✦ New Activity for {day}</span>
                                                    <span className="text-xs text-indigo-400 ml-1">Fill in the details, then click Done ✓</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr] gap-3 p-3">
                                                    <div>
                                                        <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1 block">Activity Name *</label>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={draft.activity}
                                                            onChange={e => updateDraft(day as DayOfWeek, 'activity', e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') commitDraft(day as DayOfWeek); if (e.key === 'Escape') cancelDraft(day as DayOfWeek); }}
                                                            placeholder="e.g. Algebra, Biology Lab…"
                                                            className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1 block">Start Time</label>
                                                        <TimeInput value={draft.startTime} onChange={val => updateDraft(day as DayOfWeek, 'startTime', val)} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1 block">End Time</label>
                                                        <TimeInput value={draft.endTime} onChange={val => updateDraft(day as DayOfWeek, 'endTime', val)} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1 block">Type</label>
                                                        <div className="relative">
                                                            <select
                                                                value={draft.type}
                                                                onChange={e => updateDraft(day as DayOfWeek, 'type', e.target.value)}
                                                                className={`${selectBaseClasses} ${activityTypeClasses[draft.type as ActivityType]} pr-8`}
                                                            >
                                                                {Object.values(ActivityType).map(type => (
                                                                    <option key={type} value={type} className="bg-white dark:bg-gray-800 text-black dark:text-white">{type}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between px-3 pb-3 gap-3">
                                                    <p className="text-xs text-indigo-400 dark:text-indigo-500">
                                                        Press <kbd className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-indigo-600 font-mono text-xs">Enter</kbd> to confirm,{' '}
                                                        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 font-mono text-xs">Esc</kbd> to cancel
                                                    </p>
                                                    <div className="flex gap-2 flex-shrink-0">
                                                        <button
                                                            onClick={() => cancelDraft(day as DayOfWeek)}
                                                            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => commitDraft(day as DayOfWeek)}
                                                            className="px-4 py-1.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30"
                                                        >
                                                            <span>✓</span> Done
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => openDraft(day as DayOfWeek)}
                                                className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-semibold pt-1 px-1 transition-colors group"
                                            >
                                                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/70 transition-colors flex-shrink-0">
                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                </span>
                                                {t('editTimetable.addActivity')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex justify-between items-center gap-3">
                        <div>
                            {overlapConflicts.length > 0 && (
                                <p className="text-xs text-red-500 font-semibold">
                                    ⚠️ Save blocked — {overlapConflicts.length} overlap{overlapConflicts.length > 1 ? 's' : ''} must be fixed first
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg font-medium transition-colors">
                                {t('common.cancel')}
                            </button>
                            {overlapConflicts.length > 0 ? (
                                <button
                                    onClick={autoFixOverlaps}
                                    className="px-5 py-2 rounded-lg font-bold transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm flex items-center gap-2"
                                >
                                    <span>⚠️</span> Auto-Fix Overlaps
                                </button>
                            ) : (
                                <button
                                    onClick={handleSaveChanges}
                                    className="px-5 py-2 rounded-lg font-bold transition-all bg-primary text-primary-text hover:opacity-90 shadow-sm"
                                >
                                    {t('common.save')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {slotToDelete && (
                <ConfirmationModal
                    isOpen={!!slotToDelete}
                    onClose={() => setSlotToDelete(null)}
                    onConfirm={confirmRemoveSlot}
                    title={t('editTimetable.deleteConfirm.title')}
                    message={t('editTimetable.deleteConfirm.body')}
                    confirmText={t('common.delete')}
                    confirmColor="red"
                />
            )}
        </>
    );
};

export default EditTimetableModal;