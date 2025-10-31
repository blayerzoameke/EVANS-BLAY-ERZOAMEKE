// services/notificationService.ts

type PendingNotification = {
    id: string;
    title: string;
    options: NotificationOptions;
    triggerTime: number;
};

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private pendingTimers: number[] = [];

  constructor() {
    this.init();
    window.addEventListener('load', () => this.checkPendingNotifications());
    setInterval(() => this.checkPendingNotifications(), 60 * 1000); // Check every minute
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        console.log('Service Worker is ready.');
      } catch (error) {
        console.error('Service Worker failed to become ready:', error);
      }
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        this.sendNotification('Notifications Enabled! 🎉', {
            body: 'You will now receive reminders for your sessions.',
            requireInteraction: false
        });
        return true;
    }

    return false;
  }

  async sendNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted.');
      return;
    }
    
    const defaultOptions: any = {
        icon: "data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' fill='%230284c7'%3E%3Cg%3E%3Cpath d='M19,4H18V2H16V4H8V2H6V4H5C3.89,4,3,4.9,3,6V20A2,2,0,0,0,5,22H15.1C14.41,21.14,14,20.12,14,19C14,15.69,16.69,13,20,13C20.34,13,20.68,13.05,21,13.13V6C21,4.9,20.1,4,19,4Z'/%3E%3Crect x='7' y='11' width='2' height='2' rx='0.5' fill='white'/%3E%3Crect x='11' y='11' width='2' height='2' rx='0.5' fill='white'/%3E%3Crect x='15' y='11' width='2' height='2' rx='0.5' fill='white'/%3E%3Crect x='7' y='15' width='2' height='2' rx='0.5' fill='white'/%3E%3Crect x='11' y='15' width='2' height='2' rx='0.5' fill='white'/%3E%3Cpath d='M20,15C17.24,15,15,17.24,15,20C15,22.76,17.24,25,20,25C22.76,25,25,22.76,25,20C25,17.24,22.76,15,20,15M20.5,20.25L18,21.5V18H19.5V19.9L21.5,18.9L22,19.6L20.5,20.25Z' fill='white'/%3E%3C/g%3E%3C/svg%3E",
        vibrate: [200, 100, 200],
        data: {
            url: window.location.origin
        }
    };
    
    const finalOptions = { ...defaultOptions, ...options };

    if (this.registration && this.registration.showNotification) {
      await this.registration.showNotification(title, finalOptions);
    } else {
      new Notification(title, finalOptions);
    }
  }

  scheduleNotification(title: string, options: NotificationOptions, triggerTime: number): string {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const notification: PendingNotification = { id, title, options, triggerTime };

    this.savePendingNotification(notification);
    this.scheduleTimer(notification);
    return id;
  }

  private scheduleTimer(notification: PendingNotification) {
    const now = Date.now();
    const delay = notification.triggerTime - now;

    if (delay > 0) {
        const timerId = window.setTimeout(() => {
            this.sendNotification(notification.title, notification.options);
            this.removePendingNotification(notification.id);
        }, delay);
        this.pendingTimers.push(timerId);
    }
  }

  private savePendingNotification(notification: PendingNotification) {
    const pending = this.getPendingNotifications();
    const updated = [...pending.filter(n => n.id !== notification.id), notification];
    localStorage.setItem('pendingNotifications', JSON.stringify(updated));
  }

  private removePendingNotification(id: string) {
    const pending = this.getPendingNotifications();
    const updated = pending.filter(n => n.id !== id);
    localStorage.setItem('pendingNotifications', JSON.stringify(updated));
  }
  
  private getPendingNotifications(): PendingNotification[] {
      try {
        return JSON.parse(localStorage.getItem('pendingNotifications') || '[]');
      } catch {
        return [];
      }
  }

  checkPendingNotifications() {
    const pending = this.getPendingNotifications();
    const now = Date.now();
    const remaining: PendingNotification[] = [];

    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];

    pending.forEach(notif => {
      if (notif.triggerTime <= now) {
        this.sendNotification(notif.title, notif.options);
      } else {
        remaining.push(notif);
        this.scheduleTimer(notif);
      }
    });

    localStorage.setItem('pendingNotifications', JSON.stringify(remaining));
  }

  cancelAllNotifications() {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
    localStorage.removeItem('pendingNotifications');
  }
}

export const notificationService = new NotificationService();