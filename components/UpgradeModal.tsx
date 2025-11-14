import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';
import { CrownIcon } from './icons/CrownIcon';
import { CheckIcon } from './icons/CheckIcon';
import type { View } from '../types';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    setView: (view: View) => void;
    featureTitle: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, setView, featureTitle }) => {
    const { t } = useLanguage();

    if (!isOpen) {
        return null;
    }

    const premiumFeatures = [
        "pricing.feature.timetables.premium",
        "pricing.feature.materials.premium",
        "pricing.feature.quizzes.premium",
        "pricing.feature.solver.premium",
        "pricing.feature.ads",
        "pricing.feature.export",
    ];

    const handleUpgradeClick = () => {
        onClose();
        setView('pricing');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 no-print" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white">
                        <CrownIcon className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('monetization.upgradeModal.title')}</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        {t('monetization.upgradeModal.message', { feature: featureTitle })}
                    </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
                     <ul className="space-y-2 text-sm">
                        {premiumFeatures.map(key => (
                             <li key={key} className="flex items-center gap-3">
                                <CheckIcon className="w-5 h-5 text-green-500" />
                                <span className="text-gray-700 dark:text-gray-300">{t(key as any)}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-6 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                        {t('monetization.upgradeModal.maybeLater')}
                    </button>
                    <button
                        onClick={handleUpgradeClick}
                        className="flex-1 py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-primary text-primary-text hover:bg-primary-dark"
                    >
                        {t('monetization.upgradeModal.learnMore')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;