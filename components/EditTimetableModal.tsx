import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
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
import { timeToMinutes } from '../lib/utils.ts';

interface EditTimetableModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: SmartPlan;
    setPlan: (plan: SmartPlan) => void;
    addToast: (message: string, type: Toast['type']) => void;
}

// Define a local type that includes the transient tempId for stable keys
type EditablePlanSlot = PlanSlot & { tempId: string };
type EditableDayPlan = Omit<DayPlan, 'slots'> & { slots: EditablePlanSlot[] };
type EditableSmartPlan = EditableDayPlan[];


const EditTimetableModal: React.FC<EditTimetableModalProps> = ({ isOpen, onClose, plan, setPlan, addToast }) => {
    const { t } = useLanguage();
    const [editedPlan, setEditedPlan] = useState<EditableSmartPlan>([]);
    const [slotToDelete, setSlotToDelete] = useState<{ day: DayOfWeek, tempId: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Deep copy, add temporary unique IDs for keys, and sort each day's slots
            const newPlan = JSON.parse(JSON.stringify(plan));
            newPlan.forEach((dayPlan: DayPlan) => {
                dayPlan.slots.forEach((slot: any, index: number) => {
                    // Add a unique ID for stable rendering
                    slot.tempId = `${dayPlan.day}-${index}-${Math.random()}`;
                });
                dayPlan.slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            });
            setEditedPlan(newPlan);
        }
    }, [isOpen, plan]);

    if (!isOpen) {
        return null;
    }

    const handleSlotChange = (day: DayOfWeek, tempId: string, field: keyof PlanSlot, value: any) => {
        setEditedPlan(currentPlan => {
            const newPlan = currentPlan.map(dayPlan => {
                if (dayPlan.day === day) {
                    let newSlots = dayPlan.slots.map(slot => 
                        slot.tempId === tempId ? { ...slot, [field]: value } : slot
                    );

                    // Only re-sort the slots if the start time has changed.
                    if (field === 'startTime') {
                        newSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                    }
                    
                    return { ...dayPlan, slots: newSlots };
                }
                return dayPlan;
            });
            return newPlan;
        });
    };
    
    const addSlot = (day: DayOfWeek) => {
        setEditedPlan(currentPlan => {
            const newSlot: EditablePlanSlot = {
                activity: t('editTimetable.newActivity'),
                startTime: '12:00 PM',
                endTime: '01:00 PM',
                type: ActivityType.STUDY,
                isLocked: false,
                tempId: `new-${Date.now()}` // Unique ID for the new slot
            };

            const dayExists = currentPlan.some(p => p.day === day);
            let newPlan: EditableSmartPlan;

            if (dayExists) {
                newPlan = currentPlan.map(dayPlan => {
                    if (dayPlan.day === day) {
                        const updatedSlots = [...dayPlan.slots, newSlot]
                            .sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                        return { ...dayPlan, slots: updatedSlots };
                    }
                    return dayPlan;
                });
            } else {
                const newDayPlan = { day, slots: [newSlot] };
                newPlan = [...currentPlan, newDayPlan]
                    .sort((a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day));
            }
            return newPlan;
        });
    };

    const confirmRemoveSlot = () => {
        if (!slotToDelete) return;
        const { day, tempId } = slotToDelete;
        
        setEditedPlan(currentPlan => 
            currentPlan.map(dayPlan => {
                if (dayPlan.day === day) {
                    return { ...dayPlan, slots: dayPlan.slots.filter(s => s.tempId !== tempId) };
                }
                return dayPlan;
            })
        );
        
        setSlotToDelete(null);
    };

    const handleSaveChanges = () => {
        const finalPlan: SmartPlan = editedPlan.map(dayPlan => ({
            day: dayPlan.day,
            slots: dayPlan.slots.map(({ tempId, ...slot }) => slot)
        }));
        setPlan(finalPlan);
        addToast(t('toasts.timetableUpdated'), 'success');
        onClose();
    };

    const inputClasses = "block w-full px-2 py-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md shadow-inner sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed";
    const selectBaseClasses = "block w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-md shadow-inner sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed appearance-none";
    
    const activityTypeClasses: Record<ActivityType, string> = {
        [ActivityType.LECTURE]: 'bg-lecture text-white',
        [ActivityType.STUDY]: 'bg-study text-white',
        [ActivityType.AGENDA]: 'bg-agenda text-white',
        [ActivityType.BREAK]: 'bg-break text-white',
        [ActivityType.FREE]: 'bg-free text-white',
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 no-print" onClick={onClose}>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('editTimetable.title')}</h2>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                        <div className="p-3 mb-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 text-sm">
                            <p><strong>{t('editTimetable.lockedInfo.title')}</strong></p>
                            <p>{t('editTimetable.lockedInfo.body')}</p>
                        </div>
                        {DAYS_OF_WEEK.map(day => {
                            const dayPlan = editedPlan.find(p => p.day === day);
                            return (
                                <div key={day}>
                                    <h3 className="text-lg font-semibold mb-2">{day}</h3>
                                    <div className="space-y-2">
                                        {dayPlan?.slots.map((slot) => (
                                            <div key={slot.tempId} className={`grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-2 items-center p-2 rounded-md ${slot.isLocked ? 'bg-gray-100 dark:bg-gray-800/50' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                                <input type="text" value={slot.activity} onChange={e => handleSlotChange(day, slot.tempId, 'activity', e.target.value)} className={inputClasses} disabled={slot.isLocked} />
                                                <TimeInput value={slot.startTime} onChange={val => handleSlotChange(day, slot.tempId, 'startTime', val)} />
                                                <TimeInput value={slot.endTime} onChange={val => handleSlotChange(day, slot.tempId, 'endTime', val)} />
                                                <div className="relative">
                                                    <select value={slot.type} onChange={e => handleSlotChange(day, slot.tempId, 'type', e.target.value as ActivityType)} className={`${selectBaseClasses} ${activityTypeClasses[slot.type]} pr-8`} disabled={slot.isLocked}>
                                                        {Object.values(ActivityType).map(type => <option key={type} value={type} className="bg-white dark:bg-gray-800 text-black dark:text-white">{type}</option>)}
                                                    </select>
                                                    <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
                                                </div>
                                                <div className="flex items-center justify-center w-10 h-10">
                                                    {slot.isLocked ? (
                                                        <span title={t('editTimetable.lockedTooltip')}>
                                                            <LockIcon className="w-5 h-5 text-gray-400" />
                                                        </span>
                                                    ) : (
                                                        <button onClick={() => setSlotToDelete({ day, tempId: slot.tempId })} title={t('common.delete')}>
                                                            <TrashIcon className="w-5 h-5 text-red-500 hover:text-red-700" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => addSlot(day)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline pt-2">
                                            <PlusIcon className="w-4 h-4" /> {t('editTimetable.addActivity')}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
                        <button onClick={handleSaveChanges} className="px-4 py-2 bg-primary text-primary-text rounded-md">{t('common.save')}</button>
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