import React, { useState, useEffect } from 'react';
import type { NotificationSettings } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';

interface NotificationSettingsProps {
    settings: NotificationSettings;
    setSettings: (settings: NotificationSettings) => void;
}

const NotificationSettingsComponent: React.FC<NotificationSettingsProps> = ({ settings, setSettings }) => {
    const { t } = useLanguage();
    const [isCustomTime, setIsCustomTime] = useState(false);

    useEffect(() => {
        // Check if the saved time is one of the presets
        if (![5, 10, 15].includes(settings.reminderTime)) {
            setIsCustomTime(true);
        }
    }, [settings.reminderTime]);
    
    const handleFirstTimeEnable = () => {
        if (typeof Notification === 'undefined') {
            alert("This browser does not support desktop notifications.");
            setSettings({ ...settings, status: 'configured', enabled: false });
            return;
        }
        if (Notification.permission === 'denied') {
            alert(t('notifications.firstTime.denied'));
            return;
        }
        
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                setSettings({ ...settings, status: 'configured', enabled: true });
                new Notification(t('notifications.firstTime.enabled'), {
                    body: t('notifications.firstTime.enabledBody')
                });
            } else {
                setSettings({ ...settings, status: 'configured', enabled: false });
            }
        });
    };

    const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
        setSettings({ ...settings, [key]: value });
    };
    
    const handleMasterSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = e.target.checked;
        if (isEnabled && (settings.status === 'unconfigured' || (typeof Notification !== 'undefined' && Notification.permission === 'default'))) {
            handleFirstTimeEnable();
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            updateSetting('enabled', isEnabled);
            updateSetting('status', 'configured');
        } else if (isEnabled) { // Trying to enable when permission is denied
             alert(t('notifications.firstTime.denied'));
        } else { // Disabling
            updateSetting('enabled', false);
        }
    };

    const handleReminderTimeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'custom') {
            setIsCustomTime(true);
        } else {
            setIsCustomTime(false);
            updateSetting('reminderTime', parseInt(value, 10));
        }
    };
    
    const baseInputClasses = "block px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-500 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 text-white dark:text-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
                <label htmlFor="master-switch" className="font-semibold text-lg">{t('notifications.enable')}</label>
                <input 
                    id="master-switch" 
                    type="checkbox" 
                    checked={settings.enabled && (typeof Notification !== 'undefined' && Notification.permission === 'granted')} 
                    onChange={handleMasterSwitchChange} 
                    className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 appearance-none checked:bg-blue-700 transition duration-200 ease-in-out relative cursor-pointer
                    after:content-[''] after:h-5 after:w-5 after:rounded-full after:bg-white after:absolute after:top-0.5 after:left-0.5 after:transition after:duration-200 checked:after:translate-x-5" 
                />
            </div>
            
            {settings.enabled && (
                <div className="space-y-6 pt-4 animate-fade-in-down">
                    <div className="flex items-start justify-between">
                        <div>
                            <label htmlFor="reminders" className="font-medium">{t('notifications.reminders')}</label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('notifications.remindersDesc')}</p>
                        </div>
                        <input id="reminders" type="checkbox" checked={settings.reminders} onChange={e => updateSetting('reminders', e.target.checked)} className="h-5 w-5 rounded mt-1 text-blue-700 focus:ring-blue-500 shrink-0" />
                    </div>

                    {settings.reminders && (
                         <div className="pl-6 space-y-2">
                            <label htmlFor="reminderTime" className="text-sm font-medium">{t('notifications.remindMeBefore')}</label>
                            <div className="flex gap-2">
                                <select id="reminderTime" value={isCustomTime ? 'custom' : settings.reminderTime} onChange={handleReminderTimeSelect} className={`${baseInputClasses} flex-1 w-full`}>
                                    <option value={5}>{t('notifications.minutes', { count: 5 })}</option>
                                    <option value={10}>{t('notifications.minutes', { count: 10 })}</option>
                                    <option value={15}>{t('notifications.minutes', { count: 15 })}</option>
                                    <option value="custom">{t('sessionCustomization.breakDuration.custom')}</option>
                                </select>
                                {isCustomTime && (
                                    <input 
                                        type="number" 
                                        value={settings.reminderTime} 
                                        onChange={e => updateSetting('reminderTime', parseInt(e.target.value, 10) || 0)} 
                                        className={`${baseInputClasses} w-24`}
                                        min="1"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-start justify-between">
                        <div>
                           <label htmlFor="sessionStart" className="font-medium">{t('notifications.sessionStart')}</label>
                           <p className="text-sm text-gray-500 dark:text-gray-400">{t('notifications.sessionStartDesc')}</p>
                        </div>
                        <input id="sessionStart" type="checkbox" checked={settings.sessionStart} onChange={e => updateSetting('sessionStart', e.target.checked)} className="h-5 w-5 rounded mt-1 text-blue-700 focus:ring-blue-500 shrink-0" />
                    </div>
                    
                    <div className="flex items-start justify-between">
                         <div>
                           <label htmlFor="breakAlerts" className="font-medium">{t('notifications.breakAlerts')}</label>
                           <p className="text-sm text-gray-500 dark:text-gray-400">{t('notifications.breakAlertsDesc')}</p>
                        </div>
                        <input id="breakAlerts" type="checkbox" checked={settings.breakStartEnd} onChange={e => updateSetting('breakStartEnd', e.target.checked)} className="h-5 w-5 rounded mt-1 text-blue-700 focus:ring-blue-500 shrink-0" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationSettingsComponent;