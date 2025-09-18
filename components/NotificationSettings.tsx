import React from 'react';
// FIX: Added .ts extension to import path.
import type { NotificationSettings } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationSettingsProps {
    settings: NotificationSettings;
    setSettings: (settings: NotificationSettings) => void;
}

const NotificationSettingsComponent: React.FC<NotificationSettingsProps> = ({ settings, setSettings }) => {
    const { t } = useLanguage();
    
    const handleFirstTimeEnable = () => {
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
                alert(t('notifications.firstTime.notEnabled'));
            }
        });
    };

    const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
        setSettings({ ...settings, [key]: value });
    };

    if (settings.status === 'unconfigured') {
        return (
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
                <h2 className="text-2xl font-bold mb-4">{t('notifications.firstTime.title')}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {t('notifications.firstTime.body')}
                </p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setSettings({ ...settings, status: 'configured', enabled: false })} className="px-6 py-2 rounded-md bg-gray-200 dark:bg-gray-600">{t('notifications.firstTime.maybeLater')}</button>
                    <button onClick={handleFirstTimeEnable} className="px-6 py-2 rounded-md bg-blue-700 text-white font-semibold">{t('notifications.firstTime.turnOn')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('notifications.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('notifications.subtitle')}</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
                {/* Master Switch */}
                <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
                    <label htmlFor="master-switch" className="font-semibold text-lg">{t('notifications.enable')}</label>
                    <input id="master-switch" type="checkbox" checked={settings.enabled} onChange={e => updateSetting('enabled', e.target.checked)} className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 appearance-none checked:bg-blue-700 transition duration-200 ease-in-out relative cursor-pointer
                        after:content-[''] after:h-5 after:w-5 after:rounded-full after:bg-white after:absolute after:top-0.5 after:left-0.5 after:transition after:duration-200 checked:after:translate-x-5" />
                </div>
                
                {settings.enabled && (
                    <div className="space-y-6 pt-4">
                        {/* Pre-session reminders */}
                        <div className="flex items-start justify-between">
                            <div>
                                <label htmlFor="reminders" className="font-medium">{t('notifications.reminders')}</label>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('notifications.remindersDesc')}</p>
                            </div>
                            <input id="reminders" type="checkbox" checked={settings.reminders} onChange={e => updateSetting('reminders', e.target.checked)} className="h-5 w-5 rounded mt-1 text-blue-700 focus:ring-blue-500 shrink-0" />
                        </div>

                        {/* Reminder Time */}
                        {settings.reminders && (
                             <div className="pl-6">
                                <label htmlFor="reminderTime" className="text-sm font-medium">{t('notifications.remindMeBefore')}</label>
                                <select id="reminderTime" value={settings.reminderTime} onChange={e => updateSetting('reminderTime', parseInt(e.target.value, 10) as 5 | 10 | 15)} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                    <option value={5}>{t('notifications.minutes', { count: 5 })}</option>
                                    <option value={10}>{t('notifications.minutes', { count: 10 })}</option>
                                    <option value={15}>{t('notifications.minutes', { count: 15 })}</option>
                                </select>
                            </div>
                        )}
                        
                        {/* Session start alert */}
                        <div className="flex items-start justify-between">
                            <div>
                               <label htmlFor="sessionStart" className="font-medium">{t('notifications.sessionStart')}</label>
                               <p className="text-sm text-gray-500 dark:text-gray-400">{t('notifications.sessionStartDesc')}</p>
                            </div>
                            <input id="sessionStart" type="checkbox" checked={settings.sessionStart} onChange={e => updateSetting('sessionStart', e.target.checked)} className="h-5 w-5 rounded mt-1 text-blue-700 focus:ring-blue-500 shrink-0" />
                        </div>
                        
                        {/* Break alerts */}
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
        </div>
    );
};

export default NotificationSettingsComponent;