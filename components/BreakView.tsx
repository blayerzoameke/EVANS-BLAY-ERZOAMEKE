

import React, { useState, useEffect } from 'react';
import type { ActiveSession } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';

interface BreakViewProps {
    session: ActiveSession;
    setSession: (session: ActiveSession | null) => void;
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
        return url;
    } catch (error) {
        console.error("Invalid URL for embedding:", url);
        return null;
    }
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};


const BreakView: React.FC<BreakViewProps> = ({ session, setSession }) => {
    const { t } = useLanguage();
    const embedUrl = session.fromSlot.link ? getEmbedUrl(session.fromSlot.link) : null;
    const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.round((session.endTime - Date.now()) / 1000)));

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setSession(null); // End break session
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [session.endTime, setSession]);


    if (!embedUrl) {
        return null;
    }
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 no-print">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-auto max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('breakview.title')}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('breakview.body')}</p>
                    </div>
                    <div className="text-center">
                         <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                             {formatTime(timeLeft)}
                         </div>
                         <button onClick={() => setSession(null)} className="text-xs text-gray-500 hover:underline">
                             Skip Break
                         </button>
                    </div>
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