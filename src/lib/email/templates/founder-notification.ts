import type { FounderNotificationPayload } from '@/types';
import type { EmailMessage } from '@/lib/email/types';
import { renderEmailLayout, emailColors } from './email-layout';

export type FounderNotificationEmailData = FounderNotificationPayload & { to: string };

const STATUS_LABELS: Record<FounderNotificationPayload['qualification']['status'], string> = {
  qualified: 'Qualified',
  maybe_qualified: 'Maybe Qualified',
  not_qualified: 'Not Qualified',
};

const REVENUE_LABELS: Record<FounderNotificationPayload['monthlyRevenue'], string> = {
  under_10k: 'Under $10k',
  '10k_50k': '$10k \u2013 $50k',
  '50k_150k': '$50k \u2013 $150k',
  '150k_500k': '$150k \u2013 $500k',
  '500k_plus': '$500k+',
  prefer_not_to_say: 'Prefer not to say',
};

function dataRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 6px 0; font-size: 12px; font-family: 'Courier New', monospace; letter-spacing: 0.5px; color: ${emailColors.muted}; text-transform: uppercase; vertical-align: top; width: 140px;">
        ${label}
      </td>
      <td style="padding: 6px 0; font-size: 14px; color: ${emailColors.text}; vertical-align: top;">
        ${value}
      </td>
    </tr>`;
}

export function founderNotificationEmail(data: FounderNotificationEmailData): EmailMessage {
  const { to, lead, qualification, monthlyRevenue, monthlyLeadVolume, bookingStatus, bookingUrl } = data;
  const statusLabel = STATUS_LABELS[qualification.status];
  const revenueLabel = REVENUE_LABELS[monthlyRevenue];

  const rows = [
    dataRow('Lead', `${lead.name} &middot; ${lead.email}`),
    dataRow('Company', lead.company),
    dataRow('Score', `${qualification.score}/10`),
    dataRow('Status', statusLabel),
    dataRow('Revenue', revenueLabel),
    dataRow('Lead volume', monthlyLeadVolume),
    dataRow('Booking', bookingUrl ? `${bookingStatus} \u2014 <a href="${bookingUrl}" style="color: ${emailColors.electric};">${bookingUrl}</a>` : bookingStatus),
    dataRow('Next step', qualification.recommendedNextStep),
  ].join('');

  const bodyHtml = `
    <p style="margin: 0 0 18px;">${qualification.summary}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-top: 1px solid ${emailColors.border}; border-bottom: 1px solid ${emailColors.border};">
      ${rows}
    </table>
    <div style="margin-top: 18px; padding: 14px 16px; background: #F4F6FA; border-radius: 8px;">
      <p style="margin: 0 0 4px; font-size: 11px; font-family: 'Courier New', monospace; letter-spacing: 0.5px; color: ${emailColors.muted}; text-transform: uppercase;">
        Internal notes
      </p>
      <p style="margin: 0; font-size: 13px; color: ${emailColors.text};">${qualification.internalNotes}</p>
    </div>
  `;

  const html = renderEmailLayout({
    preheader: `${lead.company} \u2014 ${statusLabel}, score ${qualification.score}/10`,
    heading: `New lead: ${lead.company} (${statusLabel})`,
    bodyHtml,
  });

  const text = [
    `New lead: ${lead.company} (${statusLabel})`,
    '',
    qualification.summary,
    '',
    `Lead: ${lead.name} <${lead.email}>`,
    `Company: ${lead.company}`,
    `Score: ${qualification.score}/10`,
    `Status: ${statusLabel}`,
    `Revenue: ${revenueLabel}`,
    `Lead volume: ${monthlyLeadVolume}`,
    `Booking: ${bookingStatus}${bookingUrl ? ` \u2014 ${bookingUrl}` : ''}`,
    `Next step: ${qualification.recommendedNextStep}`,
    '',
    `Internal notes: ${qualification.internalNotes}`,
  ].join('\n');

  return {
    to,
    subject: `New lead: ${lead.company} \u2014 ${statusLabel} (${qualification.score}/10)`,
    html,
    text,
  };
}
