import { NextRequest, NextResponse } from 'next/server';
import { verifyCalendlyWebhookSignature, CalendlyError } from '@/lib/booking/calendly';
import { getCrmAdapter, CrmAdapterError } from '@/lib/crm';
import type { BookingStatus, CrmRecord } from '@/types';

/**
 * Direct Calendly → Next.js webhook path. Where /api/webhooks/n8n receives
 * already-verified, already-normalized booking updates relayed by the n8n
 * workflow, this route talks to Calendly itself — useful when n8n isn't
 * configured at all, and it means the booking-completion loop doesn't have
 * a hard dependency on a second running service.
 *
 * Both routes converge on the same CRM patch shape (BookingStatus +
 * status='booked' on confirmation) — see /api/webhooks/n8n/route.ts and
 * docs/architecture.md for how the two paths relate.
 */

interface CalendlyPayload {
  tracking?: { utm_content?: string | null };
  event?: string;
}

interface CalendlyWebhookBody {
  event?: string;
  payload?: CalendlyPayload;
}

export async function POST(request: NextRequest) {
  // Raw body is required for HMAC verification — request.json() would
  // re-serialize the parsed object, which won't byte-for-byte match what
  // Calendly actually signed.
  const rawBody = await request.text();

  try {
    verifyCalendlyWebhookSignature(rawBody, request.headers.get('calendly-webhook-signature'));
  } catch (err) {
    if (err instanceof CalendlyError) {
      console.error('Calendly webhook signature verification failed', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    throw err;
  }

  let body: CalendlyWebhookBody;
  try {
    body = JSON.parse(rawBody) as CalendlyWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const eventType = body.event;
  let bookingStatus: BookingStatus | null = null;

  switch (eventType) {
    case 'invitee.created':
      bookingStatus = 'booked';
      break;
    case 'invitee.canceled':
      bookingStatus = 'cancelled';
      break;
    case 'invitee_no_show.created':
      bookingStatus = 'no_show';
      break;
    default:
      // Calendly retries on any non-2xx response, and we genuinely don't
      // care about event types we don't handle — always 200 here so an
      // event type Calendly adds later doesn't cause a retry storm.
      return NextResponse.json({ ok: true, handled: false });
  }

  const leadId = body.payload?.tracking?.utm_content;
  if (!leadId) {
    // Same reasoning as the unknown-event-type case: this is a Calendly
    // event we don't have enough information to act on (e.g. a booking
    // made directly through the public Calendly page without our
    // utm_content prefill), not a failure on our end. Log it for
    // visibility, but never make Calendly retry over it.
    console.error(`Calendly webhook (${eventType}) had no leadId in payload.tracking.utm_content`);
    return NextResponse.json({ ok: true, handled: false });
  }

  // invitee.created carries the booked event's own URI under payload.event
  // (Calendly's "event" here means the scheduled-event resource, not the
  // webhook event type — easy to confuse, hence the explicit type names
  // above this function).
  const bookingUrl =
    eventType === 'invitee.created' && typeof body.payload?.event === 'string' ? body.payload.event : undefined;

  const patch: Partial<CrmRecord> = { bookingStatus };
  if (bookingStatus === 'booked') {
    patch.status = 'booked';
  }
  if (bookingUrl) {
    patch.bookingUrl = bookingUrl;
  }

  try {
    const crm = getCrmAdapter();
    await crm.updateRecord(leadId, patch);
    return NextResponse.json({ ok: true, handled: true });
  } catch (err) {
    if (err instanceof CrmAdapterError) {
      console.error('CRM update from Calendly webhook failed', err.cause);
      return NextResponse.json({ error: 'Failed to update lead record' }, { status: 502 });
    }
    throw err;
  }
}
