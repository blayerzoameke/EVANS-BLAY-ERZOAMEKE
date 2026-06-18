// services/notificationService.ts

import type { NotificationSettings } from '../types';

type PendingNotification = {
    id: string;
    title: string;
    options: NotificationOptions;
    triggerTime: number;
};

// ── Activity reminder payload ──────────────────────────────────────────────
export interface ActivityReminderPayload {
    activityType?: string;  // 'study' | 'lecture' | 'break' | 'gym' | 'church' | 'agenda' | etc.
    subject?: string;       // e.g. "MATH 461" or "Real Functions"
    venue?: string;         // e.g. "SCB-TF34" or "Main Chapel"
    startTime?: string;     // e.g. "10:30 AM"
    minutesBefore?: number; // e.g. 10 (fires 10 min before)
    reminderType?: string;  // 'morning' | 'evening' | 'general'
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private pendingTimers: number[] = [];
  public audioContext: AudioContext | null = null;
  private isUnlocked = false;

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => {
            this.checkPendingNotifications();
            this.scheduleInactivityNotifications();
            // App opened → clear the home-screen badge so the count resets.
            this.clearBadge();
        });

        // ── Clear badge whenever the user opens / focuses the app (WhatsApp-style) ──
        // This is what makes the count reset: once you open the app the badge goes
        // to 0, so the next batch of notifications naturally starts counting at 1.
        window.addEventListener('focus', () => this.clearBadge());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.clearBadge();
        });

        const unlockHandler = () => {
            this.resumeAudioContext();
            if (this.isUnlocked) {
                window.removeEventListener('click', unlockHandler);
                window.removeEventListener('touchstart', unlockHandler);
                window.removeEventListener('keydown', unlockHandler);
            }
        };

        window.addEventListener('click', unlockHandler);
        window.addEventListener('touchstart', unlockHandler);
        window.addEventListener('keydown', unlockHandler);

        setInterval(() => this.checkPendingNotifications(), 60 * 1000);
    }
  }

  async init() {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        console.log('✅ Service Worker is ready.');

        if ('periodicSync' in this.registration) {
            try {
                const status = await navigator.permissions.query({ name: 'periodic-background-sync' as any });
                if (status.state === 'granted') {
                    await (this.registration as any).periodicSync.register('study-reminder', {
                        minInterval: 8 * 60 * 60 * 1000
                    });
                    console.log('✅ Periodic sync registered — background study reminders active.');
                }
            } catch (e) {
                console.warn('Periodic sync not available:', e);
            }
        }

        this.scheduleDailyRemindersViaSW();

      } catch (error) {
        console.error('❌ Service Worker failed to become ready:', error);
      }
    }
  }

  // ── App badge helpers ─────────────────────────────────────────────────────
  // The badge count is derived from the notifications CURRENTLY in the tray,
  // not a running counter. So when the user clears notifications, the next one
  // recomputes from scratch instead of continuing from the old total.
  private async syncBadge() {
    try {
      if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
      if (this.registration && (this.registration as any).getNotifications) {
        const notifs = await this.registration.getNotifications();
        if (notifs.length > 0) {
          await (navigator as any).setAppBadge(notifs.length);
        } else {
          await (navigator as any).clearAppBadge();
        }
      }
    } catch {
      // Badging API unsupported (or iOS < 16.4 / not installed) — safe to ignore.
    }
  }

  public async clearBadge() {
    try {
      if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
        await (navigator as any).clearAppBadge();
      }
    } catch {
      // ignore
    }
  }

  // ── Schedule daily morning/evening reminders via SW ──────────────────────
  private scheduleDailyRemindersViaSW() {
    if (!this.registration?.active) return;
    const now = new Date();
    const slots: Array<{ hour: number; reminderType: string }> = [
        { hour: 8,  reminderType: 'morning' },
        { hour: 13, reminderType: 'general' },
        { hour: 19, reminderType: 'evening' },
    ];
    for (const slot of slots) {
        const target = new Date(now);
        target.setHours(slot.hour, 0, 0, 0);
        if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
        const delayMs = target.getTime() - now.getTime();
        this.registration.active?.postMessage({
            type: 'SCHEDULE_REMINDER',
            delayMs,
            reminderType: slot.reminderType,
        });
    }
  }

  // ── Schedule a specific activity reminder via SW ──────────────────────────
  // Call this when a student's timetable slot is coming up.
  public scheduleActivityReminder(payload: ActivityReminderPayload & { delayMs: number }) {
    const triggerTime = Date.now() + payload.delayMs;
    const id = `activity-${payload.activityType || 'reminder'}-${triggerTime}`;

    // Build the notification content using the same logic as the SW
    const { title, body } = this._buildNotificationContent(payload);

    // Save to IndexedDB so SW poll can fire it even after SW restarts
    const notification = {
      id,
      title,
      options: {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `${payload.activityType || 'activity'}-reminder`,
        requireInteraction: true,
        data: { url: '/' },
        vibrate: [200, 100, 200],
      } as NotificationOptions,
      triggerTime,
    };
    this.savePendingNotification(notification as any);

    // Also post to SW for in-session delivery (as before)
    if (this.registration?.active) {
      this.registration.active.postMessage({
        type: 'SCHEDULE_REMINDER',
        delayMs: payload.delayMs,
        activityType: payload.activityType,
        subject: payload.subject,
        venue: payload.venue,
        startTime: payload.startTime,
        minutesBefore: payload.minutesBefore,
        reminderType: payload.reminderType,
      });
    }
  }

  // Treat empty / "Invalid Date" / "N/A" startTime as "no time" so we never
  // render "⏰ Invalid Date" in a notification body.
  private validTime(t?: string): string {
    if (!t) return '';
    const s = String(t).trim();
    const lower = s.toLowerCase();
    if (!s || lower === 'invalid date' || lower === 'n/a') return '';
    return s;
  }

  // Mirror the SW buildNotification logic client-side for IndexedDB persistence
  private _buildNotificationContent(payload: ActivityReminderPayload): { title: string; body: string } {
    const { activityType, subject, minutesBefore, reminderType } = payload;
    const startTime = this.validTime(payload.startTime);
    const clock = startTime ? `⏰ ${startTime}` : '';
    const timeLabel = minutesBefore && minutesBefore > 0 ? `in ${minutesBefore} min` : 'now';
    const name = subject || 'your session';
    const type = (activityType || '').toLowerCase();
    const venue = payload.venue;

    if (reminderType === 'morning') return { title: 'Good Morning! 🌅', body: subject ? `Ready to study ${subject} today? Check your EduBlay schedule.` : 'Ready to start a productive day? Check your EduBlay agenda.' };
    if (reminderType === 'evening') return { title: 'Evening Review 🌙', body: subject ? `How did studying ${subject} go today? Review your progress on EduBlay.` : 'Review your progress today on EduBlay.' };
    if (type === 'study') return { title: `📚 Study Time ${minutesBefore ? `in ${minutesBefore} min` : ''}`.trim(), body: `Time to study ${name}. Open EduBlay and get focused! ${clock}`.trim() };
    if (type === 'lecture') return { title: `🎓 Lecture Starting ${timeLabel}`, body: venue ? `Prepare for your ${name} lecture at ${venue}. ${clock}`.trim() : `Prepare for your ${name} lecture. ${clock}`.trim() };
    if (type === 'break') return { title: '☕ Break Time!', body: `Time for a break from ${name}. Rest up and come back refreshed!` };
    return { title: `⏰ Reminder: ${name}`, body: venue ? `${name} is ${timeLabel} at ${venue}. ${clock}`.trim() : `${name} is coming up ${timeLabel}. Open EduBlay to check.` };
  }

  // ── Schedule reminders for upcoming timetable slots ───────────────────────
  // Pass an array of upcoming slots and it schedules reminders for each.
  public scheduleSlotReminders(slots: Array<{
    activityType: string;
    subject: string;
    venue?: string;
    startTime: string;        // "HH:MM" 24h format
    reminderMinutesBefore?: number; // default 10
  }>) {
    if (!this.registration?.active) return;

    const now = new Date();

    for (const slot of slots) {
        const minutesBefore = slot.reminderMinutesBefore ?? 10;

        // Parse startTime "HH:MM"
        const [hh, mm] = slot.startTime.split(':').map(Number);
        if (isNaN(hh) || isNaN(mm)) continue; // guard against bad time strings
        const slotDate = new Date(now);
        slotDate.setHours(hh, mm, 0, 0);

        // If slot already passed today, skip
        if (slotDate.getTime() <= now.getTime()) continue;

        // Fire reminder X minutes before
        const reminderTime = slotDate.getTime() - minutesBefore * 60 * 1000;
        const delayMs = reminderTime - now.getTime();
        if (delayMs <= 0) continue;

        // Format display time
        const displayTime = slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        this.scheduleActivityReminder({
            delayMs,
            activityType: slot.activityType,
            subject: slot.subject,
            venue: slot.venue,
            startTime: displayTime,
            minutesBefore,
        });
    }
  }

  public async resumeAudioContext() {
      if (typeof window === 'undefined') return;

      if (!this.audioContext) {
          try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContextClass) {
                  this.audioContext = new AudioContextClass();
              }
          } catch (e) {
              console.warn('AudioContext not supported:', e);
              return;
          }
      }

      if (this.audioContext && this.audioContext.state === 'suspended') {
          try {
              await this.audioContext.resume();
              this.isUnlocked = true;
          } catch (e) {
              console.warn('⚠️ Failed to resume AudioContext:', e);
          }
      } else if (this.audioContext && this.audioContext.state === 'running') {
          this.isUnlocked = true;
      }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') {
      console.warn('❌ This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') return 'granted';

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            this.sendNotification('You\'re all set! 🔔', {
                body: 'EduBlay will now remind you before lectures, study sessions, and more.',
                requireInteraction: false
            });
            await this.playAlarm();
        }
        return permission;
    } catch (e) {
        console.error("Error requesting permission:", e);
        return 'denied';
    }
  }

  async sendNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const defaultOptions: any = {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: '/' }
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
        if (this.registration && this.registration.showNotification) {
            await this.registration.showNotification(title, finalOptions);
            // Update the home-screen badge from what's actually in the tray.
            await this.syncBadge();
        } else {
            const n = new Notification(title, finalOptions);
            n.onclick = () => { window.focus(); n.close(); };
        }
        console.log('📬 Notification sent:', title);
    } catch (e) {
        console.error("❌ Error showing notification:", e);
    }
  }

  scheduleNotification(title: string, options: NotificationOptions, triggerTime: number, customId?: string): string {
    const id = customId || `notif-${Date.now()}-${Math.random()}`;
    const notification: PendingNotification = { id, title, options, triggerTime };
    this.savePendingNotification(notification);
    this.scheduleTimer(notification);
    return id;
  }

  async playAlarm() {
    await this.resumeAudioContext();
    if (!this.audioContext) return;

    try {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(ctx.destination);

        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const startTime = now + (index * 0.15);
            const endTime = startTime + 1.5;
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(1, startTime + 0.05);
            noteGain.gain.exponentialRampToValueAtTime(0.01, endTime);
            osc.connect(noteGain);
            noteGain.connect(masterGain);
            osc.start(startTime);
            osc.stop(endTime);
        });
    } catch (e) {
        console.error("❌ Audio playback failed:", e);
    }
  }

  async playBreakStartSound() { await this.playAlarm(); }
  async playBreakEndSound() { await this.playAlarm(); }

  private scheduleTimer(notification: PendingNotification) {
    const now = Date.now();
    const delay = notification.triggerTime - now;

    if (delay > 0) {
        let triggerScheduled = false;
        if (this.registration && 'showTrigger' in Notification.prototype && typeof (window as any).TimestampTrigger !== 'undefined') {
            try {
                (this.registration.showNotification as any)(notification.title, {
                    ...notification.options,
                    showTrigger: new (window as any).TimestampTrigger(notification.triggerTime)
                });
                triggerScheduled = true;
            } catch (e) {
                console.error("Error scheduling background notification:", e);
            }
        }

        const timerId = window.setTimeout(() => {
            if (!triggerScheduled) {
                this.sendNotification(notification.title, notification.options);
            }
            this.playAlarm();
            this.removePendingNotification(notification.id);
        }, delay);
        this.pendingTimers.push(timerId);
    } else {
        this.sendNotification(notification.title, notification.options);
        this.playAlarm();
    }
  }

  private async openDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('edublay-notifications', 1);
        req.onupgradeneeded = (e: any) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('pending')) {
              db.createObjectStore('pending', { keyPath: 'id' });
            }
          } catch (err) {
            console.error('IndexedDB upgrade failed:', err);
          }
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = (err) => {
          console.warn('IndexedDB open error event:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB open failed (synchronous error, e.g. Safari Private Mode):', err);
        resolve(null);
      }
    });
  }

  public async scheduleInactivityNotifications() {
      const pending = await this.getPendingNotifications();
      const filtered = pending.filter(n => !n.id.startsWith('inactivity-'));

      const db = await this.openDb();
      if (!db) return;
      try {
          const tx = db.transaction('pending', 'readwrite');
          const store = tx.objectStore('pending');
          store.clear();
          filtered.forEach(n => store.put(n));
      } catch (err) {
          console.warn('scheduleInactivityNotifications tx failed:', err);
      }

      const now = Date.now();
      const intervals = [
          { days: 1, title: "We miss you! 👋", body: "It's been a day since your last study session. Keep the momentum going!" },
          { days: 3, title: "Ready to learn? 📚", body: "Don't let your progress slip. Jump back into your studies today." },
          { days: 7, title: "It's been a week! 🚀", body: "Your goals are waiting. Open EduBlay to continue your learning journey." }
      ];

      intervals.forEach(interval => {
          const triggerTime = now + (interval.days * 24 * 60 * 60 * 1000);
          const id = `inactivity-${interval.days}-${Date.now()}`;
          const notification: PendingNotification = {
              id,
              title: interval.title,
              options: {
                  body: interval.body,
                  tag: `inactivity-${interval.days}`,
                  icon: '/icons/icon-192x192.png'
              },
              triggerTime
          };
          this.savePendingNotification(notification);
          this.scheduleTimer(notification);
      });
  }

  private async savePendingNotification(notification: PendingNotification) {
     const db = await this.openDb();
     if (!db) return;
     return new Promise<void>((resolve) => {
         try {
             const tx = db.transaction('pending', 'readwrite');
             tx.objectStore('pending').put(notification);
             tx.oncomplete = () => resolve();
             tx.onerror = () => resolve();
         } catch (err) {
             console.warn('savePendingNotification tx failed:', err);
             resolve();
         }
     });
  }

  private async removePendingNotification(id: string) {
     const db = await this.openDb();
     if (!db) return;
     return new Promise<void>((resolve) => {
         try {
             const tx = db.transaction('pending', 'readwrite');
             tx.objectStore('pending').delete(id);
             tx.oncomplete = () => resolve();
             tx.onerror = () => resolve();
         } catch (err) {
             console.warn('removePendingNotification tx failed:', err);
             resolve();
         }
     });
  }

  private async getPendingNotifications(): Promise<PendingNotification[]> {
      const db = await this.openDb();
      if (!db) return [];
      return new Promise((resolve) => {
          try {
              const tx = db.transaction('pending', 'readonly');
              const getReq = tx.objectStore('pending').getAll();
              getReq.onsuccess = () => resolve(getReq.result || []);
              getReq.onerror = () => resolve([]);
          } catch (err) {
              console.warn('getPendingNotifications tx failed:', err);
              resolve([]);
          }
      });
  }

  async checkPendingNotifications() {
    const pending = await this.getPendingNotifications();
    const now = Date.now();
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
    for (const notif of pending) {
      if (notif.triggerTime <= now) {
        this.sendNotification(notif.title, notif.options);
        this.playAlarm();
        await this.removePendingNotification(notif.id);
      } else {
        this.scheduleTimer(notif);
      }
    }
  }

  async cancelAllNotifications() {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];

    const db = await this.openDb();
    if (!db) return;
    return new Promise<void>((resolve) => {
        try {
            const tx = db.transaction('pending', 'readwrite');
            const store = tx.objectStore('pending');
            const getReq = store.getAll();
            getReq.onsuccess = () => {
                const all = getReq.result || [];
                const toKeepPrefixes = ['inactivity-', 'quote-', 'rating-prompt'];
                const toDelete = all.filter((n: any) => !toKeepPrefixes.some(p => n.id.startsWith(p)));
                toDelete.forEach((n: any) => store.delete(n.id));
                tx.oncomplete = () => {
                    const toKeep = all.filter((n: any) => toKeepPrefixes.some(p => n.id.startsWith(p)));
                    toKeep.forEach((n: any) => this.scheduleTimer(n));
                    resolve();
                };
            };
            getReq.onerror = () => resolve();
        } catch (err) {
            console.warn('cancelAllNotifications tx failed:', err);
            resolve();
        }
    });
  }

  async testAlarm() { await this.playAlarm(); }
}

export const notificationService = new NotificationService();