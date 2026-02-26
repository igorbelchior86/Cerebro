import type { CP0IntegrationCredentialRef, CP0LaunchIntegrationId } from '@playbook-brain/types';
import { assertTenantMatch, requireTenantScope } from './tenant-scope.js';

export interface IntegrationCredentialStore {
  put(ref: CP0IntegrationCredentialRef): Promise<void>;
  getByIntegration(tenantId: string, integration: CP0LaunchIntegrationId): Promise<CP0IntegrationCredentialRef | null>;
}

export class InMemoryIntegrationCredentialStore implements IntegrationCredentialStore {
  private readonly refs = new Map<string, CP0IntegrationCredentialRef>();

  async put(ref: CP0IntegrationCredentialRef): Promise<void> {
    const tenantId = requireTenantScope(ref.tenant_id);
    assertTenantMatch(tenantId, ref.tenant_id);
    this.refs.set(`${tenantId}:${ref.integration}`, ref);
  }

  async getByIntegration(
    tenantId: string,
    integration: CP0LaunchIntegrationId,
  ): Promise<CP0IntegrationCredentialRef | null> {
    const scopedTenantId = requireTenantScope(tenantId);
    return this.refs.get(`${scopedTenantId}:${integration}`) ?? null;
  }
}
