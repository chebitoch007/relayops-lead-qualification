import { env } from '@/lib/config/env';
import type { Lead } from '@/types';

/**
 * v1 scope: build a personalized Calendly link and track booking status via
 * webhook. Full implementation (webhook signature verification, event
 * payload parsing) lands in the booking-integration phase — this module
 * defines the contract so the workflow/email layers can be built against it
 * now without blocking on Calendly API credentials.
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
 * Placeholder for webhook signature verification, to be implemented when
 * CALENDLY_WEBHOOK_SIGNING_KEY is wired up against a live Calendly webhook
 * subscription. Left explicit (rather than omitted) so the security
 * requirement is visible in the architecture from day one.
 */
export function verifyCalendlyWebhookSignature(_rawBody: string, _signatureHeader: string | null): boolean {
  if (!env.CALENDLY_WEBHOOK_SIGNING_KEY) {
    throw new CalendlyError('CALENDLY_WEBHOOK_SIGNING_KEY is not configured; cannot verify webhook signature');
  }
  // TODO(booking-phase): implement HMAC verification per Calendly's webhook
  // signing spec once a live webhook subscription exists to test against.
  throw new CalendlyError('Webhook signature verification not yet implemented');
}
