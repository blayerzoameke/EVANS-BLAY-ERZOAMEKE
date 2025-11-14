
import React, { useEffect } from 'react';
import type { Toast as ToastType } from '../types.ts';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';

interface ToastProps {
    toast: ToastType;
    onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    const { t } = useLanguage();
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, 3000); // Auto-dismiss after 3 seconds

        return () => {
            clearTimeout(timer);
        };
    }, [toast.id, onDismiss]);

    const baseClasses = "flex items-center justify-between w-full max-w-xs p-4 text-gray-500 bg-white rounded-lg shadow-lg dark:text-gray-400 dark:bg-gray-800 border dark:border-gray-700";
    
    return (
         <div className={baseClasses} role="alert">
            <div className="text-sm font-normal">{toast.message}</div>
            <button
                type="button"
                className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={() => onDismiss(toast.id)}
                aria-label={t('common.close')}
            >
                <span className="sr-only">{t('common.close')}</span>
                <CloseIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default Toast;