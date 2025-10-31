import React, { useEffect } from 'react';
import type { SmartPlan, NotificationSettings, PlanSlot } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { getDayOfWeek, parseTimeToDate } from '../lib/utils.ts';
import { notificationService } from '../services/notificationService.ts';

const useNotificationScheduler = (plan: SmartPlan | null, settings: NotificationSettings) => {
    const { t } = useLanguage();

    useEffect(() => {
        notificationService.cancelAllNotifications();

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
            const startTime = parseTimeToDate(slot.startTime, now);
            const nowMs = now.getTime();
            const startTimeMs = startTime.getTime();

            if (startTimeMs <= nowMs) {
                return; // Skip past events
            }

            // Schedule Session Start notification
            if (settings.sessionStart && (slot.type === 'study' || slot.type === 'lecture')) {
                notificationService.scheduleNotification(
                    t('notifications.sessionStart.title', { subject: slot.activity }), 
                    {
                        body: t('notifications.sessionStart.body', { startTime: slot.startTime, endTime: slot.endTime }),
                        tag: `session-start-${slot.startTime}`
                    },
                    startTimeMs
                );
            }

            // Schedule Reminder notification
            if (settings.reminders && (slot.type === 'study' || slot.type === 'lecture')) {
                const reminderTimeMs = startTimeMs - (settings.reminderTime * 60 * 1000);
                if (reminderTimeMs > nowMs) {
                    notificationService.scheduleNotification(
                        t('notifications.reminder.title', { subject: slot.activity, time: settings.reminderTime }), 
                        {
                            body: t('notifications.reminder.body', { startTime: slot.startTime }),
                            tag: `session-reminder-${slot.startTime}`
                        },
                        reminderTimeMs
                    );
                }
            }
        });

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
