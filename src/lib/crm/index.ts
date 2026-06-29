import { env } from '@/lib/config/env';
import type { CrmAdapter } from './types';
import { GoogleSheetsCrmAdapter } from './google-sheets';
import {
  AirtableCrmAdapter,
  GoHighLevelCrmAdapter,
  HubspotCrmAdapter,
  PipedriveCrmAdapter,
} from './future-providers';

export type { CrmAdapter } from './types';
export { CrmAdapterError } from './types';

let cachedAdapter: CrmAdapter | null = null;

/**
 * Returns the active CrmAdapter based on CRM_PROVIDER. Callers (route
 * handlers, n8n-facing endpoints) should always go through this function
 * rather than importing a concrete adapter directly — that's the whole
 * point of the adapter pattern here: business logic in API routes never
 * names "google_sheets" or "hubspot", only "the CRM".
 *
 * Cached per server instance since each adapter manages its own
 * connection (e.g. the Sheets adapter's lazy auth + doc load).
 */
export function getCrmAdapter(): CrmAdapter {
  if (cachedAdapter) return cachedAdapter;

  switch (env.CRM_PROVIDER) {
    case 'google_sheets':
      cachedAdapter = new GoogleSheetsCrmAdapter();
      break;
    case 'hubspot':
      cachedAdapter = new HubspotCrmAdapter();
      break;
    case 'gohighlevel':
      cachedAdapter = new GoHighLevelCrmAdapter();
      break;
    case 'pipedrive':
      cachedAdapter = new PipedriveCrmAdapter();
      break;
    case 'airtable':
      cachedAdapter = new AirtableCrmAdapter();
      break;
    default: {
      // Exhaustiveness check: if CRM_PROVIDER's union in env.ts grows,
      // this line fails to compile until a case is added above.
      const _exhaustive: never = env.CRM_PROVIDER;
      throw new Error(`Unhandled CRM_PROVIDER: ${_exhaustive}`);
    }
  }
  return cachedAdapter;
}
