import type { CP0FeatureFlagEvaluation } from '@playbook-brain/types';
import { requireTenantScope } from './tenant-scope.js';

export class InMemoryFeatureFlagService {
  private readonly flags = new Map<string, boolean>();

  setFlag(tenantId: string, key: string, enabled: boolean): void {
    this.flags.set(`${tenantId}:${key}`, enabled);
  }

  evaluate(tenantIdOrUndefined: string | undefined, key: string): CP0FeatureFlagEvaluation {
    const tenant_id = requireTenantScope(tenantIdOrUndefined);
    const enabled = this.flags.get(`${tenant_id}:${key}`) ?? false;
    return {
      tenant_id,
      flag_key: key,
      enabled,
      evaluated_at: new Date().toISOString(),
      reason: enabled ? 'configured' : 'default_false',
    };
  }
}
