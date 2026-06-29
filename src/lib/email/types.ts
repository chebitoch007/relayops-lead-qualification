export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Falls back to a stripped version of html if omitted by a caller. */
  text?: string;
}

/**
 * Contract every email provider implements. Callers (transactional email
 * sender, founder-notification sender) depend only on this interface —
 * EMAIL_PROVIDER can move from gmail_smtp to resend or sendgrid in
 * production by changing one env var and adding that provider's class
 * below, with zero changes to template code or send call sites.
 */
export interface EmailProvider {
  readonly providerName: string;
  send(message: EmailMessage): Promise<void>;
}

export class EmailProviderError extends Error {
  constructor(message: string, public readonly provider: string, public readonly cause?: unknown) {
    super(`[${provider}] ${message}`);
    this.name = 'EmailProviderError';
  }
}
