import React, { useEffect } from 'react';
import type { SmartPlan, NotificationSettings, PlanSlot } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import { getDayOfWeek, parseTimeToDate } from '../lib/utils.ts';
import { notificationService } from '../services/notificationService';

// ── Map slot types to activityType strings the SW understands ────────────
const getActivityType = (slot: PlanSlot): string => {
    const type = (slot.type || '').toLowerCase();
    const activity = (slot.activity || '').toLowerCase();

    if (type === 'break') return 'break';
    if (type === 'lecture') return 'lecture';
    if (type === 'study') return 'study';
    if (type === 'free') return 'free';

    // Detect from activity name
    if (activity.includes('gym') || activity.includes('workout') || activity.includes('exercise')) return 'gym';
    if (activity.includes('church') || activity.includes('worship') || activity.includes('fellowship') || activity.includes('prayer')) return 'church';
    if (activity.includes('seminar')) return 'seminar';
    if (activity.includes('meeting')) return 'meeting';
    if (activity.includes('lecture')) return 'lecture';

    return type || 'agenda';
};

// ── Format time for display e.g. "10:30 AM" ───────────────────────────────
// FIX: plan slots store time as "09:00 AM" (12h with AM/PM). The old code did
// timeStr.split(':').map(Number) which turned "00 AM" into NaN → "Invalid Date".
// This version handles both "09:00 AM" and 24h "13:30", and returns '' for
// anything it can't parse (e.g. "Now", "N/A") so we never print "Invalid Date".
const formatDisplayTime = (timeStr: string): string => {
    if (!timeStr || typeof timeStr !== 'string') return '';

    const lower = timeStr.toLowerCase().replace(/\s/g, '');
    if (lower === 'now' || lower === 'n/a' || lower === 'invaliddate') return '';

    const isPM = lower.includes('pm');
    const isAM = lower.includes('am');
    const timeOnly = lower.replace('am', '').replace('pm', '');

    const [hStr, mStr] = timeOnly.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr || '0', 10);

    if (isNaN(hours) || isNaN(minutes)) return '';

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const useNotificationScheduler = (plan: SmartPlan | null, settings: NotificationSettings) => {
    useEffect(() => {
        const schedule = async () => {
            await notificationService.cancelAllNotifications();

            if (
                !plan ||
                !settings.enabled ||
                typeof Notification === 'undefined' ||
                Notification.permission !== 'granted'
            ) return;

            const now = new Date();
            const nowMs = now.getTime();

            // Schedule for the next 7 days so notifications survive SW restarts
            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                const targetDate = new Date(now);
                targetDate.setDate(now.getDate() + dayOffset);
                const targetDateStr = getDayOfWeek(targetDate);
                const dayPlan = plan.find(day => day.day === targetDateStr);
                if (!dayPlan) continue;

                dayPlan.slots.forEach((slot: PlanSlot) => {
                    // Compute the slot time for the target date
                    const startTime = parseTimeToDate(slot.startTime, targetDate);
                    const startTimeMs = startTime.getTime();
                    if (startTimeMs <= nowMs) return; // skip past events

                    const activityType = getActivityType(slot);
                    const subject = slot.activity;
                    const venue = (slot as any).venue || (slot as any).location || undefined;
                    const displayStart = formatDisplayTime(slot.startTime);
                    const displayEnd = formatDisplayTime(slot.endTime);

                    // ── Session start notification ──────────────────────
                    if (settings.sessionStart && slot.type !== 'free' && slot.type !== 'break') {
                        notificationService.scheduleActivityReminder({
                            delayMs: startTimeMs - nowMs,
                            activityType,
                            subject,
                            venue,
                            startTime: displayStart,
                            minutesBefore: 0,
                        });
                    }

                    // ── Break start notification ────────────────────────
                    if (settings.breakStartEnd && slot.type === 'break') {
                        notificationService.scheduleActivityReminder({
                            delayMs: startTimeMs - nowMs,
                            activityType: 'break',
                            subject,
                            startTime: displayStart,
                            minutesBefore: 0,
                        });

                        const endTime = parseTimeToDate(slot.endTime, targetDate);
                        const endTimeMs = endTime.getTime();
                        if (endTimeMs > nowMs) {
                            notificationService.scheduleActivityReminder({
                                delayMs: endTimeMs - nowMs,
                                activityType: 'study',
                                subject: 'your next session',
                                startTime: displayEnd,
                                minutesBefore: 0,
                            });
                        }
                    }

                    // ── Pre-session reminder (X minutes before) ─────────
                    if (
                        settings.reminders &&
                        slot.type !== 'free' &&
                        !(slot.type === 'break' && !settings.breakStartEnd)
                    ) {
                        const minutesBefore = settings.reminderTime || 10;
                        const reminderTimeMs = startTimeMs - minutesBefore * 60 * 1000;
                        if (reminderTimeMs > nowMs) {
                            notificationService.scheduleActivityReminder({
                                delayMs: reminderTimeMs - nowMs,
                                activityType,
                                subject,
                                venue,
                                startTime: displayStart,
                                minutesBefore,
                            });
                        }
                    }
                });
            }
        };

        schedule();
    }, [plan, settings]);
};

interface NotificationManagerProps {
    plan: SmartPlan | null;
    settings: NotificationSettings;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ plan, settings }) => {
    useNotificationScheduler(plan, settings);
    return null;
};

export default NotificationManager;