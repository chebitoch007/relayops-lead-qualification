import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { leadFormSchema } from '@/lib/validation/lead-schema';
import { qualificationService } from '@/lib/ai/gemini-client';
import { QualificationError } from '@/lib/ai/types';
import { getCrmAdapter, CrmAdapterError } from '@/lib/crm';
import { getEmailProvider } from '@/lib/email';
import { qualifiedEmail } from '@/lib/email/templates/qualified';
import { maybeQualifiedEmail } from '@/lib/email/templates/maybe-qualified';
import { notQualifiedEmail } from '@/lib/email/templates/not-qualified';
import { founderNotificationEmail } from '@/lib/email/templates/founder-notification';
import { buildBookingLink } from '@/lib/booking/calendly';
import { env } from '@/lib/config/env';
import type { CrmRecord, Lead, LeadInput, LeadStatus } from '@/types';

/**
 * Orchestrates the full intake → qualify → persist → notify flow described
 * in the workflow logic section of the project brief:
 *
 *   form submit → AI qualification → CRM record → branch:
 *     qualified       → Calendly link issued, lead + founder emailed
 *     maybe_qualified  → lead + founder emailed, routed to manual review queue
 *     not_qualified    → respectful decline emailed, founder notified, archived
 *
 * Email sends happen directly here (not via n8n) since both templates only
 * need data already in hand by this point, and are intentionally
 * non-blocking — a failed send is logged but never fails the HTTP response;
 * the CRM record remains the source of truth regardless.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const leadInput: LeadInput = {
    ...parsed.data,
    additionalNotes: parsed.data.additionalNotes || undefined,
  };

  const now = new Date().toISOString();
  const lead: Lead = {
    ...leadInput,
    id: randomUUID(),
    status: 'qualifying',
    createdAt: now,
    updatedAt: now,
  };

  let qualification;
  try {
    qualification = await qualificationService.qualify(leadInput);
  } catch (err) {
    if (err instanceof QualificationError) {
      console.error('Qualification failed', err.cause);
      return NextResponse.json(
        { error: 'Unable to evaluate this lead right now. Please try again shortly.' },
        { status: 502 },
      );
    }
    throw err;
  }

  // qualification.status ('qualified' | 'maybe_qualified' | 'not_qualified')
  // is itself a valid LeadStatus value — reused directly rather than mapped.
  const finalStatus: LeadStatus = qualification.status;
  const isQualified = qualification.status === 'qualified';
  const booking = isQualified ? buildBookingLink({ id: lead.id, name: lead.name, email: lead.email }) : null;

  const record: CrmRecord = {
    leadId: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    website: lead.website,
    monthlyLeadVolume: lead.monthlyLeadVolume,
    teamSize: lead.teamSize,
    monthlyRevenue: lead.monthlyRevenue,
    existingCrm: lead.existingCrm,
    biggestChallenge: lead.biggestChallenge,
    additionalNotes: lead.additionalNotes ?? '',
    status: finalStatus,
    score: qualification.score,
    qualificationStatus: qualification.status,
    confidence: qualification.confidence,
    summary: qualification.summary,
    recommendedNextStep: qualification.recommendedNextStep,
    internalNotes: qualification.internalNotes,
    bookingStatus: booking ? 'link_sent' : 'not_applicable',
    bookingUrl: booking?.url ?? '',
    createdAt: lead.createdAt,
    updatedAt: now,
  };

  try {
    const crm = getCrmAdapter();
    await crm.createRecord(record);
  } catch (err) {
    if (err instanceof CrmAdapterError) {
      console.error('CRM write failed', err.cause);
      return NextResponse.json(
        { error: 'Your information could not be saved right now. Please try again shortly.' },
        { status: 502 },
      );
    }
    throw err;
  }

  // Transactional (to the lead) and internal (to the founder) emails are
  // sent here directly rather than waiting on n8n, since both templates
  // only need data already in hand. Each send is independently
  // try/caught and logged — a failed email must never fail the lead
  // submission itself; the CRM record is already the source of truth.
  try {
    const emailProvider = getEmailProvider();
    const leadEmail =
      qualification.status === 'qualified'
        ? qualifiedEmail({ to: lead.email, name: lead.name, bookingUrl: booking?.url ?? '' })
        : qualification.status === 'maybe_qualified'
          ? maybeQualifiedEmail({ to: lead.email, name: lead.name })
          : notQualifiedEmail({ to: lead.email, name: lead.name });
    await emailProvider.send(leadEmail);
  } catch (err) {
    console.error('Failed to send lead notification email', err);
  }

  try {
    const emailProvider = getEmailProvider();
    await emailProvider.send(
      founderNotificationEmail({
        to: env.FOUNDER_NOTIFICATION_EMAIL,
        lead: { id: lead.id, name: lead.name, email: lead.email, company: lead.company },
        qualification,
        monthlyRevenue: lead.monthlyRevenue,
        monthlyLeadVolume: lead.monthlyLeadVolume,
        bookingStatus: record.bookingStatus,
        bookingUrl: booking?.url,
      }),
    );
  } catch (err) {
    console.error('Failed to send founder notification email', err);
  }

  return NextResponse.json(
    {
      leadId: lead.id,
      status: qualification.status,
      bookingUrl: booking?.url,
    },
    { status: 201 },
  );
}
