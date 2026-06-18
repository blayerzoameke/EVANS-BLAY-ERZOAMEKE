import React, { useState, useEffect } from 'react';
import type { View } from '../types';

// ─── PWA Install Banner ────────────────────────────────────────────────────
interface PWAInstallBannerProps {
    addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ addToast }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Don't show if already installed as standalone PWA
        if (window.matchMedia('(display-mode: standalone)').matches) return;

        // Don't show if dismissed within 7 days
        const dismissed = localStorage.getItem('pwa_banner_dismissed');
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

        const ua = navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
        const isAndroid = /android/.test(ua);

        if (isIOS) setPlatform('ios');
        else if (isAndroid) setPlatform('android');

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setPlatform('android');
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('pwa_banner_dismissed', String(Date.now()));
        setIsDismissed(true);
    };

    const handleAndroidInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            addToast('EduBlay added to your home screen!', 'success');
            setIsDismissed(true);
            setDeferredPrompt(null);
        }
    };

    if (isDismissed || !platform) return null;
    if (platform === 'android' && !deferredPrompt) return null;

    return (
        <>
            <style>{`
                @keyframes pwa-slide-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes pwa-ios-up   { from{transform:translateY(100%)} to{transform:translateY(0)} }
                .pwa-banner { animation: pwa-slide-up 0.4s cubic-bezier(.22,1,.36,1) forwards; }
                .pwa-ios-sheet { animation: pwa-ios-up 0.4s cubic-bezier(.22,1,.36,1); }
            `}</style>

            {/* Android install banner */}
            {platform === 'android' && (
                <div className="pwa-banner fixed bottom-20 left-3 right-3 z-[200] lg:left-auto lg:right-6 lg:bottom-6 lg:w-96"
                    style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '16px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* App icon */}
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(37,99,235,0.5)' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="17" rx="3" stroke="white" strokeWidth="2"/>
                            <path d="M3 9h18M8 2v4M16 2v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'white', fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Install EduBlay</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500 }}>Add to home screen for the best experience</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        <button onClick={handleAndroidInstall}
                            style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
                            Install
                        </button>
                        <button onClick={handleDismiss}
                            style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            Not now
                        </button>
                    </div>
                </div>
            )}

            {/* iOS banner tap-to-guide */}
            {platform === 'ios' && !showIOSGuide && (
                <div className="pwa-banner fixed bottom-20 left-3 right-3 z-[200] lg:left-auto lg:right-6 lg:bottom-6 lg:w-96"
                    style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '16px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onClick={() => setShowIOSGuide(true)}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="17" rx="3" stroke="white" strokeWidth="2"/>
                            <path d="M3 9h18M8 2v4M16 2v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ color: 'white', fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Add to Home Screen</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Tap to see how →</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                </div>
            )}

            {/* iOS step-by-step bottom sheet */}
            {platform === 'ios' && showIOSGuide && (
                <div onClick={() => setShowIOSGuide(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div className="pwa-ios-sheet" onClick={e => e.stopPropagation()}
                        style={{ background: 'linear-gradient(160deg,#1e293b,#0f172a)', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.12)', padding: '32px 28px 48px', width: '100%', maxWidth: 480 }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 28px' }} />
                        <div style={{ textAlign: 'center', marginBottom: 28 }}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
                            <h3 style={{ color: 'white', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 6 }}>Add EduBlay to Home Screen</h3>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>Follow these steps in Safari to install EduBlay as an app.</p>
                        </div>
                        {[
                            ['↑', 'Tap the Share button', 'The box with an arrow at the bottom of your Safari browser.'],
                            ['+', '"Add to Home Screen"', 'Scroll down in the share sheet and tap this option.'],
                            ['✓', 'Tap "Add"', 'Confirm in the top right. EduBlay will appear on your home screen!'],
                        ].map(([icon, title, desc]) => (
                            <div key={title} style={{ display: 'flex', gap: 14, marginBottom: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 15 }}>{icon}</div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
                                </div>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                            <button onClick={() => { handleDismiss(); setShowIOSGuide(false); }}
                                style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14 }}>
                                Dismiss
                            </button>
                            <button onClick={() => setShowIOSGuide(false)}
                                style={{ flex: 2, padding: '14px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 12, cursor: 'pointer', color: 'white', fontWeight: 800, fontSize: 15, boxShadow: '0 6px 20px rgba(37,99,235,0.4)' }}>
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Mobile Bottom Nav ─────────────────────────────────────────────────────
interface MobileBottomNavProps {
    view: View;
    setView: (view: View) => void;
    unreadFeedbackCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ view, setView, unreadFeedbackCount = 0 }) => {
    const tabs: { id: View; icon: React.ReactNode; label: string }[] = [
        {
            id: 'dashboard',
            label: 'Home',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12L12 3l9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            ),
        },
        {
            id: 'mytimetables',
            label: 'Schedule',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            ),
        },
        {
            id: 'uploadslides',
            label: 'Learn',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2"/>
                </svg>
            ),
        },
        {
            id: 'examprep',
            label: 'Exam',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            ),
        },
        {
            id: 'notes',
            label: 'Notes',
            icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            ),
        },
    ];

    return (
        <>
            <style>{`
                .mob-nav-bar { padding-bottom: env(safe-area-inset-bottom, 0px); }
                .mob-nav-tab-active { color: #0284c7; }
                .mob-nav-tab-inactive { color: #6b7280; }
                .dark .mob-nav-tab-inactive { color: #9ca3af; }
            `}</style>
            <nav className="mob-nav-bar lg:hidden fixed bottom-0 left-0 right-0 z-[150] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
                style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', height: 60 }}>
                    {tabs.map((tab) => {
                        const isActive = view === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id)}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s ease' }}
                                className={isActive ? 'mob-nav-tab-active' : 'mob-nav-tab-inactive'}
                            >
                                {/* Active indicator pill */}
                                {isActive && (
                                    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3, borderRadius: '0 0 3px 3px', background: '#0284c7' }} />
                                )}
                                {/* Unread badge for feedback-related tabs */}
                                <div style={{ position: 'relative' }}>
                                    {tab.icon}
                                    {tab.id === 'notes' && unreadFeedbackCount > 0 && (
                                        <div style={{ position: 'absolute', top: -4, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: 'white', border: '2px solid white' }}>
                                            {unreadFeedbackCount > 9 ? '9+' : unreadFeedbackCount}
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};