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

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <ThemeProvider>
            <ColorThemeProvider>
                <LanguageProvider>
                    <App />
                </LanguageProvider>
            </ColorThemeProvider>
        </ThemeProvider>
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