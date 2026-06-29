import type { EmailMessage } from '@/lib/email/types';
import { renderEmailLayout } from './email-layout';

export interface MaybeQualifiedEmailData {
  to: string;
  name: string;
}

export function maybeQualifiedEmail({ to, name }: MaybeQualifiedEmailData): EmailMessage {
  const firstName = name.split(' ')[0] || name;

  const bodyHtml = `
    <p style="margin: 0 0 16px;">Hi ${firstName},</p>
    <p style="margin: 0 0 16px;">
      Thanks for telling us about your agency. A few of the details you shared raised some genuinely
      good questions, so rather than route you automatically, we're having a real person on our team
      take a look.
    </p>
    <p style="margin: 0 0 16px;">
      You'll hear back from us within <strong>1\u20132 business days</strong> with either a time to talk
      or some specific next steps \u2014 whichever fits best based on where your agency is right now.
    </p>
    <p style="margin: 0;">No action needed on your end in the meantime. We'll be in touch.</p>
  `;

  const html = renderEmailLayout({
    preheader: "We're reviewing your details and will follow up within 1\u20132 business days.",
    heading: "We're reviewing your application.",
    bodyHtml,
  });

  const text = [
    `Hi ${firstName},`,
    '',
    "Thanks for telling us about your agency. A few of the details you shared raised some genuinely good questions, so rather than route you automatically, we're having a real person on our team take a look.",
    '',
    "You'll hear back from us within 1\u20132 business days with either a time to talk or some specific next steps \u2014 whichever fits best based on where your agency is right now.",
    '',
    "No action needed on your end in the meantime. We'll be in touch.",
    '',
    '\u2014 RelayOps',
  ].join('\n');

  return {
    to,
    subject: "We're reviewing your application",
    html,
    text,
  };
}
