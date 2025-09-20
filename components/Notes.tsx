

import React, { useState, useEffect } from 'react';
// FIX: Added .ts extension to import path.
import type { Note } from '../types.ts';
import { StarIcon } from './icons/StarIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmationModal from './ConfirmationModal.tsx';

// FIX: Added props interface to accept state from App.tsx
interface NotesProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
}

// FIX: Changed to a controlled component accepting props
const Notes: React.FC<NotesProps> = ({ notes, setNotes }) => {
    const [currentNote, setCurrentNote] = useState<Note | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const { t } = useLanguage();

    // FIX: Removed local state management and localStorage logic, now handled by App.tsx.
    // This useEffect handles selecting a note when the component mounts or notes change.
    useEffect(() => {
        if (notes.length > 0 && !currentNote) {
            setCurrentNote(notes[0]);
        }
        if (currentNote && !notes.find(n => n.id === currentNote.id)) {
            setCurrentNote(notes[0] || null);
        }
    }, [notes, currentNote]);

    const saveNotes = (updatedNotes: Note[]) => {
        setNotes(updatedNotes);
    };

    const createNewNote = () => {
        const newNote: Note = {
            id: Date.now().toString(),
            title: t('notes.newNote'),
            content: '',
            subject: 'General',
            createdAt: new Date().toISOString(),
            isFavourite: false,
        };
        saveNotes([newNote, ...notes]);
        setCurrentNote(newNote);
    };

    const updateNote = (field: keyof Note, value: any) => {
        if (currentNote) {
            const updatedNote = { ...currentNote, [field]: value };
            setCurrentNote(updatedNote);
            const updatedNotes = notes.map(n => n.id === currentNote.id ? updatedNote : n);
            saveNotes(updatedNotes);
        }
    };

    const handleDeleteRequest = (note: Note) => {
        setNoteToDelete(note);
    };
    
    const confirmDeleteNote = () => {
        if (!noteToDelete) return;
        
        const updatedNotes = notes.filter(n => n.id !== noteToDelete.id);
        saveNotes(updatedNotes);
        
        if (currentNote?.id === noteToDelete.id) {
            setCurrentNote(updatedNotes[0] || null);
        }
        setNoteToDelete(null);
    };

    const toggleFavourite = (id: string) => {
        const updatedNotes = notes.map(n => n.id === id ? { ...n, isFavourite: !n.isFavourite } : n);
        saveNotes(updatedNotes);
        if (currentNote?.id === id) {
             setCurrentNote(n => n ? {...n, isFavourite: !n.isFavourite} : null);
        }
    }

    const filteredNotes = notes.filter(note => 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => (b.isFavourite ? 1 : 0) - (a.isFavourite ? 1 : 0));

    return (
        <>
            <div className="flex h-[calc(100vh-10rem)] max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden border dark:border-gray-700">
                {/* Sidebar */}
                <div className="w-1/3 border-r dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b dark:border-gray-700">
                        <input
                            type="search"
                            placeholder={t('notes.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredNotes.map(note => (
                            <div
                                key={note.id}
                                onClick={() => setCurrentNote(note)}
                                className={`p-4 cursor-pointer border-l-4 ${currentNote?.id === note.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                <h4 className="font-bold truncate text-gray-800 dark:text-gray-200">{note.title}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{note.subject}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t dark:border-gray-700">
                        <button onClick={createNewNote} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800">
                            <PlusIcon className="w-4 h-4"/> {t('notes.newNote')}
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="w-2/3 flex flex-col">
                    {currentNote ? (
                        <>
                            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                                <input
                                    type="text"
                                    value={currentNote.title}
                                    onChange={(e) => updateNote('title', e.target.value)}
                                    className="text-xl font-bold bg-transparent focus:outline-none w-full text-gray-800 dark:text-gray-200"
                                />
                                <div className="flex items-center gap-2">
                                    <button onClick={() => toggleFavourite(currentNote.id)} className={`p-2 rounded-full ${currentNote.isFavourite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}>
                                        <StarIcon className={`w-5 h-5 ${currentNote.isFavourite ? 'fill-current' : ''}`} />
                                    </button>
                                    <button onClick={() => handleDeleteRequest(currentNote)} className="p-2 text-gray-400 hover:text-red-500 rounded-full">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 border-b dark:border-gray-700">
                                <input
                                    type="text"
                                    placeholder={t('notes.subject')}
                                    value={currentNote.subject}
                                    onChange={(e) => updateNote('subject', e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-3 py-1"
                                />
                            </div>
                            <div className="flex-1 p-4">
                                <textarea
                                    value={currentNote.content}
                                    onChange={(e) => updateNote('content', e.target.value)}
                                    className="w-full h-full resize-none bg-transparent focus:outline-none text-gray-700 dark:text-gray-300"
                                    placeholder={t('notes.writePlaceholder')}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                            <div>
                                <p>{t('notes.selectOrCreate')}</p>
                                <button onClick={createNewNote} className="text-blue-700 dark:text-blue-500 hover:underline">{t('notes.createNew')}</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
             {noteToDelete && (
                <ConfirmationModal
                    isOpen={!!noteToDelete}
                    onClose={() => setNoteToDelete(null)}
                    onConfirm={confirmDeleteNote}
                    title={t('confirmation.deleteNote.title')}
                    message={t('confirmation.deleteNote.message', { title: noteToDelete.title })}
                    confirmText={t('common.delete')}
                    confirmColor="red"
                />
            )}
        </>
    );
};

export default Notes;
