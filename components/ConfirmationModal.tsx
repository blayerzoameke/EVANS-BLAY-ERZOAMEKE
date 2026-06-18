
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onCancel?: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'red' | 'green' | 'blue';
    cancelColor?: 'red' | 'green' | 'blue';
    tertiaryAction?: {
        text: string;
        onClick: () => void;
    };
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onCancel,
    title,
    message,
    confirmText,
    cancelText,
    confirmColor,
    cancelColor,
    tertiaryAction,
}) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    const getButtonClasses = (color: 'red' | 'green' | 'blue' | undefined, isDefault: boolean) => {
        const base = "px-6 py-2 font-semibold rounded-md transition-colors";
        switch (color) {
            case 'red':
                return `${base} bg-red-600 text-white hover:bg-red-700`;
            case 'green':
                return `${base} bg-green-600 text-white hover:bg-green-700`;
            case 'blue':
                return `${base} bg-blue-700 text-white hover:bg-blue-800`;
            default:
                return isDefault 
                    ? `${base} bg-blue-700 text-white hover:bg-blue-800`
                    : `${base} bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500`;
        }
    };
    
    const confirmButtonClasses = getButtonClasses(confirmColor, true);
    const cancelButtonClasses = getButtonClasses(cancelColor, false);
    const tertiaryButtonClasses = getButtonClasses(undefined, false);

    const handleCancelClick = onCancel || onClose;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 no-print" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold">{title}</h3>
                     <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-400">{message}</p>
                </div>
                <div className="flex justify-end items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    {tertiaryAction && (
                        <button onClick={tertiaryAction.onClick} className={`${tertiaryButtonClasses} mr-auto !px-4 !py-2 text-sm`}>
                            {tertiaryAction.text}
                        </button>
                    )}
                    <button onClick={handleCancelClick} className={cancelButtonClasses}>{cancelText || t('common.cancel')}</button>
                    <button onClick={onConfirm} className={confirmButtonClasses}>{confirmText || t('common.confirm')}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
