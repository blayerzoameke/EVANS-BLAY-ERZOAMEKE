import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { HistoryEntry, LearningHubState, QuizState, View } from '../types';

interface HistoryProps {
    history: HistoryEntry[];
    setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
    setView: (view: View) => void;
    setLearningHubState: React.Dispatch<React.SetStateAction<LearningHubState>>;
    setQuizState: React.Dispatch<React.SetStateAction<QuizState>>;
    addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type FilterType = 'all' | 'chat' | 'quiz';

// ── Relative time formatter ────────────────────────────────────────────────
const relativeTime = (isoDate: string): string => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ── Group entries by date ──────────────────────────────────────────────────
const groupByDate = (entries: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7 = today - 6 * 86400000;
    const last30 = today - 29 * 86400000;

    const groups: Record<string, HistoryEntry[]> = {
        'Today': [],
        'Yesterday': [],
        'Previous 7 days': [],
        'Previous 30 days': [],
        'Older': [],
    };

    entries.forEach(entry => {
        const t = new Date(entry.updatedAt).getTime();
        if (t >= today) groups['Today'].push(entry);
        else if (t >= yesterday) groups['Yesterday'].push(entry);
        else if (t >= last7) groups['Previous 7 days'].push(entry);
        else if (t >= last30) groups['Previous 30 days'].push(entry);
        else groups['Older'].push(entry);
    });

    return Object.entries(groups)
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => ({ label, items }));
};

