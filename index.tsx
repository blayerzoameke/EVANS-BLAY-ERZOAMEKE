import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ColorThemeProvider } from './contexts/ColorThemeContext';
import { registerSW } from 'virtual:pwa-register';

// ── Theme flash prevention (runs before React renders) ────────────────────
try {
    const saved = localStorage.getItem('theme');
    const dark = saved === 'dark' ||
        ((!saved || saved === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
} catch {}

// ── Error boundary ─────────────────────────────────────────────────────────
// Without this, any runtime error during render unmounts the whole tree and
// the user just sees a blank page (and refreshing hits the same error). This
// shows a friendly recovery screen instead, and logs the error to the console
// so issues are diagnosable rather than silently blank.
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; message: string }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, message: error?.message || 'Something went wrong.' };
    }

    componentDidCatch(error: any, info: any) {
        console.error('[EduBlay] Uncaught render error:', error, info);
    }

    componentDidMount() {
        if (this.state.hasError) {
            this.attemptRecovery();
        }
    }

    componentDidUpdate(prevProps: any, prevState: any) {
        if (this.state.hasError && !prevState.hasError) {
            this.attemptRecovery();
        }
    }

    async attemptRecovery() {
        try {
            const recovered = sessionStorage.getItem('eb_recovered');
            if (!recovered) {
                sessionStorage.setItem('eb_recovered', '1');
                if ('caches' in window) {
                    const names = await caches.keys();
                    await Promise.all(names.map(name => caches.delete(name)));
                }
                localStorage.clear();
                window.location.reload();
            }
        } catch (e) {}
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '24px',
                    background: '#0f172a',
                    color: '#e5e7eb',
                    fontFamily: 'system-ui, sans-serif',
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 18,
                        background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: 22, color: 'white', marginBottom: 18,
                    }}>EB</div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>EduBlay hit a snag</h1>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', maxWidth: 360, marginBottom: 8 }}>
                        Something stopped the app from loading.
                    </p>
                    <div style={{
                        background: 'rgba(255,100,100,0.1)',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,100,100,0.2)',
                        color: '#fca5a5',
                        fontSize: '12px',
                        maxWidth: '90%',
                        overflowWrap: 'break-word',
                        marginBottom: 20,
                        fontFamily: 'monospace'
                    }}>
                        {this.state.message || "Unknown error"}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white',
                                fontSize: 15, fontWeight: 700,
                            }}
                        >
                            Reload EduBlay
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    if ('caches' in window) {
                                        const names = await caches.keys();
                                        await Promise.all(names.map(name => caches.delete(name)));
                                    }
                                } catch (e) {}
                                try { sessionStorage.clear(); } catch (e) {}
                                try { localStorage.clear(); } catch (e) {}
                                window.location.reload();
                            }}
                            style={{
                                padding: '12px 28px', borderRadius: 12, cursor: 'pointer',
                                background: 'transparent', color: 'rgba(255,255,255,0.7)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                fontSize: 13, fontWeight: 600,
                            }}
                        >
                            Clear Cache & Reload
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <ColorThemeProvider>
                    <LanguageProvider>
                        <App />
                    </LanguageProvider>
                </ColorThemeProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </React.StrictMode>
);

// ── PWA registration — guarded for iframes and Lovable preview ────────────
const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost =
    window.location.hostname.includes('id-preview--') ||
    window.location.hostname.includes('lovableproject.com') ||
    window.location.hostname.includes('lovable.app');

if (isInIframe || isPreviewHost) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
} else if ('serviceWorker' in navigator) {
    registerSW({
        // ── CRITICAL FIX: immediate:true causes iOS Chrome blank screen ──
        // When immediate:true, the SW activates instantly and calls clients.claim()
        // which forces ALL open tabs to reload → iOS Chrome shows blank white screen
        // after login. immediate:false lets SW update on next natural page load.
        immediate: false,
        onNeedRefresh() {
            // New SW available — store flag and dispatch custom event
            localStorage.setItem('pwa_update_available', 'true');
            window.dispatchEvent(new Event('pwa_update_detected'));
            console.log('[PWA] Update detected! New service worker available.');
        },
        onOfflineReady() {
            console.log('[PWA] EduBlay ready to work offline ✅');
        },
        onRegistered(reg) {
            console.log('[PWA] Service worker registered', reg?.scope);
        },
        onRegisterError(err) {
            console.error('[PWA] Service worker registration failed', err);
        },
    });
}