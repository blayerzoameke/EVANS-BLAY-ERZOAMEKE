
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';
import type { UploadedFile, Note } from '../types';
import { BookIcon } from './icons/BookIcon';
import { UploadIcon } from './icons/UploadIcon';

interface AdvancedStudySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (file: UploadedFile) => void;
    learningHubFile: UploadedFile | null;
    notes: Note[];
}

const AdvancedStudySetupModal: React.FC<AdvancedStudySetupModalProps> = ({ isOpen, onClose, onStart, learningHubFile, notes }) => {
    const { t } = useLanguage();
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setSelectedNoteId(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleStartWithNote = () => {
        const note = notes.find(n => n.id === selectedNoteId);
        if (note) {
            // Convert note to UploadedFile format
            const noteFile: UploadedFile = {
                name: note.title,
                type: 'text/plain',
                size: new Blob([note.content]).size,
                base64: btoa(note.content), // Base64 encode content
                context: note.subject,
            };
            onStart(noteFile);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('studyModal.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Use Material from Learning Hub</h3>
                        {learningHubFile ? (
                            <button 
                                onClick={() => onStart(learningHubFile)}
                                className="w-full flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-2 border-green-500 rounded-lg hover:bg-green-100 dark:hover:bg-green-900"
                            >
                                <UploadIcon className="w-6 h-6 shrink-0" />
                                <div className="text-left">
                                    <p className="font-bold">Start with current material</p>
                                    <p className="text-sm truncate">{learningHubFile.name}</p>
                                </div>
                            </button>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No material is currently loaded in the Learning Hub.</p>
                        )}
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white dark:bg-gray-900 px-2 text-sm text-gray-500">OR</span>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Use a Note as Study Material</h3>
                        {notes.length > 0 ? (
                            <div className="space-y-2">
                                <select 
                                    value={selectedNoteId || ''}
                                    onChange={e => setSelectedNoteId(e.target.value)}
                                    className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                                >
                                    <option value="" disabled>Select a note...</option>
                                    {notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}
                                </select>
                                <button 
                                    onClick={handleStartWithNote}
                                    disabled={!selectedNoteId}
                                    className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                                >
                                    <BookIcon className="w-5 h-5"/>
                                    Start with Selected Note
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">You don't have any notes yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedStudySetupModal;
