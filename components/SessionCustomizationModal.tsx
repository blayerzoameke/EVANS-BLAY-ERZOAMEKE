
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface SessionCustomizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: { studyDuration: number; breakDuration: number; breakActivity: string; breakLink: string; breakPlacement: 'during' | 'after'; addToPlan: boolean }) => void;
    subject: string;
    defaultDuration?: number;
    isUntracked?: boolean;
}

const breakOptions = [
    { value: 'youtube', labelKey: 'sessionCustomization.break.youtube' },
    { value: 'tiktok', labelKey: 'sessionCustomization.break.tiktok' },
    { value: 'music', labelKey: 'sessionCustomization.break.music' },
    { value: 'walk', labelKey: 'sessionCustomization.break.walk' },
    { value: 'custom', labelKey: 'sessionCustomization.break.custom' }
];

const SessionCustomizationModal: React.FC<SessionCustomizationModalProps> = ({ isOpen, onClose, onConfirm, subject, defaultDuration = 50, isUntracked = false }) => {
    const { t } = useLanguage();
    const [studyDuration, setStudyDuration] = useState(defaultDuration);
    
    const [breakDuration, setBreakDuration] = useState(10);
    const [breakDurationSelection, setBreakDurationSelection] = useState('10');
    const [breakPlacement, setBreakPlacement] = useState<'during' | 'after'>('after');

    const [breakActivityType, setBreakActivityType] = useState('youtube');
    const [customBreakActivity, setCustomBreakActivity] = useState('');
    const [breakLink, setBreakLink] = useState('');
    const [addToPlan, setAddToPlan] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) {
        return null;
    }
    
    const handleConfirm = () => {
        setError(null);

        if (breakLink) {
            const lowerLink = breakLink.toLowerCase();
            if (breakActivityType === 'youtube' && !(lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be'))) {
                setError(t('validation.invalidLinkUrl', { platform: 'YouTube' }));
                return;
            }
            if (breakActivityType === 'tiktok' && !lowerLink.includes('tiktok.com')) {
                setError(t('validation.invalidLinkUrl', { platform: 'TikTok' }));
                return;
            }
            if (breakActivityType === 'music' && (lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be') || lowerLink.includes('tiktok.com'))) {
                 setError(t('validation.invalidLinkUrl', { platform: 'Music (Spotify, SoundCloud, etc.)' }));
                 return;
            }
        }

        const finalBreakActivity = breakActivityType === 'custom' 
            ? customBreakActivity 
            : t(breakOptions.find(o => o.value === breakActivityType)?.labelKey as any) || '';
        onConfirm({
            studyDuration,
            breakDuration,
            breakActivity: finalBreakActivity,
            breakLink,
            breakPlacement,
            addToPlan
        });
    };

    const handleBreakDurationSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setBreakDurationSelection(value);
        if (value !== 'custom') {
            setBreakDuration(parseInt(value, 10));
        }
    };

    const handleBreakDurationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBreakDuration(parseInt(e.target.value, 10) || 0);
    };

    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('sessionCustomization.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                     <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md -mt-2">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('common.subject')}</p>
                        <p className="font-bold text-lg text-primary dark:text-primary-light truncate">{subject}</p>
                    </div>
                    <div>
                        <label htmlFor="study-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.duration')}</label>
                        <input type="number" id="study-duration" value={studyDuration} onChange={e => setStudyDuration(parseInt(e.target.value, 10))} className={`${inputClasses} mt-1`} min="1" />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('sessionCustomization.durationSuggestion')}</p>
                    </div>

                    <div>
                        <label htmlFor="break-duration-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.breakDuration')}</label>
                        <select id="break-duration-select" value={breakDurationSelection} onChange={handleBreakDurationSelectChange} className={`${inputClasses} mt-1`}>
                            <option value={0}>{t('sessionCustomization.breakDuration.none')}</option>
                            <option value={5}>{t('sessionCustomization.breakDuration.5')}</option>
                            <option value={10}>{t('sessionCustomization.breakDuration.10')}</option>
                            <option value={15}>{t('sessionCustomization.breakDuration.15')}</option>
                            <option value="custom">{t('sessionCustomization.breakDuration.custom')}</option>
                        </select>
                        {breakDurationSelection === 'custom' && (
                             <div className="mt-2">
                                <label htmlFor="custom-break-duration" className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.customDurationLabel')}</label>
                                <input 
                                    type="number" 
                                    id="custom-break-duration"
                                    value={breakDuration} 
                                    onChange={handleBreakDurationInputChange} 
                                    className={`${inputClasses} mt-1`} 
                                    min="0"
                                    placeholder={t('sessionCustomization.customDurationPlaceholder')}
                                />
                            </div>
                        )}
                    </div>

                    {breakDuration > 0 && (
                        <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.breakPlacement.title')}</label>
                                <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-gray-100 dark:bg-gray-800 p-1">
                                    <button onClick={() => setBreakPlacement('during')} className={`px-3 py-1.5 text-sm font-medium rounded ${breakPlacement === 'during' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}>{t('sessionCustomization.breakPlacement.during')}</button>
                                    <button onClick={() => setBreakPlacement('after')} className={`px-3 py-1.5 text-sm font-medium rounded ${breakPlacement === 'after' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}>{t('sessionCustomization.breakPlacement.after')}</button>
                                </div>
                            </div>
                             <div>
                                <label htmlFor="break-activity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.breakActivity')}</label>
                                <select id="break-activity" value={breakActivityType} onChange={e => { setBreakActivityType(e.target.value); setError(null); }} className={`${inputClasses} mt-1`}>
                                    {breakOptions.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey as any)}</option>)}
                                </select>
                            </div>
                            {breakActivityType === 'custom' && (
                                <input type="text" value={customBreakActivity} onChange={e => setCustomBreakActivity(e.target.value)} placeholder={t('sessionCustomization.breakActivityPlaceholder')} className={`${inputClasses} mt-1`} />
                            )}
                            {['youtube', 'tiktok', 'music'].includes(breakActivityType) && (
                                <div>
                                    <label htmlFor="break-link" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('sessionCustomization.breakLink')}</label>
                                    <input 
                                        type="url" 
                                        id="break-link" 
                                        value={breakLink} 
                                        onChange={e => { setBreakLink(e.target.value); setError(null); }} 
                                        placeholder={t('sessionCustomization.breakLinkPlaceholder')} 
                                        className={`${inputClasses} mt-1 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} 
                                    />
                                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                                </div>
                            )}
                        </div>
                    )}

                    {isUntracked && (
                        <div className="flex items-center space-x-2 pt-4 border-t dark:border-gray-700">
                            <input
                                type="checkbox"
                                id="add-to-plan"
                                checked={addToPlan}
                                onChange={(e) => setAddToPlan(e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="add-to-plan" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('sessionCustomization.addToPlan')}
                            </label>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                    >
                        {t('common.proceed')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionCustomizationModal;
