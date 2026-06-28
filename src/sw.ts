/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST || []);

// ── Never cache Paystack ───────────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname === 'js.paystack.co' ||
    url.hostname === 'api.paystack.co' ||
    url.hostname === 'checkout.paystack.com' ||
    url.hostname === 'standard.paystack.co',
  new NetworkOnly()
);

// ── Runtime caching ────────────────────────────────────────────────────────
registerRoute(
  ({ request }) => ['script', 'style', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'asset-cache' })
);
registerRoute(
  ({ request }) => ['image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);
registerRoute(
  ({ url }) =>
    url.origin === 'https://cdn.jsdelivr.net' ||
    url.origin === 'https://unpkg.com' ||
    url.origin === 'https://cdnjs.cloudflare.com',
  new StaleWhileRevalidate({ cacheName: 'cdn-cache' })
);

// ── App badge: count = notifications currently in the tray ─────────────────
// Deriving from getNotifications() means dismissing notifications and a fresh
// batch the next day will start counting at 1 instead of continuing the total.
async function syncBadge() {
  try {
    const nav: any = (self as any).navigator;
    if (!nav || !('setAppBadge' in nav)) return;
    const notifs = await self.registration.getNotifications();
    if (notifs.length > 0) {
      await nav.setAppBadge(notifs.length);
    } else {
      await nav.clearAppBadge();
    }
  } catch {
    // Badging API unsupported / not installed — safe to ignore.
  }
}

// ── Smart notification builder ─────────────────────────────────────────────
// Guard: never render "⏰ Invalid Date". Empty / "Invalid Date" / "N/A" → no clock.
function validTime(t?: string): string {
  if (!t) return '';
  const s = String(t).trim();
  const lower = s.toLowerCase();
  if (!s || lower === 'invalid date' || lower === 'n/a') return '';
  return s;
}

function buildNotification(data: {
  activityType?: string;
  subject?: string;
  venue?: string;
  startTime?: string;
  minutesBefore?: number;
  reminderType?: string;
  studentName?: string;
}): { title: string; body: string } {
  const { activityType, subject, venue, minutesBefore, reminderType, studentName } = data;
  const name = studentName ? `Hi ${studentName}! ` : '';
  const timeLabel = minutesBefore && minutesBefore > 0 ? `in ${minutesBefore} min` : 'now';
  const at = venue ? ` at ${venue}` : '';
  const safeStart = validTime(data.startTime);
  const clock = safeStart ? ` ⏰ ${safeStart}` : '';
  const subj = subject || 'your session';
  const type = (activityType || '').toLowerCase();

  // Daily reminders
  if (reminderType === 'morning') return {
    title: `Good Morning! 🌅`,
    body: subject
      ? `${name}Ready to study ${subject} today? Check your EduBlay schedule.`
      : `${name}Ready to start a productive day? Check your EduBlay agenda.`,
  };
  if (reminderType === 'evening') return {
    title: `Evening Review 🌙`,
    body: subject
      ? `${name}How did studying ${subject} go today? Review your progress.`
      : `${name}Review your progress today on EduBlay.`,
  };

  // Lecture
  if (type === 'lecture') return {
    title: `🎓 Lecture ${timeLabel}`,
    body: `${name}Time to go for ${subj} lecture${at}.${clock}`,
  };

  // Study
  if (type === 'study') return {
    title: `📚 Study Time ${minutesBefore ? `in ${minutesBefore} min` : ''}`.trim(),
    body: `${name}You have ${minutesBefore ? `${minutesBefore} min more to start` : 'time to start'} studying ${subj}${at}.${clock}`,
  };

  // Break
  if (type === 'break') return {
    title: `☕ Break Time!`,
    body: `${name}Time for a break from ${subj}. Rest up and come back refreshed!`,
  };

  // Gym/exercise
  if (type === 'gym' || type === 'exercise' || type === 'workout') return {
    title: `💪 Gym Time ${timeLabel}`,
    body: `${name}Time for your workout${at}!${clock}`,
  };

  // Church/worship
  if (type === 'church' || type === 'worship' || type === 'fellowship' || type === 'prayer') return {
    title: `⛪ ${subj} ${timeLabel}`,
    body: `${name}Time to head to ${subj}${at}.${clock}`,
  };

  // Seminar/meeting
  if (type === 'seminar' || type === 'meeting' || type === 'class') return {
    title: `📅 ${subj} ${timeLabel}`,
    body: `${name}Your ${subj} starts ${timeLabel}${at}.${clock}`,
  };

  // Agenda/personal
  if (type === 'agenda' || type === 'personal' || type === 'free') return {
    title: `📌 Reminder: ${subj}`,
    body: `${name}Don't forget: ${subj} is ${timeLabel}${at}.${clock}`,
  };

  // Default
  return {
    title: `⏰ Reminder: ${subj}`,
    body: `${name}${subj} is coming up ${timeLabel}${at}.${clock}`,
  };
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────
async function getPendingNotifications(): Promise<any[]> {
  if (typeof indexedDB === 'undefined') return [];
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('edublay-notifications', 1);
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pending')) return resolve([]);
        const tx = db.transaction('pending', 'readonly');
        const store = tx.objectStore('pending');
        const getReq = store.getAll();
        getReq.onsuccess = () => resolve(getReq.result || []);
        getReq.onerror = () => resolve([]);
      };
      req.onerror = () => resolve([]);
    } catch (err) {
      console.warn('DB open failed in worker:', err);
      resolve([]);
    }
  });
}

