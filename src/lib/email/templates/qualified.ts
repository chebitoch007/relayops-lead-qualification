import type { EmailMessage } from '@/lib/email/types';
import { renderEmailLayout } from './email-layout';

/**
 * `to` is part of the data shape (rather than a separate parameter)
 * because EmailMessage requires it structurally — the template itself
 * doesn't know the recipient, the caller in /api/leads does (lead.email).
 */
export interface QualifiedEmailData {
  to: string;
  name: string;
  bookingUrl: string;
}

export function qualifiedEmail({ to, name, bookingUrl }: QualifiedEmailData): EmailMessage {
  const firstName = name.split(' ')[0] || name;

  const bodyHtml = `
    <p style="margin: 0 0 16px;">Hi ${firstName},</p>
    <p style="margin: 0 0 16px;">
      Thanks for sharing the details on your agency. Based on what you told us, this looks like a
      genuinely good fit \u2014 the kind of operational gap we built RelayOps to close.
    </p>
    <p style="margin: 0 0 16px;">
      The next step is a quick discovery call. No generic pitch \u2014 we'll come in with specifics
      based on what you've already shared, and you'll leave knowing exactly what working together
      would look like.
    </p>
    <p style="margin: 0;">Grab a time below \u2014 it usually takes under a minute:</p>
  `;

  const html = renderEmailLayout({
    preheader: `${firstName}, you're a fit \u2014 pick a time for your discovery call.`,
    heading: 'You\u2019re a strong fit \u2014 let\u2019s find time to talk.',
    bodyHtml,
    ctaLabel: 'Book your discovery call',
    ctaUrl: bookingUrl,
  });

  const text = [
    `Hi ${firstName},`,
    '',
    "Thanks for sharing the details on your agency. Based on what you told us, this looks like a genuinely good fit \u2014 the kind of operational gap we built RelayOps to close.",
    '',
    "The next step is a quick discovery call. No generic pitch \u2014 we'll come in with specifics based on what you've already shared, and you'll leave knowing exactly what working together would look like.",
    '',
    `Book your discovery call: ${bookingUrl}`,
    '',
    '\u2014 RelayOps',
  ].join('\n');

  return {
    to,
    subject: 'Your discovery call with RelayOps \u2014 book your slot',
    html,
    text,
  };
}
