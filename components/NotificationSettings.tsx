import React from 'react';
import type { NotificationSettings } from '../types';

interface NotificationSettingsProps {
    settings: NotificationSettings;
    setSettings: (settings: NotificationSettings) => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ settings, setSettings }) => {
    
    const handleFirstTimeEnable = () => {
        if (Notification.permission === 'denied') {
            alert("Notifications are blocked by your browser. Please enable them in your browser settings.");
            return;
        }
        
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                setSettings({ ...settings, status: 'configured', enabled: true });
                new Notification("Notifications Enabled!", {
                    body: "Great! We'll keep you on track with your studies."
                });
            } else {
                alert("Notifications were not enabled. You can change this in your browser settings later.");
            }
        });
    };

    const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
        setSettings({ ...settings, [key]: value });
    };

    if (settings.status === 'unconfigured') {
        return (
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
                <h2 className="text-2xl font-bold mb-4">Enable Study Notifications?</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    We can help you stay on track by sending you reminders for your study sessions and breaks.
                </p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setSettings({ ...settings, status: 'configured', enabled: false })} className="px-6 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Maybe Later</button>
                    <button onClick={handleFirstTimeEnable} className="px-6 py-2 rounded-md bg-indigo-600 text-white font-semibold">Turn On Notifications</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Notifications</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your study and break reminders.</p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
                {/* Master Switch */}
                <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
                    <label htmlFor="master-switch" className="font-semibold text-lg">Enable Notifications</label>
                    <input id="master-switch" type="checkbox" checked={settings.enabled} onChange={e => updateSetting('enabled', e.target.checked)} className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 appearance-none checked:bg-indigo-600 transition duration-200 ease-in-out relative cursor-pointer
                        after:content-[''] after:h-5 after:w-5 after:rounded-full after:bg-white after:absolute after:top-0.5 after:left-0.5 after:transition after:duration-200 checked:after:translate-x-5" />
                </div>
                
                {settings.enabled && (
                    <div className="space-y-6 pt-4">
                        {/* Pre-session reminders */}
                        <div className="flex items-start justify-between">
                            <div>
                                <label htmlFor="reminders" className="font-medium">Pre-session reminders</label>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Get a heads-up before your study time starts.</p>
                            </div>
                            <input id="reminders" type="checkbox" checked={settings.reminders} onChange={e => updateSetting('reminders', e.target.checked)} className="h-5 w-5 rounded mt-1 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                        </div>

                        {/* Reminder Time */}
                        {settings.reminders && (
                             <div className="pl-6">
                                <label htmlFor="reminderTime" className="text-sm font-medium">Remind me before:</label>
                                <select id="reminderTime" value={settings.reminderTime} onChange={e => updateSetting('reminderTime', parseInt(e.target.value, 10) as 5 | 10 | 15)} className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                    <option value={5}>5 minutes</option>
                                    <option value={10}>10 minutes</option>
                                    <option value={15}>15 minutes</option>
                                </select>
                            </div>
                        )}
                        
                        {/* Session start alert */}
                        <div className="flex items-start justify-between">
                            <div>
                               <label htmlFor="sessionStart" className="font-medium">Session start alert</label>
                               <p className="text-sm text-gray-500 dark:text-gray-400">Get an alert right when it's time to study.</p>
                            </div>
                            <input id="sessionStart" type="checkbox" checked={settings.sessionStart} onChange={e => updateSetting('sessionStart', e.target.checked)} className="h-5 w-5 rounded mt-1 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                        </div>
                        
                        {/* Break alerts */}
                        <div className="flex items-start justify-between">
                             <div>
                               <label htmlFor="breakAlerts" className="font-medium">Break alerts</label>
                               <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when breaks start and end.</p>
                            </div>
                            <input id="breakAlerts" type="checkbox" checked={settings.breakStartEnd} onChange={e => updateSetting('breakStartEnd', e.target.checked)} className="h-5 w-5 rounded mt-1 text-indigo-600 focus:ring-indigo-500 shrink-0" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationSettings;
