import type { CP0FeatureFlagEvaluation } from '@cerebro/types';
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

  exportState(): Array<{ tenant_id: string; flag_key: string; enabled: boolean }> {
    return Array.from(this.flags.entries()).map(([composite, enabled]) => {
      const idx = composite.indexOf(':');
      if (idx <= 0) {
        return { tenant_id: composite, flag_key: '', enabled };
      }
      return {
        tenant_id: composite.slice(0, idx),
        flag_key: composite.slice(idx + 1),
        enabled,
      };
    });
  }

  importState(entries: Array<{ tenant_id: string; flag_key: string; enabled: boolean }>): void {
    this.flags.clear();
    for (const entry of entries) {
      if (!entry?.tenant_id || !entry?.flag_key) continue;
      this.flags.set(`${entry.tenant_id}:${entry.flag_key}`, Boolean(entry.enabled));
    }
  }
}
