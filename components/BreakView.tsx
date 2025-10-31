import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ActiveSession } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ExpandIcon } from './icons/ExpandIcon';

interface BreakViewProps {
    session: ActiveSession;
    onEnd: (skipped: boolean) => void;
}

const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    let fullUrl = url.trim();
    // Prepend protocol if missing for better parsing
    if (!/^https?:\/\//i.test(fullUrl)) {
        fullUrl = `https://` + fullUrl;
    }

    try {
        const urlObj = new URL(fullUrl);
        const hostname = urlObj.hostname.toLowerCase();
        
        // YouTube
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            const videoId = hostname.includes('youtu.be')
                ? urlObj.pathname.slice(1)
                : urlObj.searchParams.get('v');
            // Ensure we return an embeddable URL with autoplay
            return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : fullUrl;
        }

        // TikTok - Use the simpler /embed/ path and more robust ID finding
        if (hostname.includes('tiktok.com')) {
            const pathParts = urlObj.pathname.split('/');
            // Find the numeric video ID in the path
            const videoId = pathParts.find(part => /^\d{10,20}$/.test(part)); // TikTok IDs are typically 19 digits long
            if (videoId) {
                return `https://www.tiktok.com/embed/${videoId}`;
            }
            return fullUrl; // Fallback for other TikTok links (e.g., profiles), which likely won't embed
        }

        // Spotify
        if (hostname.includes('spotify.com')) {
            const path = urlObj.pathname;
            if (path.startsWith('/track/') || path.startsWith('/album/') || path.startsWith('/playlist/')) {
                // Spotify's embed URL is `open.spotify.com/embed/` + type + id
                return `https://open.spotify.com/embed${path}`;
            }
            return fullUrl; // Fallback for other Spotify links
        }

        // Apple Music
        if (hostname.includes('music.apple.com')) {
            // Apple Music's embed URL is `embed.music.apple.com/` + rest of path
            return `https://embed.music.apple.com${urlObj.pathname}${urlObj.search}`;
        }


        // For any other valid URL, return it to be iframed.
        return fullUrl;
    } catch (error) {
        console.error("Invalid URL for embedding:", url, error);
        // Return null for invalid URLs to show default break screen
        return null; 
    }
};

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};


const BreakView: React.FC<BreakViewProps> = ({ session, onEnd }) => {
    const { t } = useLanguage();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const embedUrl = session.fromSlot.link ? getEmbedUrl(session.fromSlot.link) : null;
    const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.round((session.endTime - Date.now()) / 1000)));

    const handleEnd = useCallback((skipped = false) => {
        onEnd(skipped);
    }, [onEnd]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleEnd(false); // Natural end
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [handleEnd]);
    
    const handleFullscreen = () => {
        if (iframeRef.current) {
            if (iframeRef.current.requestFullscreen) {
                iframeRef.current.requestFullscreen();
            } else if ((iframeRef.current as any).mozRequestFullScreen) { // Firefox
                (iframeRef.current as any).mozRequestFullScreen();
            } else if ((iframeRef.current as any).webkitRequestFullscreen) { // Chrome, Safari & Opera
                (iframeRef.current as any).webkitRequestFullscreen();
            } else if ((iframeRef.current as any).msRequestFullscreen) { // IE/Edge
                (iframeRef.current as any).msRequestFullscreen();
            }
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[110] no-print">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-auto max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{session.fromSlot.activity || t('breakview.title')}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('breakview.body')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {embedUrl && (
                            <button onClick={handleFullscreen} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="Enlarge">
                                <ExpandIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        )}
                        <div className="text-center">
                             <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                 {formatTime(timeLeft)}
                             </div>
                             <button onClick={() => handleEnd(true)} className="text-xs text-gray-500 hover:underline">
                                 {t('breakview.skip')}
                             </button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-black flex items-center justify-center">
                    {embedUrl ? (
                        <iframe
                            ref={iframeRef}
                            src={embedUrl}
                            title={session.fromSlot.activity || t('breakview.title')}
                            className="w-full h-full"
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    ) : (
                        <div className="text-center text-white p-8">
                            <h3 className="text-3xl font-bold mb-4">{t('breakview.title')}</h3>
                            <p className="text-lg">{t('breakview.body')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BreakView;