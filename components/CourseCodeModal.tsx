

import React, { useState, useEffect } from 'react';
import type { CourseCodeMap } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';

interface CourseCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (map: CourseCodeMap) => void;
    codes: string[];
    existingMap: CourseCodeMap;
}

const CourseCodeModal: React.FC<CourseCodeModalProps> = ({ isOpen, onClose, onConfirm, codes, existingMap }) => {
    const { t } = useLanguage();
    const [mappings, setMappings] = useState<CourseCodeMap>({});

    useEffect(() => {
        if (isOpen) {
            const initialMap: CourseCodeMap = {};
            codes.forEach(code => {
                initialMap[code] = existingMap[code] || '';
            });
            setMappings(initialMap);
        }
    }, [isOpen, codes, existingMap]);

    if (!isOpen) return null;

    const handleInputChange = (code: string, fullName: string) => {
        setMappings(prev => ({ ...prev, [code]: fullName }));
    };
    
    const handleConfirm = () => {
        onConfirm(mappings);
    };
    
    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 no-print" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('courseCodeModal.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <p className="text-gray-600 dark:text-gray-400">{t('courseCodeModal.description')}</p>
                    <div className="space-y-4">
                        {codes.map(code => (
                            <div key={code} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{code}</span>
                                <input
                                    type="text"
                                    value={mappings[code] || ''}
                                    onChange={e => handleInputChange(code, e.target.value)}
                                    placeholder={t('courseCodeModal.placeholder')}
                                    className={inputClasses}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-blue-700 text-white hover:bg-blue-800"
                    >
                        {t('courseCodeModal.proceed')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CourseCodeModal;
