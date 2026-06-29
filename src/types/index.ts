/**
 * Domain types for the RelayOps lead qualification system.
 *
 * This file is the contract every other layer is built against:
 * - src/lib/validation/lead-schema.ts derives its zod schema's enums from
 *   the band constants below, so the form, the API route, and any future
 *   client (n8n, a mobile app) all validate against the same source.
 * - src/lib/ai derives its Gemini response schema from QualificationResult.
 * - src/lib/crm adapters all read/write the CrmRecord shape, regardless of
 *   which provider (Google Sheets today, HubSpot/GHL/Pipedrive/Airtable
 *   later) is behind the adapter.
 */

// ─────────────────────────────────────────────────────────────────────────
// Lead intake
// ─────────────────────────────────────────────────────────────────────────

export const MONTHLY_LEAD_VOLUME_BANDS = [
  '0-10',
  '11-50',
  '51-200',
  '201-1000',
  '1000+',
] as const;
export type MonthlyLeadVolumeBand = (typeof MONTHLY_LEAD_VOLUME_BANDS)[number];

export const TEAM_SIZE_BANDS = ['1-3', '4-10', '11-25', '26-50', '50+'] as const;
export type TeamSizeBand = (typeof TEAM_SIZE_BANDS)[number];

export const MONTHLY_REVENUE_BANDS = [
  'under_10k',
  '10k_50k',
  '50k_150k',
  '150k_500k',
  '500k_plus',
  'prefer_not_to_say',
] as const;
export type MonthlyRevenueBand = (typeof MONTHLY_REVENUE_BANDS)[number];

export const CRM_OPTIONS = [
  'none',
  'spreadsheet',
  'hubspot',
  'gohighlevel',
  'pipedrive',
  'salesforce',
  'airtable',
  'other',
] as const;
export type CrmOption = (typeof CRM_OPTIONS)[number];

/** Raw shape submitted by the lead-capture form. No system fields. */
export interface LeadInput {
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  monthlyLeadVolume: MonthlyLeadVolumeBand;
  teamSize: TeamSizeBand;
  monthlyRevenue: MonthlyRevenueBand;
  existingCrm: CrmOption;
  biggestChallenge: string;
  additionalNotes?: string;
}

export type LeadStatus =
  | 'received'
  | 'qualifying'
  | 'qualified'
  | 'maybe_qualified'
  | 'not_qualified'
  | 'booked'
  | 'archived'
  | 'error';

/** A lead once it has an identity and has entered the system. */
export interface Lead extends LeadInput {
  id: string;
  status: LeadStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─────────────────────────────────────────────────────────────────────────
// AI qualification
// ─────────────────────────────────────────────────────────────────────────

export const QUALIFICATION_STATUSES = ['qualified', 'maybe_qualified', 'not_qualified'] as const;
export type QualificationStatusValue = (typeof QUALIFICATION_STATUSES)[number];

/**
 * Structured output the Gemini call must return. Kept deliberately small
 * and flat so it serializes cleanly into a single Google Sheets row and
 * into email templates without further transformation.
 */
export interface QualificationResult {
  score: number; // 1–10
  status: QualificationStatusValue;
  confidence: number; // 0–1
  summary: string; // 1–2 sentence human-readable summary
  recommendedNextStep: string;
  internalNotes: string;
}

export interface QualifiedLead extends Lead {
  qualification: QualificationResult;
}

// ─────────────────────────────────────────────────────────────────────────
// Booking
// ─────────────────────────────────────────────────────────────────────────

export type BookingStatus = 'not_applicable' | 'link_sent' | 'booked' | 'cancelled' | 'no_show';

// ─────────────────────────────────────────────────────────────────────────
// CRM (provider-agnostic record)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The shape every CrmAdapter reads and writes, regardless of backing
 * provider. Adapters are responsible for mapping this to/from their own
 * native shape (a Sheets row, a HubSpot contact + deal, etc.) — business
 * logic in route handlers and n8n only ever touches this type.
 */
export interface CrmRecord {
  leadId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  monthlyLeadVolume: MonthlyLeadVolumeBand;
  teamSize: TeamSizeBand;
  monthlyRevenue: MonthlyRevenueBand;
  existingCrm: CrmOption;
  biggestChallenge: string;
  additionalNotes: string;
  status: LeadStatus;
  score: number | null;
  qualificationStatus: QualificationStatusValue | null;
  confidence: number | null;
  summary: string;
  recommendedNextStep: string;
  internalNotes: string;
  bookingStatus: BookingStatus;
  bookingUrl: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'slack' | 'discord' | 'whatsapp';

export interface FounderNotificationPayload {
  lead: Pick<Lead, 'id' | 'name' | 'email' | 'company'>;
  qualification: QualificationResult;
  monthlyRevenue: MonthlyRevenueBand;
  monthlyLeadVolume: MonthlyLeadVolumeBand;
  bookingStatus: BookingStatus;
  bookingUrl?: string;
}
