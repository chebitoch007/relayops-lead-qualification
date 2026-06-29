import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { getCrmAdapter, CrmAdapterError } from '@/lib/crm';
import type { BookingStatus, CrmRecord } from '@/types';

/**
 * n8n pushes status updates here after it handles booking-link delivery,
 * founder notification, and transactional email — this keeps the CRM
 * record's `bookingStatus` (and `status`, once a booking completes)
 * accurate without the Next.js app needing to poll Calendly or the email
 * provider itself.
 *
 * Shared-secret auth via header for v1; swap for HMAC signature
 * verification (same pattern called out in lib/booking/calendly.ts for
 * Calendly's own webhooks) before this leaves internal/demo use.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret');
  if (!env.N8N_WEBHOOK_SECRET || secret !== env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const payload = body as { leadId?: string; bookingStatus?: BookingStatus; bookingUrl?: string };
  if (!payload.leadId) {
    return NextResponse.json({ error: 'leadId is required' }, { status: 422 });
  }

  const patch: Partial<CrmRecord> = {};
  if (payload.bookingStatus) {
    patch.bookingStatus = payload.bookingStatus;
    // A completed booking is the one case where booking status feeds back
    // into the lead's overall lifecycle status.
    if (payload.bookingStatus === 'booked') {
      patch.status = 'booked';
    }
  }
  if (payload.bookingUrl) patch.bookingUrl = payload.bookingUrl;

  try {
    const crm = getCrmAdapter();
    await crm.updateRecord(payload.leadId, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CrmAdapterError) {
      console.error('CRM update from n8n webhook failed', err.cause);
      return NextResponse.json({ error: 'Failed to update lead record' }, { status: 502 });
    }
    throw err;
  }
}
