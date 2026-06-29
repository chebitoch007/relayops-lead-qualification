import nodemailer, { type Transporter } from 'nodemailer';
import { assertRequired, env } from '@/lib/config/env';
import { EmailProviderError, type EmailMessage, type EmailProvider } from './types';

/** Minimal, dependency-free HTML→text fallback for the rare caller that omits `text`. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export class GmailSmtpProvider implements EmailProvider {
  readonly providerName = 'gmail_smtp';

  private transporterPromise: Promise<Transporter> | null = null;

  private async getTransporter(): Promise<Transporter> {
    if (!this.transporterPromise) {
      this.transporterPromise = (async () => {
        const cfg = assertRequired(['GMAIL_SMTP_USER', 'GMAIL_SMTP_APP_PASSWORD'], 'Gmail SMTP provider');
        return nodemailer.createTransport({
          service: 'gmail',
          auth: { user: cfg.GMAIL_SMTP_USER, pass: cfg.GMAIL_SMTP_APP_PASSWORD },
        });
      })();
    }
    return this.transporterPromise;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      const transporter = await this.getTransporter();
      await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text ?? stripHtml(message.html),
      });
    } catch (cause) {
      throw new EmailProviderError(`Failed to send email to ${message.to}`, this.providerName, cause);
    }
  }
}
