// Manages sending alert notifications through various channels
// TODO: Implement actual integrations with notification services (Email, SMS, Slack, etc.)

import { Alert } from './alert-manager'; // Assuming Alert interface is in alert-manager.ts

export type NotificationChannel = 'email' | 'sms' | 'slack' | 'webhook';

export interface NotificationRecipient {
  channel: NotificationChannel;
  target: string; // e.g., email address, phone number, Slack channel ID, webhook URL
  severities?: Array<'critical' | 'warning' | 'info'>; // Only send for these severities
}

export class NotificationManager {
  private recipients: NotificationRecipient[];

  constructor() {
    this.recipients = [];
    this.loadDefaultRecipients(); // Load some example recipients
  }

  private loadDefaultRecipients(): void {
    // Example recipients - in a real system, these would come from config
    this.addRecipient({
      channel: 'email',
      target: 'alerts@example.com',
      severities: ['critical', 'warning'],
    });
    this.addRecipient({
      channel: 'slack',
      target: '#alerts-channel-id', // Or a webhook URL for Slack
      severities: ['critical'],
    });
    this.addRecipient({
      channel: 'sms',
      target: '+15551234567', // Example phone number
      severities: ['critical'],
    });
  }

  public addRecipient(recipient: NotificationRecipient): void {
    // Basic validation to prevent duplicate target for the same channel
    if (this.recipients.some(r => r.channel === recipient.channel && r.target === recipient.target)) {
      console.warn(`Recipient ${recipient.target} for channel ${recipient.channel} already exists. Skipping.`);
      return;
    }
    this.recipients.push(recipient);
    console.log(`Notification recipient added: ${recipient.channel} - ${recipient.target}`);
  }

  public removeRecipient(channel: NotificationChannel, target: string): boolean {
    const initialLength = this.recipients.length;
    this.recipients = this.recipients.filter(
      r => !(r.channel === channel && r.target === target)
    );
    if (this.recipients.length < initialLength) {
      console.log(`Notification recipient removed: ${channel} - ${target}`);
      return true;
    }
    console.warn(`Recipient ${target} for channel ${channel} not found for removal.`);
    return false;
  }

  public getRecipients(): NotificationRecipient[] {
    return [...this.recipients];
  }

  public sendNotification(alert: Alert, channels?: NotificationChannel[], type: 'ALERT' | 'RESOLVED' = 'ALERT'): void {
    const subject = type === 'ALERT'
        ? `ALERT: ${alert.severity.toUpperCase()} - ${alert.name}`
        : `RESOLVED: ${alert.name}`;

    const body = `
      Alert ID: ${alert.id}
      Name: ${alert.name}
      Severity: ${alert.severity.toUpperCase()}
      Message: ${alert.message}
      Timestamp: ${alert.timestamp.toISOString()}
      Triggered By: ${alert.triggeredBy}
      ${alert.value !== undefined ? `Value: ${alert.value}` : ''}
      ${alert.threshold ? `Threshold: ${JSON.stringify(alert.threshold)}` : ''}
      Status: ${alert.status.toUpperCase()}
      ${type === 'RESOLVED' && alert.details?.resolutionMessage ? `Resolution: ${alert.details.resolutionMessage}` : ''}
      Details: ${JSON.stringify(alert.details || {}, null, 2)}
    `;

    const targetChannels = channels || this.recipients.map(r => r.channel);

    this.recipients.forEach(recipient => {
      if (targetChannels.includes(recipient.channel)) {
        if (recipient.severities && !recipient.severities.includes(alert.severity) && type === 'ALERT') {
          // Skip if alert severity is not in recipient's configured severities for new alerts
          return;
        }

        switch (recipient.channel) {
          case 'email':
            this.sendEmail(recipient.target, subject, body, alert);
            break;
          case 'sms':
            this.sendSms(recipient.target, `${subject}: ${alert.message.substring(0,100)}...`); // SMS has length limits
            break;
          case 'slack':
            this.sendSlackMessage(recipient.target, subject, body, alert);
            break;
          case 'webhook':
            this.sendWebhook(recipient.target, alert);
            break;
          default:
            console.warn(`Unsupported notification channel: ${recipient.channel}`);
        }
      }
    });
  }

  // Placeholder implementations for actual sending logic
  private sendEmail(to: string, subject: string, body: string, alertData: Alert): void {
    // TODO: Implement email sending logic (e.g., using nodemailer or an API)
    console.log(`EMAIL SENT to ${to} | Subject: ${subject}\nBody:\n${body}`);
    // In a real scenario, you might format this as HTML or use templates.
  }

  private sendSms(to: string, message: string): void {
    // TODO: Implement SMS sending logic (e.g., using Twilio or similar API)
    console.log(`SMS SENT to ${to} | Message: ${message}`);
  }

  private sendSlackMessage(target: string, subject: string, body: string, alertData: Alert): void {
    // TODO: Implement Slack messaging logic (e.g., using Slack API or incoming webhooks)
    // Target could be a channel ID or a user ID.
    // Slack messages are often formatted with blocks for better readability.
    const slackPayload = {
      text: subject, // Fallback text
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: subject,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${alertData.severity.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Status:*\n${alertData.status.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Timestamp:*\n${alertData.timestamp.toISOString()}` },
            { type: 'mrkdwn', text: `*Triggered By:*\n${alertData.triggeredBy}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n${alertData.message}`,
          },
        },
        // Add more blocks for details, value, threshold etc.
      ],
    };
    console.log(`SLACK MESSAGE SENT to ${target} | Payload: ${JSON.stringify(slackPayload, null, 2)}`);
  }

  private sendWebhook(url: string, alertData: Alert): void {
    // TODO: Implement webhook sending logic (e.g., using axios or fetch)
    console.log(`WEBHOOK SENT to ${url} | Payload: ${JSON.stringify(alertData, null, 2)}`);
    // fetch(url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(alertData),
    // }).catch(error => console.error(`Failed to send webhook to ${url}:`, error));
  }
}