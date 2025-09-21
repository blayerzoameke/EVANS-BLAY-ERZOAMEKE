

// FIX: Implement Settings component to resolve module error.
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ExportIcon } from './icons/ExportIcon';
import { ImportIcon } from './icons/ImportIcon';
import { TrashIcon } from './icons/TrashIcon';
import Switch from './Switch.tsx';
// FIX: Added .ts extension to import path.
import type { NotificationSettings } from '../types.ts';
import ConfirmationModal from './ConfirmationModal.tsx';


interface SettingsProps {
    notificationSettings: NotificationSettings;
    setNotificationSettings: (settings: NotificationSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ notificationSettings, setNotificationSettings }) => {
    const { t } = useLanguage();
    const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);

    const handleExport = () => {
        const data: { [key: string]: any } = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                data[key] = localStorage.getItem(key);
            }
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edublay_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target?.result as string);
                        Object.keys(data).forEach(key => {
                            localStorage.setItem(key, data[key]);
                        });
                        alert('Data imported successfully! Please refresh the page.');
                        window.location.reload();
                    } catch (error) {
                        alert('Failed to import data. The file might be corrupted.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleClearData = () => {
        localStorage.clear();
        alert('All data has been cleared. The app will now reload.');
        window.location.reload();
    };

    return (
        <>
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('settings.title')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('settings.subtitle')}</p>
                </div>

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                    <h3 className="text-lg font-semibold">{t('settings.appSettings.title')}</h3>
                    <div className="flex items-center justify-between">
                        <label htmlFor="notif-toggle" className="font-medium text-sm">{t('notifications.enable')}</label>
                        <Switch id="notif-toggle" checked={notificationSettings.enabled} onChange={e => setNotificationSettings({...notificationSettings, enabled: e.target.checked, status: 'configured'})} />
                    </div>
                </div>

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                    <h3 className="text-lg font-semibold">{t('settings.data.title')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.data.desc')}</p>
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">
                            <ExportIcon className="w-4 h-4" /> {t('settings.data.export')}
                        </button>
                        <button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700">
                            <ImportIcon className="w-4 h-4" /> {t('settings.data.import')}
                        </button>
                    </div>
                    <div className="pt-4 mt-4 border-t dark:border-gray-700">
                        <button onClick={() => setShowClearDataConfirm(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">
                            <TrashIcon className="w-4 h-4" /> {t('settings.data.clear')}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showClearDataConfirm}
                onClose={() => setShowClearDataConfirm(false)}
                onConfirm={handleClearData}
                title={t('confirmation.resetApp.title')}
                message={t('confirmation.resetApp.message')}
                confirmText={t('common.reset')}
                confirmColor="red"
            />
        </>
    );
};

export default Settings;