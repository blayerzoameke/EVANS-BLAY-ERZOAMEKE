import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ActiveSession } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ExpandIcon } from './icons/ExpandIcon';

interface BreakViewProps {
    session: ActiveSession;
    onEnd: (skipped: boolean) => void;
}

// UNIVERSAL URL HANDLER - Supports ALL platforms
const getEmbedUrl = (url: string): { embedUrl: string; canEmbed: boolean; platform: string } => {
    if (!url) return { embedUrl: '', canEmbed: false, platform: 'none' };
    
    let fullUrl = url.trim();
    // Prepend protocol if missing
    if (!/^https?:\/\//i.test(fullUrl)) {
        fullUrl = `https://${fullUrl}`;
    }

    try {
        const urlObj = new URL(fullUrl);
        const hostname = urlObj.hostname.toLowerCase();
        
        // ==================== EMBEDDABLE PLATFORMS ====================
        
        // YouTube - Full embed support
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            const videoId = hostname.includes('youtu.be')
                ? urlObj.pathname.slice(1)
                : urlObj.searchParams.get('v');
            return {
                embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${window.location.origin}` : fullUrl,
                canEmbed: true,
                platform: 'YouTube'
            };
        }

        // TikTok - Embed support
        if (hostname.includes('tiktok.com')) {
            const pathParts = urlObj.pathname.split('/');
            const videoId = pathParts.find(part => /^\d{10,20}$/.test(part));
            if (videoId) {
                return {
                    embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
                    canEmbed: true,
                    platform: 'TikTok'
                };
            }
            // Fallback to direct link if no video ID found
            return { embedUrl: fullUrl, canEmbed: true, platform: 'TikTok' };
        }

        // Spotify - Full embed support
        if (hostname.includes('spotify.com')) {
            const path = urlObj.pathname;
            if (path.startsWith('/track/') || path.startsWith('/album/') || path.startsWith('/playlist/') || path.startsWith('/episode/') || path.startsWith('/show/')) {
                return {
                    embedUrl: `https://open.spotify.com/embed${path}`,
                    canEmbed: true,
                    platform: 'Spotify'
                };
            }
            return { embedUrl: fullUrl, canEmbed: true, platform: 'Spotify' };
        }

        // Apple Music - Embed support
        if (hostname.includes('music.apple.com')) {
            return {
                embedUrl: `https://embed.music.apple.com${urlObj.pathname}${urlObj.search}`,
                canEmbed: true,
                platform: 'Apple Music'
            };
        }

        // Vimeo - Full embed support
        if (hostname.includes('vimeo.com')) {
            const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
            return {
                embedUrl: videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : fullUrl,
                canEmbed: true,
                platform: 'Vimeo'
            };
        }

        // Dailymotion
        if (hostname.includes('dailymotion.com') || hostname.includes('dai.ly')) {
            const videoId = hostname.includes('dai.ly') 
                ? urlObj.pathname.slice(1)
                : urlObj.pathname.split('/video/')[1]?.split('_')[0];
            return {
                embedUrl: videoId ? `https://www.dailymotion.com/embed/video/${videoId}?autoplay=1` : fullUrl,
                canEmbed: true,
                platform: 'Dailymotion'
            };
        }

        // Twitch - Live streams and VODs
        if (hostname.includes('twitch.tv')) {
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts[0] === 'videos' && pathParts[1]) {
                // VOD
                return {
                    embedUrl: `https://player.twitch.tv/?video=${pathParts[1]}&parent=${window.location.hostname}&autoplay=true`,
                    canEmbed: true,
                    platform: 'Twitch'
                };
            } else if (pathParts[0]) {
                // Live channel
                return {
                    embedUrl: `https://player.twitch.tv/?channel=${pathParts[0]}&parent=${window.location.hostname}&autoplay=true`,
                    canEmbed: true,
                    platform: 'Twitch'
                };
            }
        }

        // SoundCloud
        if (hostname.includes('soundcloud.com')) {
            return {
                embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(fullUrl)}&auto_play=true`,
                canEmbed: true,
                platform: 'SoundCloud'
            };
        }

        // Instagram - Open in new tab (embed restricted by Instagram)
        if (hostname.includes('instagram.com')) {
            return {
                embedUrl: fullUrl,
                canEmbed: false,
                platform: 'Instagram'
            };
        }

        // Twitter/X - Open in new tab (embed limitations)
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return {
                embedUrl: fullUrl,
                canEmbed: false,
                platform: 'Twitter/X'
            };
        }

        // Snapchat - Open in new tab (no embed support)
        if (hostname.includes('snapchat.com')) {
            return {
                embedUrl: fullUrl,
                canEmbed: false,
                platform: 'Snapchat'
            };
        }

        // Facebook - Open in new tab (embed restricted)
        if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
            return {
                embedUrl: fullUrl,
                canEmbed: false,
                platform: 'Facebook'
            };
        }

        // Netflix, Disney+, etc. - Open in new tab
        if (hostname.includes('netflix.com') || hostname.includes('disneyplus.com') || hostname.includes('hulu.com') || hostname.includes('hbo.com') || hostname.includes('primevideo.com')) {
            return {
                embedUrl: fullUrl,
                canEmbed: false,
                platform: 'Streaming Service'
            };
        }

        // Reddit
        if (hostname.includes('reddit.com')) {
            return {
                embedUrl: fullUrl,
                canEmbed: false,
                platform: 'Reddit'
            };
        }

        // ==================== GENERIC WEBSITES ====================
        // Try to embed any other website (many will work!)
        return {
            embedUrl: fullUrl,
            canEmbed: true, // Try embedding first, fallback if it fails
            platform: 'Website'
        };

    } catch (error) {
        console.error("Invalid URL for embedding:", url, error);
        return { embedUrl: '', canEmbed: false, platform: 'Invalid' };
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
    const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.round((session.endTime - Date.now()) / 1000)));
    const [embedFailed, setEmbedFailed] = useState(false);
    
    const urlData = session.fromSlot.link ? getEmbedUrl(session.fromSlot.link) : { embedUrl: '', canEmbed: false, platform: 'none' };
    const { embedUrl, canEmbed, platform } = urlData;

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
            } else if ((iframeRef.current as any).mozRequestFullScreen) {
                (iframeRef.current as any).mozRequestFullScreen();
            } else if ((iframeRef.current as any).webkitRequestFullscreen) {
                (iframeRef.current as any).webkitRequestFullscreen();
            } else if ((iframeRef.current as any).msRequestFullscreen) {
                (iframeRef.current as any).msRequestFullscreen();
            }
        }
    };

    const openInNewTab = () => {
        if (embedUrl) {
            window.open(embedUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const handleIframeError = () => {
        setEmbedFailed(true);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[110] no-print">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-auto max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                            {session.fromSlot.activity || t('breakview.title')}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {embedUrl ? `${t('breakview.body')} • ${platform}` : t('breakview.body')}
                        </p>
                    </div>
                    <div className="flex items-center justify-end w-full sm:w-auto gap-4">
                        {embedUrl && (
                            <div className="flex gap-2">
                                {canEmbed && !embedFailed && (
                                    <button 
                                        onClick={handleFullscreen} 
                                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
                                        title="Fullscreen"
                                    >
                                        <ExpandIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    </button>
                                )}
                                <button 
                                    onClick={openInNewTab}
                                    className="px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                    title="Open in new tab"
                                >
                                    Open ↗
                                </button>
                            </div>
                        )}
                        <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                {formatTime(timeLeft)}
                            </div>
                            <button 
                                onClick={() => handleEnd(true)} 
                                className="text-xs text-gray-500 hover:underline"
                            >
                                {t('breakview.skip')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                    {embedUrl && canEmbed && !embedFailed ? (
                        // Try to embed
                        <iframe
                            ref={iframeRef}
                            src={embedUrl}
                            title={session.fromSlot.activity || t('breakview.title')}
                            className="w-full h-full"
                            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope"
                            allowFullScreen
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
                            onError={handleIframeError}
                        />
                    ) : embedUrl && (!canEmbed || embedFailed) ? (
                        // Can't embed - show "Open in new tab" message
                        <div className="text-center text-white p-8 max-w-md">
                            <div className="mb-6">
                                <svg className="w-24 h-24 mx-auto mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold mb-3">{platform}</h3>
                            <p className="text-gray-300 mb-6">
                                {platform === 'Instagram' && 'Instagram content needs to be viewed directly on their platform.'}
                                {platform === 'Twitter/X' && 'Twitter/X content needs to be viewed directly on their platform.'}
                                {platform === 'Snapchat' && 'Snapchat content needs to be viewed in their app or website.'}
                                {platform === 'Facebook' && 'Facebook content needs to be viewed directly on their platform.'}
                                {platform === 'Streaming Service' && 'This streaming service requires you to view content on their platform.'}
                                {platform === 'Reddit' && 'Reddit content needs to be viewed directly on their platform.'}
                                {(platform === 'Website' || embedFailed) && 'This website cannot be embedded. Click below to open it in a new tab.'}
                            </p>
                            <button
                                onClick={openInNewTab}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold inline-flex items-center gap-2"
                            >
                                <span>Open {platform}</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </button>
                            <p className="text-xs text-gray-400 mt-4">
                                The link will open in a new tab
                            </p>
                        </div>
                    ) : (
                        // No URL - default break screen
                        <div className="text-center text-white p-8">
                            <div className="mb-6">
                                <svg className="w-24 h-24 mx-auto mb-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-bold mb-4">{t('breakview.title')}</h3>
                            <p className="text-lg text-gray-300">{t('breakview.body')}</p>
                            <p className="text-sm text-gray-400 mt-4">
                                Enjoy your break! Time to relax and recharge.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BreakView;