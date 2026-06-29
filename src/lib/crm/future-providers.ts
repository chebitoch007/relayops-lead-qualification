import { CrmAdapterError, type CrmAdapter } from './types';
import type { CrmRecord } from '@/types';

/**
 * Shared scaffold for a not-yet-implemented provider. Each future adapter
 * (HubSpot, GoHighLevel, Pipedrive, Airtable) gets a real class that
 * implements CrmAdapter and is wired into the factory in index.ts, so
 * switching CRM_PROVIDER is a one-line config change once the real
 * implementation lands — building the integration is then a matter of
 * filling in these three methods against that provider's API, not
 * redesigning anything upstream.
 */
abstract class UnimplementedCrmAdapter implements CrmAdapter {
  abstract readonly providerName: string;

  private notImplemented(method: string): never {
    throw new CrmAdapterError(
      `${method} is not yet implemented. The CrmAdapter interface and factory wiring are in ` +
        `place — implement this provider's API calls in src/lib/crm/${this.providerName}.ts.`,
      this.providerName
    );
  }

  createRecord(_record: CrmRecord): Promise<CrmRecord> {
    return this.notImplemented('createRecord');
  }

  updateRecord(_leadId: string, _patch: Partial<CrmRecord>): Promise<CrmRecord> {
    return this.notImplemented('updateRecord');
  }

  getRecord(_leadId: string): Promise<CrmRecord | null> {
    return this.notImplemented('getRecord');
  }
}

export class HubspotCrmAdapter extends UnimplementedCrmAdapter {
  readonly providerName = 'hubspot';
}

export class GoHighLevelCrmAdapter extends UnimplementedCrmAdapter {
  readonly providerName = 'gohighlevel';
}

export class PipedriveCrmAdapter extends UnimplementedCrmAdapter {
  readonly providerName = 'pipedrive';
}

export class AirtableCrmAdapter extends UnimplementedCrmAdapter {
  readonly providerName = 'airtable';
}
