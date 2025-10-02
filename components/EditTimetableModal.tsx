import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import type { SmartPlan, PlanSlot, Toast } from '../types.ts';
import { DayOfWeek, ActivityType } from '../types.ts';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { PlusIcon } from './icons/PlusIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import TimeInput from './TimeInput.tsx';
import { DAYS_OF_WEEK } from '../constants.ts';
import ConfirmationModal from './ConfirmationModal.tsx';

interface EditTimetableModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: SmartPlan;
    setPlan: (plan: SmartPlan) => void;
    addToast: (message: string, type: Toast['type']) => void;
}

const EditTimetableModal: React.FC<EditTimetableModalProps> = ({ isOpen, onClose, plan, setPlan, addToast }) => {
    const { t } = useLanguage();
    const [editedPlan, setEditedPlan] = useState<SmartPlan>([]);
    const [slotToDelete, setSlotToDelete] = useState<{ day: DayOfWeek, index: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Deep copy of the plan to avoid direct mutation
            setEditedPlan(JSON.parse(JSON.stringify(plan)));
        }
    }, [isOpen, plan]);

    if (!isOpen) {
        return null;
    }

    const handleSlotChange = (day: DayOfWeek, slotIndex: number, field: keyof PlanSlot, value: any) => {
        const newPlan = [...editedPlan];
        const dayPlan = newPlan.find(p => p.day === day);
        if (dayPlan && dayPlan.slots[slotIndex]) {
            (dayPlan.slots[slotIndex] as any)[field] = value;
            setEditedPlan(newPlan);
        }
    };
    
    const addSlot = (day: DayOfWeek) => {
        const newPlan = [...editedPlan];
        const dayPlan = newPlan.find(p => p.day === day);
        const newSlot: PlanSlot = {
            activity: t('editTimetable.newActivity'),
            startTime: '12:00 PM',
            endTime: '01:00 PM',
            type: ActivityType.STUDY,
            isLocked: false, // User-added slots are never locked
        };
        if (dayPlan) {
            dayPlan.slots.push(newSlot);
            dayPlan.slots.sort((a, b) => a.startTime.localeCompare(b.startTime, undefined, { numeric: true }));
        } else {
             const newDayPlan = { day, slots: [newSlot] };
             newPlan.push(newDayPlan);
             // You might want to sort the days as well if they are not guaranteed to be in order
        }
        setEditedPlan(newPlan);
    };

    const confirmRemoveSlot = () => {
        if (!slotToDelete) return;
        const { day, index } = slotToDelete;
        const newPlan = [...editedPlan];
        const dayPlan = newPlan.find(p => p.day === day);
        if (dayPlan) {
            dayPlan.slots.splice(index, 1);
        }
        setEditedPlan(newPlan);
        setSlotToDelete(null);
    };

    const handleSaveChanges = () => {
        // Here you could add validation for overlapping times if needed
        setPlan(editedPlan);
        addToast(t('toasts.timetableUpdated'), 'success');
        onClose();
    };

    const inputClasses = "block w-full px-2 py-1 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md shadow-inner sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed";

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
                                        {dayPlan?.slots.map((slot, index) => (
                                            <div key={index} className={`grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-2 items-center p-2 rounded-md ${slot.isLocked ? 'bg-gray-100 dark:bg-gray-800/50' : 'bg-gray-50 dark:bg-gray-800'}`}>
                                                <input type="text" value={slot.activity} onChange={e => handleSlotChange(day, index, 'activity', e.target.value)} className={inputClasses} disabled={slot.isLocked} />
                                                <TimeInput value={slot.startTime} onChange={val => handleSlotChange(day, index, 'startTime', val)} disabled={slot.isLocked} />
                                                <TimeInput value={slot.endTime} onChange={val => handleSlotChange(day, index, 'endTime', val)} disabled={slot.isLocked} />
                                                <select value={slot.type} onChange={e => handleSlotChange(day, index, 'type', e.target.value as ActivityType)} className={inputClasses} disabled={slot.isLocked}>
                                                    {Object.values(ActivityType).map(type => <option key={type} value={type}>{type}</option>)}
                                                </select>
                                                <div className="flex items-center justify-center w-10 h-10">
                                                    {slot.isLocked ? (
                                                        <span title={t('editTimetable.lockedTooltip')}>
                                                            <LockIcon className="w-5 h-5 text-gray-400" />
                                                        </span>
                                                    ) : (
                                                        <button onClick={(e) => { e.stopPropagation(); setSlotToDelete({ day, index }); }} title={t('common.delete')}>
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