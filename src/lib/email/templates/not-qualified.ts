import type { EmailMessage } from '@/lib/email/types';
import { renderEmailLayout } from './email-layout';

export interface NotQualifiedEmailData {
  to: string;
  name: string;
}

export function notQualifiedEmail({ to, name }: NotQualifiedEmailData): EmailMessage {
  const firstName = name.split(' ')[0] || name;

  const bodyHtml = `
    <p style="margin: 0 0 16px;">Hi ${firstName},</p>
    <p style="margin: 0 0 16px;">
      Thanks for taking the time to tell us about your agency. Based on what you shared, we don't
      think we're the right fit for where things stand right now \u2014 and we'd rather tell you that
      directly than waste your time with a call that won't go anywhere.
    </p>
    <p style="margin: 0 0 16px;">
      One thing worth considering in the meantime: before automating lead qualification, it's
      usually worth running it manually for a few weeks first. Tracking which inbound leads
      actually convert \u2014 and why \u2014 gives you the criteria that make automation (whenever
      you're ready for it) genuinely accurate, instead of guessing at what "qualified" should mean.
    </p>
    <p style="margin: 0;">
      If your situation changes, we'd be glad to take another look \u2014 just reach back out.
    </p>
  `;

  const html = renderEmailLayout({
    preheader: "Thanks for reaching out \u2014 here's where things stand, plus a tip either way.",
    heading: 'Thanks for reaching out.',
    bodyHtml,
  });

  const text = [
    `Hi ${firstName},`,
    '',
    "Thanks for taking the time to tell us about your agency. Based on what you shared, we don't think we're the right fit for where things stand right now \u2014 and we'd rather tell you that directly than waste your time with a call that won't go anywhere.",
    '',
    "One thing worth considering in the meantime: before automating lead qualification, it's usually worth running it manually for a few weeks first. Tracking which inbound leads actually convert \u2014 and why \u2014 gives you the criteria that make automation (whenever you're ready for it) genuinely accurate, instead of guessing at what \"qualified\" should mean.",
    '',
    "If your situation changes, we'd be glad to take another look \u2014 just reach back out.",
    '',
    '\u2014 RelayOps',
  ].join('\n');

  return {
    to,
    subject: 'Thanks for reaching out',
    html,
    text,
  };
}
