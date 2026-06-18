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
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', maxWidth: 360, marginBottom: 20 }}>
                        Something stopped the app from loading. Reloading usually fixes it.
                    </p>
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
            // New SW available — apply silently on next visit, no forced reload
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