async function removePendingNotification(id: string) {
  if (typeof indexedDB === 'undefined') return;
  return new Promise<void>((resolve) => {
    try {
      const req = indexedDB.open('edublay-notifications', 1);
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pending')) return resolve();
        const tx = db.transaction('pending', 'readwrite');
        const store = tx.objectStore('pending');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch (err) {
      console.warn('DB delete failed in worker:', err);
      resolve();
    }
  });
}

async function checkAndFireNotifications() {
  const pending = await getPendingNotifications();
  const now = Date.now();
  let fired = false;
  for (const notif of pending) {
    if (notif.triggerTime <= now) {
      await self.registration.showNotification(notif.title, notif.options);
      await removePendingNotification(notif.id);
      fired = true;
    }
  }
  if (fired) await syncBadge();
}

// ── SW Lifecycle — iOS/Chrome refresh-loop safe ────────────────────────────
let checkInterval: any;

self.addEventListener('install', () => {
  // NO skipWaiting — causes refresh loops on iOS Chrome
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(n => !['html-cache', 'asset-cache', 'image-cache', 'cdn-cache'].includes(n))
          .map(n => caches.delete(n))
      );
      // Safely removed clients.claim() to fully prevent first-load flash-to-blank loop on WebKit iOS
    })()
  );

  if (!checkInterval) {
    checkInterval = setInterval(() => checkAndFireNotifications(), 60 * 1000);
  }
});

// ── Message handler ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Explicitly clear the badge (e.g. when the app is opened/focused)
  if (event.data.type === 'CLEAR_BADGE') {
    event.waitUntil((async () => {
      try {
        const nav: any = (self as any).navigator;
        if (nav && 'clearAppBadge' in nav) await nav.clearAppBadge();
      } catch { /* ignore */ }
    })());
    return;
  }

  // Schedule a future reminder
  if (event.data.type === 'SCHEDULE_REMINDER') {
    const {
      delayMs, reminderType, activityType,
      subject, venue, startTime, minutesBefore, studentName,
    } = event.data;

    setTimeout(() => {
      const { title, body } = buildNotification({
        activityType, subject, venue, startTime,
        minutesBefore, reminderType, studentName,
      });
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: activityType ? `${activityType}-reminder` : 'daily-reminder',
        requireInteraction: true,
        data: { url: '/' },
      }).then(() => syncBadge());
    }, delayMs);
  }

  // Fire immediately
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { activityType, subject, venue, startTime, minutesBefore, studentName } = event.data;
    const { title, body } = buildNotification({ activityType, subject, venue, startTime, minutesBefore, studentName });
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: activityType ? `${activityType}-reminder` : 'reminder',
      requireInteraction: true,
      data: { url: '/' },
    }).then(() => syncBadge());
  }
});

// ── Background sync ────────────────────────────────────────────────────────
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'study-reminder') event.waitUntil(checkAndFireNotifications());
});
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'check-notifications') event.waitUntil(checkAndFireNotifications());
});

// ── Web Push Event Listener (wakes up the service worker when app is closed) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      try {
        let payload: any = {};
        try {
          payload = event.data.json();
        } catch {
          payload = { title: 'EduBlay Update', body: event.data.text() };
        }

        const title = payload.title || 'EduBlay Update';
        const body = payload.body || 'New study material or schedule is available!';
        const icon = payload.icon || '/icons/icon-192x192.png';
        const badge = payload.badge || '/icons/icon-192x192.png';
        const tag = payload.tag || 'push-notification';
        const url = payload.url || '/';

        await self.registration.showNotification(title, {
          body,
          icon,
          badge,
          tag,
          requireInteraction: true,
          data: { url },
        });

        await syncBadge();
      } catch (err) {
        console.error('Error handling push event in service worker:', err);
      }
    })()
  );
});

// ── Notification dismissed (swiped away) → recompute badge ─────────────────
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(syncBadge());
});

// ── Notification click → open / focus the app ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      // The clicked notification is now gone — refresh the badge count.
      await syncBadge();

      // includeUncontrolled: true is required because the SW does not call
      // clients.claim(), so the open PWA window is "uncontrolled" and would
      // otherwise be invisible to matchAll — causing a stray new tab to open.
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if ('focus' in client) {
          try {
            if ('navigate' in client && (client as any).url && new URL((client as any).url).pathname !== targetUrl) {
              await (client as WindowClient).navigate(targetUrl);
            }
          } catch { /* navigation optional */ }
          return (client as WindowClient).focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});