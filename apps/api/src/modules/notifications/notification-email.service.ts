import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

/** Never log the URL, SMTP response, message body, recipient, or credentials. */
@Injectable()
export class NotificationEmailService {
  configured(): boolean {
    return !!process.env.NOTIFICATION_SMTP_URL && !!process.env.NOTIFICATION_FROM_EMAIL;
  }

  async send(to: string, messageId: string): Promise<void> {
    const raw = process.env.NOTIFICATION_SMTP_URL;
    const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (!raw || !from) throw new Error('SMTP_NOT_CONFIGURED');
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error('SMTP_INVALID_CONFIG'); }
    if (!['smtp:', 'smtps:'].includes(url.protocol) || !url.hostname ||
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
      throw new Error('SMTP_INVALID_CONFIG');
    }
    // STARTTLS is required for smtp://; smtps:// is implicit TLS. Neither
    // credentials nor business identifiers are included in the message body.
    const transport = nodemailer.createTransport(raw, {
      requireTLS: url.protocol === 'smtp:',
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    });
    try {
      await transport.sendMail({ from, to, messageId: `<notification-${messageId}@shipping-erp.local>`,
        subject: 'Shipping ERP: action needs your attention',
        text: 'You have a notification in Shipping ERP. Sign in to review it. No financial or customer details are sent by email.',
      });
    } catch {
      // SMTP exceptions sometimes embed connection URLs, usernames or message
      // fragments. Only a fixed, non-sensitive code reaches the DB/audit/logs.
      throw new Error('SMTP_SEND_FAILED');
    } finally {
      transport.close();
    }
  }
}
