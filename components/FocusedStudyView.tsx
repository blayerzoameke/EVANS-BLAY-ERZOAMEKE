import React, { useState } from 'react';
import type { ActiveSession } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import UploadSlides from './UploadSlides';
import { ExitIcon } from './icons/ExitIcon';
import ConfirmationModal from './ConfirmationModal.tsx';

interface FocusedStudyViewProps {
    activeSession: ActiveSession;
    onExit: () => void;
}

const FocusedStudyView: React.FC<FocusedStudyViewProps> = ({ activeSession, onExit }) => {
    const { t } = useLanguage();
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    return (
        <>
            <div className="flex flex-col w-full h-full bg-gray-100 dark:bg-gray-900">
                {activeSession.isUntracked && (
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-center text-sm no-print">
                        {t('focusedView.untrackedWarning')}
                    </div>
                )}
                <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm no-print">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Studying: {activeSession.subject}
                    </h1>
                    <button
                        onClick={() => setShowExitConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                        <ExitIcon className="w-4 h-4" />
                        {t('focusedView.exit')}
                    </button>
                </header>
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-hidden">
                    {activeSession.studyModeFile ? (
                        <UploadSlides file={activeSession.studyModeFile} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            No document associated with this study session.
                        </div>
                    )}
                </main>
            </div>

            <ConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={onExit}
                title={t('confirmation.exitStudy.title')}
                message={t('confirmation.exitStudy.message')}
                confirmText={t('common.exit')}
                cancelText={t('common.continue')}
                confirmColor="red"
                cancelColor="green"
            />
        </>
    );
};

export default FocusedStudyView;