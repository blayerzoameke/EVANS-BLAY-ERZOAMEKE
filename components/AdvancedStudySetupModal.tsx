
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon } from './icons/CloseIcon';
import type { Note } from '../types.ts';

interface AdvancedStudySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (config: { subject: string; duration: number; selectedNoteId?: string }) => void;
    fileContext?: string;
    notes: Note[];
}

const AdvancedStudySetupModal: React.FC<AdvancedStudySetupModalProps> = ({ isOpen, onClose, onStart, fileContext, notes }) => {
    const { t } = useLanguage();
    const [subject, setSubject] = useState(fileContext || '');
    const [duration, setDuration] = useState(50);
    const [studySource, setStudySource] = useState('document');
    const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (isOpen) {
            setSubject(fileContext || '');
            setStudySource(fileContext ? 'document' : 'note');
            setSelectedNoteId(notes.length > 0 ? notes[0].id : undefined);
        }
    }, [isOpen, fileContext, notes]);

    if (!isOpen) {
        return null;
    }
    
    const handleStart = () => {
        let finalSubject = subject.trim();
        if (studySource === 'note' && selectedNoteId) {
            const note = notes.find(n => n.id === selectedNoteId);
            finalSubject = note?.title || 'Note Study';
        }
        
        if (finalSubject && duration > 0) {
            onStart({ subject: finalSubject, duration, selectedNoteId: studySource === 'note' ? selectedNoteId : undefined });
        }
    };

    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('advancedStudy.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('advancedStudy.source')}</label>
                        <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-gray-100 dark:bg-gray-800 p-1">
                            {fileContext && (
                                <button onClick={() => setStudySource('document')} className={`px-3 py-1.5 text-sm font-medium rounded ${studySource === 'document' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}>{t('advancedStudy.source.document')}</button>
                            )}
                            <button onClick={() => setStudySource('note')} className={`px-3 py-1.5 text-sm font-medium rounded ${studySource === 'note' ? 'bg-white dark:bg-gray-700 shadow' : ''} ${!fileContext ? 'col-span-2' : ''}`}>{t('advancedStudy.source.note')}</button>
                        </div>
                    </div>

                    {studySource === 'document' && (
                        <div>
                            <label htmlFor="study-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('advancedStudy.subject')}</label>
                            <input type="text" id="study-subject" value={subject} onChange={e => setSubject(e.target.value)} className={`${inputClasses} mt-1`} placeholder={t('advancedStudy.subject.placeholder')} />
                        </div>
                    )}

                    {studySource === 'note' && (
                         <div>
                            <label htmlFor="note-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('advancedStudy.selectNote')}</label>
                            <select id="note-select" value={selectedNoteId} onChange={e => setSelectedNoteId(e.target.value)} className={`${inputClasses} mt-1`}>
                                {notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label htmlFor="study-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('advancedStudy.duration')}</label>
                        <input type="number" id="study-duration" value={duration} onChange={e => setDuration(parseInt(e.target.value, 10) || 0)} className={`${inputClasses} mt-1`} min="1" />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                    <button onClick={handleStart} disabled={duration <= 0 || (studySource === 'document' && !subject.trim()) || (studySource === 'note' && !selectedNoteId)} className="w-full py-3 px-4 rounded-lg text-md font-semibold transition-colors bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400">
                        {t('advancedStudy.start')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedStudySetupModal;
