

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon.tsx';
// FIX: Imported ConflictInfo to be used in props. Added .ts extension.
import type { ConflictInfo } from '../types.ts';

// Helper component to parse and render simple markdown-like bold text
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(part => part);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </>
  );
};


interface ConflictResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    // FIX: Changed prop from 'conflicts: Conflict[]' to 'conflict: ConflictInfo | null' to match usage.
    conflict: ConflictInfo | null;
    onResolve: (resolution: 'replace' | 'shift' | 'addExtra') => void;
}

const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({ isOpen, onClose, conflict, onResolve }) => {
    const { t } = useLanguage();
    const [selectedResolution, setSelectedResolution] = useState<'replace' | 'shift' | 'addExtra'>('replace');
    const [countdown, setCountdown] = useState(15);
    
    useEffect(() => {
        if (!isOpen) return;

        setCountdown(15); // Reset on open
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onResolve('replace'); // Auto-resolve with default
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, onResolve]);


    if (!isOpen || !conflict) {
        return null;
    }
    
    const handleConfirm = () => {
        onResolve(selectedResolution);
    };
    
    const options = [
        {
            id: 'replace',
            title: t('conflict.replace'),
            description: t('conflict.replace.desc', { uploadedSubject: conflict.uploadedSubject })
        },
        {
            id: 'shift',
            title: t('conflict.shift'),
            description: t('conflict.shift.desc', { plannedSubject: conflict.plannedSubject, uploadedSubject: conflict.uploadedSubject })
        },
        {
            id: 'addExtra',
            title: t('conflict.addExtra'),
            description: t('conflict.addExtra.desc', { plannedSubject: conflict.plannedSubject, uploadedSubject: conflict.uploadedSubject })
        }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 no-print" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('conflict.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        <FormattedText text={t('conflict.body', { plannedSubject: conflict.plannedSubject, uploadedSubject: conflict.uploadedSubject })} />
                    </p>
                    <fieldset className="space-y-4">
                        <legend className="sr-only">Resolution Options</legend>
                        {options.map(option => (
                            <div key={option.id} className="relative flex items-start p-3 border-2 rounded-lg has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30 dark:border-gray-700">
                                <div className="flex items-center h-5">
                                    <input
                                        id={option.id}
                                        aria-describedby={`${option.id}-description`}
                                        name="resolution"
                                        type="radio"
                                        checked={selectedResolution === option.id}
                                        onChange={() => setSelectedResolution(option.id as 'replace' | 'shift' | 'addExtra')}
                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label htmlFor={option.id} className="font-medium text-gray-900 dark:text-gray-100">
                                        {option.title}
                                    </label>
                                    <p id={`${option.id}-description`} className="text-gray-500 dark:text-gray-400">
                                       <FormattedText text={option.description} />
                                    </p>
                                </div>
                            </div>
                        ))}
                    </fieldset>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 flex justify-between items-center gap-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Auto-confirming in {countdown}s...
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">
                            {t('common.cancel')}
                        </button>
                        <button onClick={handleConfirm} className="px-4 py-2 bg-blue-700 text-white rounded-md">
                            Confirm & Start
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConflictResolutionModal;