import React from 'react';
import type { ActiveSession, UploadedFile, Toast, TrackedSession, LearningHubState, View } from './types.ts';
import { useLanguage } from './contexts/LanguageContext.tsx';
import { BookIcon } from './icons/BookIcon.tsx';
import UploadSlides from './UploadSlides.tsx';
import StudyTracker from './components/StudyTracker.tsx';


interface FocusedStudyViewProps {
    session: ActiveSession;
    setSession: (session: ActiveSession | null) => void;
    learningHubFile: UploadedFile | null;
    onExit: () => void;
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    trackedData: TrackedSession[];
    setTrackedData: (data: TrackedSession[]) => void;
    setView: (view: View) => void;
    setLearningHubState: React.Dispatch<React.SetStateAction<LearningHubState>>;
}

const FocusedStudyView: React.FC<FocusedStudyViewProps> = (props) => {
    const { t } = useLanguage();
    const { session, learningHubFile, addToast } = props;

    // These dummy props are for UploadSlides, which has a lot of functionality we don't need in this view.
    const dummySetState = () => {};
    const dummyLearningHubState: LearningHubState = {
        file: learningHubFile,
        analysisMode: 'none',
        analysisResults: { summarize: null, explain: null, read: null },
        chatHistory: [],
        isProcessing: false,
    };

    return (
        <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-[100] flex flex-col no-print">
            <main className="flex-1 overflow-hidden p-4">
                 {learningHubFile ? (
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
                        intendedStudyContext={null}
                        setIntendedStudyContext={dummySetState as any}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-center text-gray-500 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                        <div className="p-8">
                            <BookIcon className="w-20 h-20 mx-auto text-gray-400 dark:text-gray-500 mb-6" />
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                {t('focusedStudy.focusMode.title')}
                            </h3>
                            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                                {session.subject}
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-12 italic">
                                "{t('focusedStudy.focusMode.quote')}"
                            </p>
                        </div>
                    </div>
                )}
            </main>
            
            {/* The new tracker component, floating above the main content */}
            <StudyTracker {...props} />
        </div>
    );
};

export default FocusedStudyView;