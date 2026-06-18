import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSettings from './Language.tsx';
import ThemeSettings from './Theme.tsx';
import NotificationSettingsComponent from './NotificationSettings.tsx';
import type { NotificationSettings } from '../types.ts';

interface PreferencesProps {
    notificationSettings: NotificationSettings;
    setNotificationSettings: (settings: NotificationSettings) => void;
}

const SettingsCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
        {children}
    </div>
);

const Preferences: React.FC<PreferencesProps> = ({ notificationSettings, setNotificationSettings }) => {
    const { t } = useLanguage();

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('preferences.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('preferences.subtitle')}</p>
            </div>

            <SettingsCard title={t('preferences.language.title')}>
                <LanguageSettings />
            </SettingsCard>

            <SettingsCard title={t('preferences.theme.title')}>
                <ThemeSettings />
            </SettingsCard>
            
            <SettingsCard title={t('preferences.notifications.title')}>
                 <NotificationSettingsComponent settings={notificationSettings} setSettings={setNotificationSettings} />
            </SettingsCard>
        </div>
    );
};

export default Preferences;