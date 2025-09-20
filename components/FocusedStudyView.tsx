import React, { useState } from 'react';
// FIX: Imported LearningHubState to correctly type the dummy state object.
import type { ActiveSession, Toast, LearningHubState, UploadedFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ExitIcon } from './icons/ExitIcon';
import UploadSlides from './UploadSlides'; // The viewer is now inside UploadSlides
import ConfirmationModal from './ConfirmationModal';

interface FocusedStudyViewProps {
    session: ActiveSession;
    learningHubFile: UploadedFile | null;
    onExit: () => void;
    addToast: (message: string, type: Toast['type']) => void;
}

const FocusedStudyView: React.FC<FocusedStudyViewProps> = ({ session, learningHubFile, onExit, addToast }) => {
    const { t } = useLanguage();
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    
    // Dummy state setters for the embedded UploadSlides component.
    // In this view, UploadSlides is only used for displaying the file.
    const dummySetState = () => {};
    // FIX: Explicitly typed dummyLearningHubState to resolve type incompatibility for 'analysisMode'.
    const dummyLearningHubState: LearningHubState = {
        file: learningHubFile,
        analysisMode: 'none',
        analysisResults: { summarize: null, explain: null, read: null },
        chatHistory: []
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-[100] flex flex-col">
                <header className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border-b dark:border-slate-700 shadow-sm shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                           {t('focusedStudy.title')}
                        </h2>
                         <p className="text-sm text-gray-500 dark:text-gray-400">
                             {t('focusedStudy.session', { subject: session.subject })}
                        </p>
                    </div>
                     {session.isUntracked && (
                        <div className="p-2 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-md">
                           {t('focusedStudy.untrackedWarning')}
                        </div>
                    )}
                    <button 
                        onClick={() => setShowExitConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                       <ExitIcon className="w-4 h-4" /> {t('focusedStudy.exit')}
                    </button>
                </header>
                <main className="flex-1 overflow-y-auto">
                    <UploadSlides
                        smartPlan={null}
                        setSmartPlan={dummySetState as any}
                        activeSession={session}
                        setActiveSession={dummySetState as any}
                        setView={dummySetState as any}
                        addToast={addToast}
                        learningHubState={dummyLearningHubState}
                        setLearningHubState={dummySetState as any}
                        notes={[]}
                        setNotes={dummySetState as any}
                        showTitle={false}
                        isStudyModeView={true}
                    />
                </main>
            </div>
            <ConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={onExit}
                title={t('confirmation.exitStudy.title')}
                message={t('confirmation.exitStudy.message')}
                confirmText={t('confirmation.exitStudy.confirm')}
                cancelText={t('confirmation.exitStudy.cancel')}
                confirmColor="red"
                cancelColor="green"
            />
        </>
    );
};

export default FocusedStudyView;