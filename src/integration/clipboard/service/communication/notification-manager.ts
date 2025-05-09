import { EventEmitter } from 'events';
import { Notification } from 'electron';

export class NotificationManager extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();

  constructor() {
    super();
  }

  show(title: string, body: string, id?: string): string {
    const notificationId = id || Date.now().toString();
    const notification = new Notification({
      title,
      body
    });

    notification.on('click', () => {
      this.emit('notification-clicked', notificationId);
    });

    notification.on('close', () => {
      this.notifications.delete(notificationId);
      this.emit('notification-closed', notificationId);
    });

    notification.show();
    this.notifications.set(notificationId, notification);

    return notificationId;
  }

  close(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.close();
      this.notifications.delete(notificationId);
    }
  }

  closeAll(): void {
    this.notifications.forEach(notification => notification.close());
    this.notifications.clear();
  }
}