const History: React.FC<HistoryProps> = ({
    history, setHistory, setView, setLearningHubState, setQuizState, addToast
}) => {
    const { t } = useLanguage();
    const [filter, setFilter] = useState<FilterType>('all');
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        let items = [...history].sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        if (filter !== 'all') items = items.filter(e => e.type === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(e =>
                e.title.toLowerCase().includes(q) ||
                e.documentName?.toLowerCase().includes(q) ||
                e.documentContext?.toLowerCase().includes(q) ||
                e.focusArea?.toLowerCase().includes(q)
            );
        }
        return items;
    }, [history, filter, search]);

    const grouped = useMemo(() => groupByDate(filtered), [filtered]);

    const handleContinueChat = (entry: HistoryEntry) => {
        if (!entry.chatHistory) return;
        // Full restore — set entire state fresh (not prev spread) so nothing bleeds in
        setLearningHubState({
            file: {
                name: entry.documentName || 'Restored Session',
                type: 'application/pdf',
                size: 0,
                base64: '',  // not stored — chat still works from history context
                context: entry.documentContext || '',
            },
            chatHistory: entry.chatHistory,
            analysisMode: 'chat',
            analysisResults: { summarize: null, explain: null, read: null, deep: null },
            isProcessing: false,
            processingMessage: '',
        });
        setView('uploadslides');
        addToast('✅ Session restored — all messages are here, continue chatting!', 'success');
    };

    const handleContinueQuiz = (entry: HistoryEntry) => {
        if (!entry.quiz || entry.quiz.length === 0) return;
        setQuizState({
            quiz: entry.quiz!,
            currentQuestionIndex: 0,
            userAnswers: [],
            feedback: null,
            summary: null,
            timerSeconds: null,
        });
        setView('examprep');
        addToast('Quiz reloaded — retaking from the beginning', 'success');
    };

    const handleDelete = (id: string) => {
        setHistory(prev => prev.filter(e => e.id !== id));
        setDeletingId(null);
        addToast('History item deleted', 'info');
    };

    const typeIcon = (type: HistoryEntry['type']) =>
        type === 'chat' ? '💬' : '🧠';

    const typeBadge = (entry: HistoryEntry) => {
        if (entry.type === 'chat') {
            return (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    Chat
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                Quiz
            </span>
        );
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="mb-6">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">History</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Your previous chat and quiz sessions — click any to continue
                </p>
                <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                    {t('history.limitNotice') || 'Note: To save storage, only your 15 most recent sessions are kept in History. Older sessions are automatically removed.'}
                </div>
            </div>

            {/* ── Search + Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search history…"
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
                    {(['all', 'chat', 'quiz'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize transition-all ${
                                filter === f
                                    ? 'bg-white dark:bg-gray-700 shadow text-primary'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            {f === 'all' ? 'All' : f === 'chat' ? '💬 Chats' : '🧠 Quizzes'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Empty state ── */}
            {grouped.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-6xl mb-4">🕐</div>
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
                        {search ? 'No results found' : 'No history yet'}
                    </h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                        {search
                            ? 'Try a different search term.'
                            : 'Start a chat in the Learning Hub or take a quiz in Exam Prep — your sessions will appear here.'}
                    </p>
                    {!search && (
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setView('uploadslides')}
                                className="px-4 py-2 text-sm font-bold bg-primary text-primary-text rounded-xl"
                            >
                                Go to Learning Hub
                            </button>
                            <button
                                onClick={() => setView('examprep')}
                                className="px-4 py-2 text-sm font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl"
                            >
                                Go to Exam Prep
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Grouped history entries ── */}
            <div className="space-y-8">
                {grouped.map(({ label, items }) => (
                    <div key={label}>
                        {/* Date group label */}
                        <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-1">
                            {label}
                        </h3>
                        <div className="space-y-2">
                            {items.map(entry => (
                                <div
                                    key={entry.id}
                                    className="group relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 hover:border-primary/30 hover:shadow-md transition-all duration-200"
                                >
                                    {/* Delete confirm overlay */}
                                    {deletingId === entry.id && (
                                        <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center gap-3 z-10 border-2 border-red-300 dark:border-red-700">
                                            <span className="text-sm font-bold text-red-600 dark:text-red-400">Delete this item?</span>
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="px-3 py-1.5 text-sm font-black bg-red-500 text-white rounded-lg hover:bg-red-600"
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(null)}
                                                className="px-3 py-1.5 text-sm font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3">
                                        {/* Icon */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl">
                                            {typeIcon(entry.type)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                {typeBadge(entry)}
                                                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                                    {relativeTime(entry.updatedAt)}
                                                </span>
                                            </div>

                                            <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug truncate">
                                                {entry.title}
                                            </p>

                                            {/* Metadata */}
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                {entry.type === 'chat' && entry.documentName && (
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        📄 {entry.documentName.length > 30
                                                            ? entry.documentName.substring(0, 30) + '…'
                                                            : entry.documentName}
                                                    </span>
                                                )}
                                                {entry.type === 'chat' && entry.chatHistory && (
                                                    <span className="text-xs text-gray-400">
                                                        {entry.chatHistory.length} message{entry.chatHistory.length !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {entry.type === 'chat' && entry.chatHistory && entry.chatHistory.length > 0 && (
                                                    <span className="text-xs text-gray-400 truncate max-w-xs italic">
                                                        "{entry.chatHistory[entry.chatHistory.length - 1].user.substring(0, 50)}{entry.chatHistory[entry.chatHistory.length - 1].user.length > 50 ? '…' : ''}"
                                                    </span>
                                                )}
                                                {entry.type === 'quiz' && entry.quiz && (
                                                    <span className="text-xs text-gray-400">
                                                        {entry.quiz.length} questions
                                                    </span>
                                                )}
                                                {entry.type === 'quiz' && entry.quizSummary && (
                                                    <span className={`text-xs font-black ${
                                                        entry.quizSummary.score >= 80 ? 'text-green-500' :
                                                        entry.quizSummary.score >= 50 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}>
                                                        {Math.round(entry.quizSummary.score)}% score
                                                    </span>
                                                )}
                                                {entry.focusArea && (
                                                    <span className="text-xs text-gray-400">
                                                        📌 {entry.focusArea}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions — visible on hover */}
                                        <div className="flex-shrink-0 flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => entry.type === 'chat'
                                                    ? handleContinueChat(entry)
                                                    : handleContinueQuiz(entry)
                                                }
                                                className="px-3 py-1.5 text-xs font-black bg-primary text-primary-text rounded-lg hover:bg-primary-dark transition-colors whitespace-nowrap"
                                            >
                                                {entry.type === 'chat' ? 'Continue →' : 'Retake →'}
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(entry.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Stats footer ── */}
            {history.length > 0 && (
                <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
                    <span>
                        {history.filter(e => e.type === 'chat').length} chat{history.filter(e => e.type === 'chat').length !== 1 ? 's' : ''} ·{' '}
                        {history.filter(e => e.type === 'quiz').length} quiz{history.filter(e => e.type === 'quiz').length !== 1 ? 'zes' : ''}
                    </span>
                    <button
                        onClick={() => {
                            if (confirm('Clear all history? This cannot be undone.')) {
                                setHistory([]);
                                addToast('History cleared', 'info');
                            }
                        }}
                        className="text-red-400 hover:text-red-500 font-bold transition-colors"
                    >
                        Clear all
                    </button>
                </div>
            )}
        </div>
    );
};

export default History;