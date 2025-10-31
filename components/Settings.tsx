import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ExportIcon } from './icons/ExportIcon';
import { ImportIcon } from './icons/ImportIcon';
import { TrashIcon } from './icons/TrashIcon';
import ConfirmationModal from './ConfirmationModal';
import { storageService } from '../src/services/authService';
import type { Toast } from '../types';

interface SettingsProps {
    addToast: (message: string, type: Toast['type']) => void;
}

const Settings: React.FC<SettingsProps> = ({ addToast }) => {
    const { t } = useLanguage();
    const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
    const importInputRef = React.useRef<HTMLInputElement>(null);

    const handleExport = () => {
        storageService.exportAllData();
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };
    
    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                await storageService.importAllData(file);
                addToast(t('settings.importSuccess'), 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error: any) {
                addToast(error.message || t('settings.importError'), 'error');
            }
        }
    };

    const handleClearData = () => {
        storageService.clearAllData();
        addToast(t('settings.clearSuccess'), 'info');
        setTimeout(() => window.location.reload(), 1000);
    };

    return (
        <>
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('settings.title')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('settings.subtitle')}</p>
                </div>

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                    <h3 className="text-lg font-semibold">{t('settings.data.title')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.data.desc')}</p>
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">
                            <ExportIcon className="w-4 h-4" /> {t('settings.data.export')}
                        </button>
                        <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700">
                            <ImportIcon className="w-4 h-4" /> {t('settings.data.import')}
                        </button>
                        <input
                            type="file"
                            ref={importInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                            accept="application/json"
                        />
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