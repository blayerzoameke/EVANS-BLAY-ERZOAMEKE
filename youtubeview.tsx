import React, { useState } from 'react';

interface YouTubeThumbnailProps {
    videoUrl: string;
    className?: string;
}

const YouTubeThumbnail: React.FC<YouTubeThumbnailProps> = ({ videoUrl, className = '' }) => {
    const [showPlayer, setShowPlayer] = useState(false);
    const [thumbnailError, setThumbnailError] = useState(false);
    
    // Extract video ID from YouTube URL
    const getVideoId = (url: string): string | null => {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            // Handle youtu.be links
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }
            // Handle youtube.com links
            if (urlObj.hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }
            return null;
        } catch {
            return null;
        }
    };
    
    const videoId = getVideoId(videoUrl);
    
    if (!videoId) {
        return (
            <div className={`w-full aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center ${className}`}>
                <p className="text-gray-500 dark:text-gray-400">Invalid YouTube URL</p>
            </div>
        );
    }
    
    // Try maxresdefault first, fallback to hqdefault if it fails
    const thumbnailUrl = thumbnailError 
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    
    if (showPlayer) {
        return (
            <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl ${className}`}>
                <iframe
                    src={embedUrl}
                    title="YouTube video player"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ border: 'none' }}
                />
            </div>
        );
    }
    
    return (
        <div 
            onClick={() => setShowPlayer(true)}
            className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden cursor-pointer group shadow-xl hover:shadow-2xl transition-shadow ${className}`}
        >
            {/* Thumbnail Image */}
            <img 
                src={thumbnailUrl} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
                onError={() => {
                    if (!thumbnailError) {
                        setThumbnailError(true);
                    }
                }}
            />
            
            {/* Dark Overlay on Hover */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                {/* Play Button */}
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            </div>
            
            {/* YouTube Logo Badge (optional) */}
            <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded text-xs font-bold shadow-md">
                YouTube
            </div>
            
            {/* Click to Play Text (optional) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Click to play
            </div>
        </div>
    );
};

export default YouTubeThumbnail;