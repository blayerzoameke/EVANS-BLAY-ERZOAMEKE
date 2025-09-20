
import React from 'react';
// FIX: Added .ts extension to import path.
import type { ActiveSession } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';

interface BreakViewProps {
    session: ActiveSession;
}

const getEmbedUrl = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            const videoId = urlObj.hostname.includes('youtu.be')
                ? urlObj.pathname.slice(1)
                : urlObj.searchParams.get('v');
            return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
        }
        // Can add more providers like vimeo, etc. later
        return url; // Default to the original url for other cases
    } catch (error) {
        console.error("Invalid URL for embedding:", url);
        return null;
    }
};

const BreakView: React.FC<BreakViewProps> = ({ session }) => {
    const { t } = useLanguage();
    const embedUrl = session.fromSlot.link ? getEmbedUrl(session.fromSlot.link) : null;

    if (!embedUrl) {
        return null; // Don't render if there's no valid link
    }
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 no-print">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-auto max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('breakview.title')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('breakview.body')}</p>
                </div>
                <div className="flex-1 bg-black">
                    <iframe
                        src={embedUrl}
                        title={session.subject}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        </div>
    );
};

export default BreakView;
