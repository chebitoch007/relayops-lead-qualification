import type { CrmRecord } from '@/types';

/**
 * Provider-agnostic CRM contract. Route handlers and n8n-facing API
 * routes depend only on this interface, never on a concrete provider —
 * that's what lets CRM_PROVIDER switch from google_sheets to hubspot
 * later with zero changes to business logic, per the brief's
 * "architecture must allow future migration ... without changing
 * business logic" requirement.
 *
 * Keep this interface minimal and CRUD-shaped. Provider-specific
 * capabilities (e.g. HubSpot deal pipelines, Pipedrive custom fields)
 * belong inside that provider's adapter, mapped to/from CrmRecord — they
 * should never leak into this interface.
 */
export interface CrmAdapter {
  /** Human-readable provider name, surfaced in logs and error messages. */
  readonly providerName: string;

  /** Create a new record for a freshly-captured lead. Returns the stored record. */
  createRecord(record: CrmRecord): Promise<CrmRecord>;

  /**
   * Merge-update an existing record by leadId (e.g. after qualification
   * completes, or a booking webhook fires). Only the provided fields are
   * changed; everything else is left as-is.
   */
  updateRecord(leadId: string, patch: Partial<CrmRecord>): Promise<CrmRecord>;

  /** Look up a single record. Returns null if no record exists for leadId. */
  getRecord(leadId: string): Promise<CrmRecord | null>;
}

export class CrmAdapterError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'CrmAdapterError';
  }
}
