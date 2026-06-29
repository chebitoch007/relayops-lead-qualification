import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/config/env';
import type { Lead } from '@/types';

/**
 * Booking link issuance is complete. Webhook signature verification
 * (below) now has two live consumers: the n8n workflow's own Calendly
 * trigger (which re-implements the same HMAC check in a Code node — see
 * n8n/relayops-lead-qualification.json) and src/app/api/webhooks/calendly,
 * a direct Next.js path that doesn't depend on n8n being configured at
 * all. Both converge on the same CRM patch logic.
 */

export interface BookingLinkResult {
  url: string;
  leadId: string;
}

/**
 * Builds a Calendly link with lead info passed as URL params where the
 * event type supports prefill (name/email). Calendly's prefill query params
 * are `name` and `email`; anything else (company, score) is carried via the
 * `a1`/`a2` custom question params if the event type defines them, or simply
 * omitted — Calendly does not support arbitrary metadata in the URL itself.
 */
export function buildBookingLink(lead: Pick<Lead, 'id' | 'name' | 'email'>): BookingLinkResult {
  const base = env.NEXT_PUBLIC_CALENDLY_BOOKING_URL;
  const url = new URL(base);
  url.searchParams.set('name', lead.name);
  url.searchParams.set('email', lead.email);
  // Carries our lead id through Calendly's UTM passthrough so the webhook
  // payload can be matched back to a CRM record.
  url.searchParams.set('utm_content', lead.id);

  return { url: url.toString(), leadId: lead.id };
}

export class CalendlyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CalendlyError';
  }
}

/**
 * Verifies Calendly's webhook signature (same pattern as Stripe's): the
 * `calendly-webhook-signature` header is `t=<unix_seconds>,v1=<hex_hmac>`,
 * where the signed payload is `${t}.${rawBody}` HMAC-SHA256'd with the
 * subscription's signing key.
 *
 * `rawBody` must be the exact, unparsed request body string — HMAC over a
 * re-serialized JSON object will not match Calendly's signature if key
 * order or whitespace differs even slightly from what Calendly sent.
 *
 * Returns `true` on success; throws `CalendlyError` (never returns `false`)
 * so callers can't accidentally ignore a falsy return value and proceed
 * anyway. Each failure mode gets its own message for debugging — "it
 * didn't verify" is much harder to act on than "timestamp is 14 minutes
 * old" or "signing key is empty string".
 */
export function verifyCalendlyWebhookSignature(rawBody: string, signatureHeader: string | null): true {
  if (!env.CALENDLY_WEBHOOK_SIGNING_KEY) {
    throw new CalendlyError('CALENDLY_WEBHOOK_SIGNING_KEY is not configured; cannot verify webhook signature');
  }

  if (!signatureHeader) {
    throw new CalendlyError('Missing calendly-webhook-signature header');
  }

  // Header is a comma-separated list of key=value pairs, e.g.
  // "t=1700000000,v1=abcdef0123...". Order isn't guaranteed, so parse both
  // keys out rather than assuming position.
  const parts = new Map<string, string>();
  for (const segment of signatureHeader.split(',')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) continue;
    parts.set(segment.slice(0, separatorIndex).trim(), segment.slice(separatorIndex + 1).trim());
  }

  const timestamp = parts.get('t');
  const signature = parts.get('v1');

  if (!timestamp || !signature) {
    throw new CalendlyError(
      `Malformed calendly-webhook-signature header (expected "t=...,v1=..."): "${signatureHeader}"`,
    );
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    throw new CalendlyError(`Malformed timestamp in calendly-webhook-signature header: "${timestamp}"`);
  }

  // Reject anything older than 5 minutes to prevent a captured request
  // from being replayed later — a valid-looking signature on a stale
  // request is still a replay attack, not a legitimate event.
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > 300) {
    throw new CalendlyError(`Webhook timestamp is too old (${Math.round(ageSeconds)}s) — possible replay attack`);
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac('sha256', env.CALENDLY_WEBHOOK_SIGNING_KEY)
    .update(signedPayload)
    .digest('hex');

  // Both buffers must be equal length for timingSafeEqual — a length
  // mismatch means the signature is wrong regardless, so fail fast with a
  // clear message rather than letting timingSafeEqual throw its own
  // generic RangeError.
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new CalendlyError('Webhook signature does not match — payload may have been tampered with');
  }

  return true;
}
