import React, { useEffect, useState } from 'react';
import { appUpdateService, AppVersionData } from '../services/appUpdateService';
import { ArrowUpCircle, RefreshCw, AlertTriangle, Sparkles, X } from 'lucide-react';

interface AppUpdateNotificationProps {
  onLogout: () => Promise<void>;
  isLoggedIn: boolean;
}

export const AppUpdateNotification: React.FC<AppUpdateNotificationProps> = ({ onLogout, isLoggedIn }) => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateDetails, setUpdateDetails] = useState<AppVersionData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isBannerHidden, setIsBannerHidden] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentLocalVersion] = useState(() => appUpdateService.getCurrentLocalVersion());

  // Subscribe to updates on mount
  useEffect(() => {
    // 1. Check local PWA service worker state
    const checkPwaFlag = () => {
      const pwaAvailable = localStorage.getItem('pwa_update_available') === 'true';
      if (pwaAvailable) {
        setHasUpdate(true);
        setUpdateDetails(prev => ({
          currentVersion: 'New Build',
          releaseNotes: 'Performance improvements, bug fixes and updated features.',
          ...prev
        }));
      }
    };

    checkPwaFlag();

    // 2. Listen for service worker detected event from index.tsx
    const handlePwaUpdateEvent = () => {
      setHasUpdate(true);
      checkPwaFlag();
    };

    window.addEventListener('pwa_update_detected', handlePwaUpdateEvent);

    // 3. Listen to real-time Firestore version changes
    const unsubscribe = appUpdateService.subscribeToAppVersion((firestoreData) => {
      const localVer = appUpdateService.getCurrentLocalVersion();
      const confirmedVer = localStorage.getItem('eb_last_updated_confirmed_version');

      // If they already clicked update and successfully confirmed this specific version, never show it again
      if (firestoreData.currentVersion && firestoreData.currentVersion === confirmedVer) {
        setHasUpdate(false);
        return;
      }

      // If Firestore version doesn't match our local version, trigger update
      if (firestoreData.currentVersion && firestoreData.currentVersion !== localVer) {
        setHasUpdate(true);
        setUpdateDetails(firestoreData);
        localStorage.setItem('eb_app_update_available', 'true');
        localStorage.setItem('eb_app_update_version', firestoreData.currentVersion);
      } else {
        setHasUpdate(false);
        localStorage.removeItem('eb_app_update_available');
        localStorage.removeItem('eb_app_update_version');
      }
    });

    // Check if user previously clicked "Later" in this session
    const previouslyDismissed = sessionStorage.getItem('eb_update_dismissed') === 'true';
    if (previouslyDismissed) {
      setIsDismissed(true);
    }

    // 4. Periodically monitor the hidden banner reminder cooldown (remind in 3 minutes)
    const checkHiddenBanner = () => {
      const hiddenUntilStr = sessionStorage.getItem('eb_banner_hidden_until');
      if (hiddenUntilStr) {
        const hiddenUntil = parseInt(hiddenUntilStr, 10);
        if (Date.now() < hiddenUntil) {
          setIsBannerHidden(true);
        } else {
          setIsBannerHidden(false);
          sessionStorage.removeItem('eb_banner_hidden_until');
        }
      } else {
        setIsBannerHidden(false);
      }
    };

    checkHiddenBanner();
    const intervalTimer = setInterval(checkHiddenBanner, 5000);

    return () => {
      window.removeEventListener('pwa_update_detected', handlePwaUpdateEvent);
      unsubscribe();
      clearInterval(intervalTimer);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      console.log('[Update] Performing app update...');

      // Save the target version that was confirmed so that they do not see it again after relogging
      const targetVersion = updateDetails?.currentVersion || '2.0.1';
      localStorage.setItem('eb_last_updated_confirmed_version', targetVersion);

      // 1. Unregister all service workers to clear any stuck code
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Clear all cache storages to prevent old features getting cached & throwing errors
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      // 3. Reset update local states
      localStorage.removeItem('pwa_update_available');
      sessionStorage.removeItem('eb_update_dismissed');
      sessionStorage.removeItem('eb_banner_hidden_until');

      // 4. Perform logout to let them sign in on the clean new state
      if (isLoggedIn) {
        await onLogout();
      }

      // 5. Force a full reload to fetch fresh code directly from server
      window.location.reload();
    } catch (err) {
      console.error('[Update] Error updating app:', err);
      // Hard fallback reload anyway
      window.location.reload();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLater = () => {
    setIsDismissed(true);
    sessionStorage.setItem('eb_update_dismissed', 'true');
  };

  const handleCancelBanner = () => {
    const COOLDOWN_MS = 180000; // 3 minutes
    const hiddenUntil = Date.now() + COOLDOWN_MS;
    sessionStorage.setItem('eb_banner_hidden_until', hiddenUntil.toString());
    setIsBannerHidden(true);
  };

  if (!hasUpdate) return null;

  const versionString = updateDetails?.currentVersion 
    ? `${updateDetails.currentVersion} (Your Version: ${currentLocalVersion})`
    : `New Build`;

  // ── Render Case 1: Persistent Banner at the top of the app (Chosen Later) ──
  if (isDismissed) {
    if (isBannerHidden) return null;

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes update-gradient-flow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes glow-pulse {
            0%, 100% { box-shadow: 0 4px 15px rgba(6, 182, 212, 0.5); }
            50% { box-shadow: 0 4px 25px rgba(29, 78, 216, 0.7); }
          }
          @keyframes pulse-gentle {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
          @keyframes slide-down {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .animate-update-gradient {
            background-size: 200% auto;
            animation: update-gradient-flow 3.5s linear infinite;
          }
          .animate-glow-pulse {
            animation: glow-pulse 3s infinite ease-in-out;
          }
          .animate-pulse-gentle {
            animation: pulse-gentle 2s infinite ease-in-out;
          }
          .animate-slide-down {
            animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}} />
        <div 
          id="app-update-top-banner"
          className="w-full bg-gradient-to-r from-cyan-600 via-blue-600 via-teal-500 via-sky-600 to-cyan-600 animate-update-gradient animate-glow-pulse animate-slide-down text-white px-3 sm:px-4 py-2.5 flex items-center justify-center z-[999] no-print sticky top-0"
        >
          <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left text-xs md:text-sm font-medium">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 justify-center md:justify-start">
              <div className="flex items-center gap-1.5 justify-center">
                <span className="p-1 bg-white/20 rounded-full animate-pulse shrink-0">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] font-mono text-cyan-200 shrink-0 font-bold">
                  v{updateDetails?.currentVersion || 'New'}
                </span>
              </div>
              <p className="leading-tight font-semibold tracking-wide drop-shadow-sm">
                EduBlay has been updated! Click "Update Now" to apply, or update anytime in App Settings (under the "Application" dropdown in the sidebar).
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 mt-1 md:mt-0 justify-center">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="animate-pulse-gentle px-3.5 py-1 bg-white text-blue-700 hover:text-blue-800 rounded-md font-bold text-[11px] hover:bg-gray-100 transition-all flex items-center gap-1 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isUpdating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Update Now
              </button>
              <button
                onClick={handleCancelBanner}
                disabled={isUpdating}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/45 text-white/90 hover:text-white transition-all cursor-pointer hover:scale-110 active:scale-95"
                title="Dismiss for 3 minutes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Render Case 2: Modal (Full Screen Overlay shown when they open the app) ──
  return (
    <div 
      id="app-update-modal" 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fade-in overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-auto">
        {/* Banner/Header decoration */}
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-center text-white">
          <div className="absolute top-2.5 right-2.5">
            <button 
              onClick={handleLater}
              className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-white/80 hover:text-white transition-all cursor-pointer"
              title="Later"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="inline-flex p-2.5 bg-white/10 rounded-xl mb-3 animate-pulse">
            <ArrowUpCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight">EduBlay has been updated!</h2>
          <p className="text-indigo-100 text-xs mt-1">EduBlay app has been updated! Click to update, or update later.</p>
        </div>

        {/* Modal content */}
        <div className="p-5 space-y-3.5">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300 leading-normal">
              <strong className="text-amber-400">Notice:</strong> Older features stored in cache can cause glitches or empty screens. Click update to clean the cache and refresh.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Version Details</span>
            <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 font-mono text-[11px] flex justify-between items-center text-indigo-400">
              <span>{versionString}</span>
              <span className="flex items-center gap-1 text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded font-sans font-medium">
                <Sparkles className="w-2.5 h-2.5 text-indigo-400" /> Real-time
              </span>
            </div>
          </div>

          {updateDetails?.releaseNotes && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">What's New</span>
              <div className="bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800/80 text-xs text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
                {updateDetails.releaseNotes}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5 pt-1.5">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-indigo-500/10 active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Updating & Clearing Cache...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Update App Now (Clears Cache & Logs Out)
                </>
              )}
            </button>
            <button
              onClick={handleLater}
              disabled={isUpdating}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 rounded-xl font-semibold text-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              Update Later (Keep Banner at Top)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
