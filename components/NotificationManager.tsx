import React, { useEffect, useRef } from 'react';
import type { SmartPlan, NotificationSettings, PlanSlot } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { getDayOfWeek, parseTimeToDate } from '../lib/utils.ts';

const useNotificationScheduler = (plan: SmartPlan | null, settings: NotificationSettings) => {
    const { t } = useLanguage();
    const scheduledTimersRef = useRef<number[]>([]);

    useEffect(() => {
        const scheduleNotifications = () => {
            // Clear any previously scheduled timers
            scheduledTimersRef.current.forEach(clearTimeout);
            scheduledTimersRef.current = [];

            if (!plan || !settings.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
                return;
            }

            const now = new Date();
            const todayStr = getDayOfWeek(now);
            const todayPlan = plan.find(day => day.day === todayStr);

            if (!todayPlan) {
                return;
            }

            todayPlan.slots.forEach((slot: PlanSlot) => {
                const nowMs = now.getTime();
                const startTimeMs = parseTimeToDate(slot.startTime, now).getTime();
                const timeUntilStart = startTimeMs - nowMs;

                if (timeUntilStart <= 0) {
                    return; // Skip past events
                }
                
                const schedule = (callback: () => void, delay: number) => {
                    if (delay > 0) {
                        const timerId = setTimeout(callback, delay);
                        scheduledTimersRef.current.push(timerId as any);
                    }
                };

                // Schedule Session Start notification
                if (settings.sessionStart && (slot.type === 'study' || slot.type === 'lecture')) {
                    schedule(() => {
                        new Notification(t('notifications.sessionStart.title', { subject: slot.activity }), {
                            body: t('notifications.sessionStart.body', { startTime: slot.startTime, endTime: slot.endTime }),
                            icon: 'data:image/svg+xml,%3Csvg viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\' fill=\'%230284c7\'%3E%3Cg%3E%3Cpath d=\'M19,4H18V2H16V4H8V2H6V4H5C3.89,4,3,4.9,3,6V20A2,2,0,0,0,5,22H15.1C14.41,21.14,14,20.12,14,19C14,15.69,16.69,13,20,13C20.34,13,20.68,13.05,21,13.13V6C21,4.9,20.1,4,19,4Z\'/%3E%3Crect x=\'7\' y=\'11\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'11\' y=\'11\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'15\' y=\'11\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'7\' y=\'15\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'11\' y=\'15\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Cpath d=\'M20,15C17.24,15,15,17.24,15,20C15,22.76,17.24,25,20,25C22.76,25,25,22.76,25,20C25,17.24,22.76,15,20,15M20.5,20.25L18,21.5V18H19.5V19.9L21.5,18.9L22,19.6L20.5,20.25Z\' fill=\'white\'/%3E%3C/g%3E%3C/svg%3E',
                        });
                    }, timeUntilStart);
                }

                // Schedule Reminder notification
                if (settings.reminders && (slot.type === 'study' || slot.type === 'lecture')) {
                    const timeUntilReminder = timeUntilStart - (settings.reminderTime * 60 * 1000);
                    schedule(() => {
                         new Notification(t('notifications.reminder.title', { subject: slot.activity, time: settings.reminderTime }), {
                            body: t('notifications.reminder.body', { startTime: slot.startTime }),
                            icon: 'data:image/svg+xml,%3Csvg viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\' fill=\'%230284c7\'%3E%3Cg%3E%3Cpath d=\'M19,4H18V2H16V4H8V2H6V4H5C3.89,4,3,4.9,3,6V20A2,2,0,0,0,5,22H15.1C14.41,21.14,14,20.12,14,19C14,15.69,16.69,13,20,13C20.34,13,20.68,13.05,21,13.13V6C21,4.9,20.1,4,19,4Z\'/%3E%3Crect x=\'7\' y=\'11\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'11\' y=\'11\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'15\' y=\'11\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'7\' y=\'15\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Crect x=\'11\' y=\'15\' width=\'2\' height=\'2\' rx=\'0.5\' fill=\'white\'/%3E%3Cpath d=\'M20,15C17.24,15,15,17.24,15,20C15,22.76,17.24,25,20,25C22.76,25,25,22.76,25,20C25,17.24,22.76,15,20,15M20.5,20.25L18,21.5V18H19.5V19.9L21.5,18.9L22,19.6L20.5,20.25Z\' fill=\'white\'/%3E%3C/g%3E%3C/svg%3E',
                        });
                    }, timeUntilReminder);
                }
            });
        };

        scheduleNotifications(); // Run once immediately
        const intervalId = setInterval(scheduleNotifications, 60 * 1000); // Reschedule every minute for accuracy

        return () => {
            scheduledTimersRef.current.forEach(clearTimeout);
            clearInterval(intervalId);
        };
    }, [plan, settings, t]);
};

interface NotificationManagerProps {
    plan: SmartPlan | null;
    settings: NotificationSettings;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ plan, settings }) => {
    useNotificationScheduler(plan, settings);
    return null; // This component does not render anything
};

export default NotificationManager;