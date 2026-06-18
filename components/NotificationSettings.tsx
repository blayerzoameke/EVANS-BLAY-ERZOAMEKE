
import React, { useState, useEffect } from 'react';
import type { NotificationSettings } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { notificationService } from '../services/notificationService';
import { VolumeIcon } from './icons/VolumeIcon';

interface NotificationSettingsProps {
    settings: NotificationSettings;
    setSettings: (settings: NotificationSettings) => void;
}

const NotificationSettingsComponent: React.FC<NotificationSettingsProps> = ({ settings, setSettings }) => {
    const { t } = useLanguage();
    const [isCustomTime, setIsCustomTime] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const [isSupported, setIsSupported] = useState(true);

    // Safely check notification support and status
    useEffect(() => {
        const checkSupport = () => {
            try {
                if (typeof window === 'undefined' || !('Notification' in window)) {
                    setIsSupported(false);
                    setPermissionStatus('unsupported');
                    return;
                }
                setPermissionStatus(Notification.permission);
            } catch (e) {
                console.warn("Notification API access failed:", e);
                setIsSupported(false);
                setPermissionStatus('unsupported');
            }
        };

        checkSupport();
            
        // Poll for changes safely
        const interval = setInterval(() => {
            try {
                if (typeof Notification !== 'undefined' && 'permission' in Notification) {
                     setPermissionStatus(Notification.permission);
                }
            } catch (e) {
                // Ignore errors during polling
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (settings && ![5, 10, 15].includes(settings.reminderTime)) {
            setIsCustomTime(true);
        } else {
            setIsCustomTime(false);
        }
    }, [settings]);
    
    const handleRequestPermission = async () => {
        if (!isSupported) {
            alert('Notifications are not supported on this device.');
            return;
        }

        try {
            const permission = await notificationService.requestPermission();
            setPermissionStatus(permission);
            
            if (permission === 'granted') {
                setSettings({
                    ...settings,
                    enabled: true,
                    status: 'configured',
                    reminders: true,
                    sessionStart: true,
                    breakStartEnd: true
                });
            }
        } catch (error) {
            console.error('Error requesting permission:', error);
        }
    };

    const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
        setSettings({ ...settings, [key]: value });
    };
    
    const handleMasterSwitchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = e.target.checked;
        
        if (isEnabled) {
            if (!isSupported) {
                setSettings({
                    ...settings,
                    enabled: true,
                    status: 'configured'
                });
                alert('Notifications are not supported by this browser/device.');
                return;
            }

            try {
                if (Notification.permission === 'granted') {
                    setSettings({
                        ...settings,
                        enabled: true,
                        status: 'configured'
                    });
                } else if (Notification.permission === 'denied') {
                    setSettings({
                        ...settings,
                        enabled: true,
                        status: 'configured'
                    });
                } else {
                    setSettings({
                        ...settings,
                        enabled: true,
                        status: 'configured'
                    });
                    await handleRequestPermission();
                }
            } catch (e) {
                 // Fallback if permission check fails
                 setSettings({
                    ...settings,
                    enabled: true,
                    status: 'configured'
                });
            }
        } else {
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
    
    const baseInputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    if (!settings) return null;

    if (!isSupported) {
        return (
             <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
                    {t('preferences.notifications.title') || 'Notifications'}
                </h2>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                        <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                            Notifications are not supported on this browser or device.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
                    {t('preferences.notifications.title') || 'Notifications'}
                </h2>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700 transition-all duration-300">
                <div className="space-y-6">
                    {/* Master Switch */}
                    <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
                        <div className="flex-1">
                            <label htmlFor="master-switch" className="font-semibold text-lg cursor-pointer block">
                                {t('notifications.enable') || 'Enable Notifications'}
                            </label>
                            {/* Status Text */}
                            {settings.enabled && (
                                <p className={`text-sm mt-1 flex items-center gap-1 ${
                                    permissionStatus === 'granted' ? 'text-green-600 dark:text-green-400' : 
                                    permissionStatus === 'denied' ? 'text-red-600 dark:text-red-400' : 
                                    'text-yellow-600 dark:text-yellow-400'
                                }`}>
                                    {permissionStatus === 'granted' ? 'Active' : 
                                     permissionStatus === 'denied' ? 'Blocked by Browser' : 
                                     'Permission Needed'}
                                </p>
                            )}
                        </div>
                        <input 
                            id="master-switch" 
                            type="checkbox" 
                            checked={settings.enabled} 
                            onChange={handleMasterSwitchChange} 
                            className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 appearance-none checked:bg-blue-600 transition duration-200 ease-in-out relative cursor-pointer after:content-[''] after:h-5 after:w-5 after:rounded-full after:bg-white after:absolute after:top-0.5 after:left-0.5 after:transition after:duration-200 checked:after:translate-x-5" 
                        />
                    </div>
                    
                    {/* Notification Options */}
                    {settings.enabled && (
                        <div className="space-y-6 pt-2 animate-fade-in-down origin-top">
                            
                            {/* Warning banner ONLY if permission is actively denied */}
                            {permissionStatus === 'denied' && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <div className="flex gap-3">
                                        <div className="text-2xl">🔒</div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">
                                                Notifications are blocked
                                            </h4>
                                            <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                                                You previously selected "Block". The browser will not ask again automatically.
                                            </p>
                                            <div className="text-sm text-red-800 dark:text-red-300 space-y-2">
                                                <p><strong>How to fix this:</strong></p>
                                                <ol className="list-decimal list-inside space-y-1 ml-1">
                                                    <li>Click the <strong>lock icon (🔒)</strong> or settings icon in your address bar.</li>
                                                    <li>Find <strong>"Notifications"</strong>.</li>
                                                    <li>Change setting to <strong>"Allow"</strong> or "Reset".</li>
                                                    <li>Reload this page.</li>
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Prompt banner if permission is default */}
                            {permissionStatus === 'default' && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex justify-between items-center">
                                    <p className="text-sm text-blue-800 dark:text-blue-300">
                                        Browser permission is required.
                                    </p>
                                    <button 
                                        onClick={handleRequestPermission}
                                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Allow
                                    </button>
                                </div>
                            )}

                            {/* Test Sound Button */}
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => {
                                        notificationService.testAlarm();
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md"
                                >
                                    <VolumeIcon className="w-4 h-4" />
                                    Test Alarm Sound
                                </button>
                            </div>

                            {/* Pre-session reminders */}
                            <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex-1">
                                    <label htmlFor="reminders" className="font-medium cursor-pointer">
                                        {t('notifications.reminders') || 'Pre-session reminders'}
                                    </label>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {t('notifications.remindersDesc') || 'Get a notification before a scheduled session starts.'}
                                    </p>
                                </div>
                                <input 
                                    id="reminders" 
                                    type="checkbox" 
                                    checked={settings.reminders} 
                                    onChange={e => updateSetting('reminders', e.target.checked)} 
                                    className="h-5 w-5 rounded mt-1 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer" 
                                />
                            </div>

                            {/* Reminder Time Selector */}
                            {settings.reminders && (
                                <div className="pl-6 space-y-3 border-l-2 border-blue-500 ml-1 animate-fade-in-down">
                                    <label htmlFor="reminderTime" className="text-sm font-medium block">
                                        {t('notifications.remindMeBefore') || 'Remind me before'}
                                    </label>
                                    <div className="flex gap-2">
                                        <select 
                                            id="reminderTime" 
                                            value={isCustomTime ? 'custom' : settings.reminderTime} 
                                            onChange={handleReminderTimeSelect} 
                                            className={`${baseInputClasses} flex-1`}
                                        >
                                            <option value={5}>{t('notifications.minutes', { count: 5 }) || '5 minutes'}</option>
                                            <option value={10}>{t('notifications.minutes', { count: 10 }) || '10 minutes'}</option>
                                            <option value={15}>{t('notifications.minutes', { count: 15 }) || '15 minutes'}</option>
                                            <option value="custom">{t('sessionCustomization.breakDuration.custom') || 'Custom'}</option>
                                        </select>
                                        {isCustomTime && (
                                            <input 
                                                type="number" 
                                                value={settings.reminderTime} 
                                                onChange={e => updateSetting('reminderTime', parseInt(e.target.value, 10) || 5)} 
                                                className={`${baseInputClasses} w-24`}
                                                min="1"
                                                max="60"
                                                placeholder="Min"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* Session start alert */}
                            <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex-1">
                                    <label htmlFor="sessionStart" className="font-medium cursor-pointer">
                                        {t('notifications.sessionStart') || 'Session start alert'}
                                    </label>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {t('notifications.sessionStartDesc') || 'Get an alert exactly when a session begins.'}
                                    </p>
                                </div>
                                <input 
                                    id="sessionStart" 
                                    type="checkbox" 
                                    checked={settings.sessionStart} 
                                    onChange={e => updateSetting('sessionStart', e.target.checked)} 
                                    className="h-5 w-5 rounded mt-1 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer" 
                                />
                            </div>
                            
                            {/* Break start/end alerts */}
                            <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex-1">
                                    <label htmlFor="breakAlerts" className="font-medium cursor-pointer">
                                        {t('notifications.breakAlerts') || 'Break start/end alerts'}
                                    </label>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {t('notifications.breakAlertsDesc') || "Get notified when it's time for a break and when it's over."}
                                    </p>
                                </div>
                                <input 
                                    id="breakAlerts" 
                                    type="checkbox" 
                                    checked={settings.breakStartEnd} 
                                    onChange={e => updateSetting('breakStartEnd', e.target.checked)} 
                                    className="h-5 w-5 rounded mt-1 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer" 
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add the fade-in animation */}
            <style>{`
                @keyframes fade-in-down {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-down {
                    animation: fade-in-down 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default NotificationSettingsComponent;
