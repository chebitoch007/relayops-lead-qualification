import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { assertRequired } from '@/lib/config/env';
import type { CrmRecord } from '@/types';
import { CrmAdapterError, type CrmAdapter } from './types';

const SHEET_TITLE = 'Leads';

/**
 * Column headers, in order. This array is the single source of truth for
 * the sheet's shape — `recordToRow` and `rowToRecord` both derive from it,
 * so adding a CrmRecord field only ever requires editing this list plus
 * the two mapping functions below, never hunting for magic column letters.
 */
const COLUMNS: (keyof CrmRecord)[] = [
  'leadId',
  'name',
  'email',
  'phone',
  'company',
  'website',
  'monthlyLeadVolume',
  'teamSize',
  'monthlyRevenue',
  'existingCrm',
  'biggestChallenge',
  'additionalNotes',
  'status',
  'score',
  'qualificationStatus',
  'confidence',
  'summary',
  'recommendedNextStep',
  'internalNotes',
  'bookingStatus',
  'bookingUrl',
  'createdAt',
  'updatedAt',
];

function recordToRow(record: CrmRecord): Record<string, string> {
  const row: Record<string, string> = {};
  for (const col of COLUMNS) {
    const value = record[col];
    row[col] = value === null || value === undefined ? '' : String(value);
  }
  return row;
}

function rowToRecord(row: Record<string, string>): CrmRecord {
  return {
    leadId: row.leadId ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    company: row.company ?? '',
    website: row.website ?? '',
    monthlyLeadVolume: row.monthlyLeadVolume as CrmRecord['monthlyLeadVolume'],
    teamSize: row.teamSize as CrmRecord['teamSize'],
    monthlyRevenue: row.monthlyRevenue as CrmRecord['monthlyRevenue'],
    existingCrm: row.existingCrm as CrmRecord['existingCrm'],
    biggestChallenge: row.biggestChallenge ?? '',
    additionalNotes: row.additionalNotes ?? '',
    status: row.status as CrmRecord['status'],
    score: row.score ? Number(row.score) : null,
    qualificationStatus: (row.qualificationStatus || null) as CrmRecord['qualificationStatus'],
    confidence: row.confidence ? Number(row.confidence) : null,
    summary: row.summary ?? '',
    recommendedNextStep: row.recommendedNextStep ?? '',
    internalNotes: row.internalNotes ?? '',
    bookingStatus: (row.bookingStatus || 'not_applicable') as CrmRecord['bookingStatus'],
    bookingUrl: row.bookingUrl ?? '',
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
  };
}

export class GoogleSheetsCrmAdapter implements CrmAdapter {
  readonly providerName = 'google_sheets';

  private docPromise: Promise<GoogleSpreadsheet> | null = null;

  /**
   * Lazily authenticates and loads the spreadsheet on first use, then
   * reuses the same connection for the lifetime of this adapter instance.
   * Required env vars are asserted here (not at module load) so importing
   * this file never throws — only actually using it without credentials
   * configured does.
   */
  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.docPromise) {
      this.docPromise = (async () => {
        const cfg = assertRequired(
          [
            'GOOGLE_SHEETS_SPREADSHEET_ID',
            'GOOGLE_SERVICE_ACCOUNT_EMAIL',
            'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
          ],
          'Google Sheets CRM adapter'
        );

        const jwt = new JWT({
          email: cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          // .env files store the key with literal \n escape sequences;
          // they must be converted to real newlines before use.
          key: cfg.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(cfg.GOOGLE_SHEETS_SPREADSHEET_ID, jwt);
        await doc.loadInfo();
        return doc;
      })();
    }
    return this.docPromise;
  }

  private async getSheet() {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[SHEET_TITLE];
    if (!sheet) {
      // First run against a fresh spreadsheet: create the tab with headers
      // rather than requiring the user to hand-build it. See
      // /docs/setup.md and the bundled sheet template for the expected
      // starting state.
      sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: COLUMNS });
    }
    return sheet;
  }

  async createRecord(record: CrmRecord): Promise<CrmRecord> {
    try {
      const sheet = await this.getSheet();
      await sheet.addRow(recordToRow(record));
      return record;
    } catch (cause) {
      throw new CrmAdapterError(`Failed to create record for lead ${record.leadId}`, this.providerName, cause);
    }
  }

  async updateRecord(leadId: string, patch: Partial<CrmRecord>): Promise<CrmRecord> {
    try {
      const sheet = await this.getSheet();
      const rows = await sheet.getRows();
      const row = rows.find((r) => r.get('leadId') === leadId);
      if (!row) {
        throw new Error(`No CRM record found for lead ${leadId}`);
      }

      const merged: CrmRecord = { ...rowToRecord(row.toObject()), ...patch, updatedAt: new Date().toISOString() };
      const nextRow = recordToRow(merged);
      for (const col of COLUMNS) {
        row.set(col, nextRow[col]);
      }
      await row.save();
      return merged;
    } catch (cause) {
      throw new CrmAdapterError(`Failed to update record for lead ${leadId}`, this.providerName, cause);
    }
  }

  async getRecord(leadId: string): Promise<CrmRecord | null> {
    try {
      const sheet = await this.getSheet();
      const rows = await sheet.getRows();
      const row = rows.find((r) => r.get('leadId') === leadId);
      return row ? rowToRecord(row.toObject()) : null;
    } catch (cause) {
      throw new CrmAdapterError(`Failed to read record for lead ${leadId}`, this.providerName, cause);
    }
  }
}
