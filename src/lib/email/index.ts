import { env } from '@/lib/config/env';
import type { EmailProvider } from './types';
import { GmailSmtpProvider } from './gmail-smtp';
import { ResendProvider, SendgridProvider } from './future-providers';

export type { EmailProvider, EmailMessage } from './types';
export { EmailProviderError } from './types';

let cachedProvider: EmailProvider | null = null;

/**
 * Returns the active EmailProvider based on EMAIL_PROVIDER. Callers (the
 * transactional email sender, the founder-notification sender, once
 * built) should always go through this function rather than importing a
 * concrete provider directly — same rationale as getCrmAdapter() in
 * src/lib/crm/index.ts.
 */
export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  switch (env.EMAIL_PROVIDER) {
    case 'gmail_smtp':
      cachedProvider = new GmailSmtpProvider();
      break;
    case 'resend':
      cachedProvider = new ResendProvider();
      break;
    case 'sendgrid':
      cachedProvider = new SendgridProvider();
      break;
    default: {
      const _exhaustive: never = env.EMAIL_PROVIDER;
      throw new Error(`Unhandled EMAIL_PROVIDER: ${_exhaustive}`);
    }
  }
  return cachedProvider;
}
