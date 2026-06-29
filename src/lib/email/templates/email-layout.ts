/**
 * Shared HTML shell for transactional emails. Inline-styled (no <style>
 * blocks, no external CSS) because that's what survives across Gmail,
 * Outlook, and mobile mail clients without a templating engine. The body
 * itself stays light/white — dark-mode email rendering is inconsistent
 * across clients, so the brand identity (navy header bar, electric blue
 * CTA) is expressed in accents rather than a full dark background, unlike
 * the web app.
 */

const NAVY = '#0A0E17';
const ELECTRIC = '#2F6FF0';
const ELECTRIC_BRIGHT = '#5B8DFF';
const TEXT = '#1A2333';
const MUTED = '#64748B';
const BORDER = '#E5E9F0';

export interface EmailLayoutOptions {
  /** Short summary shown in inbox previews, hidden in the rendered body. */
  preheader: string;
  heading: string;
  /** Pre-rendered inner HTML — paragraphs, lists, the data block, etc. */
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function renderEmailLayout({ preheader, heading, bodyHtml, ctaLabel, ctaUrl }: EmailLayoutOptions): string {
  const cta =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 8px;">
          <tr>
            <td style="border-radius: 8px; background: ${ELECTRIC};">
              <a href="${ctaUrl}" target="_blank"
                 style="display: inline-block; padding: 14px 28px; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif;
                        font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background: #F4F6FA;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F4F6FA; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid ${BORDER};">
          <tr>
            <td style="background: ${NAVY}; padding: 22px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 22px; height: 22px; background: ${ELECTRIC}; border-radius: 5px;"></td>
                  <td style="padding-left: 10px; font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 1.5px; color: #AEB9D6; text-transform: uppercase;">
                    RelayOps
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px 32px;">
              <h1 style="margin: 0 0 16px; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size: 22px; line-height: 1.3; font-weight: 700; color: ${TEXT};">
                ${heading}
              </h1>
              <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: ${TEXT};">
                ${bodyHtml}
              </div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 28px; border-top: 1px solid ${BORDER};">
              <p style="margin: 0; font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; font-size: 12px; color: ${MUTED};">
                RelayOps &middot; AI-powered lead qualification for marketing agencies
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Re-exported so templates can build inline data rows without re-typing colors. */
export const emailColors = { navy: NAVY, electric: ELECTRIC, electricBright: ELECTRIC_BRIGHT, text: TEXT, muted: MUTED, border: BORDER };
