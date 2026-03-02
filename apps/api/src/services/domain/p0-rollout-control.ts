import { InMemoryFeatureFlagService } from '../platform/feature-flags.js';
import { P0_LAUNCH_INTEGRATION_POLICY } from '../platform/policy.js';
import { readJsonFileSafe, writeJsonFileAtomic } from './runtime-json-file.js';

export type P0RolloutFlagCategory = 'cohort' | 'core' | 'enrichment' | 'automation';

export interface P0RolloutFlagDefinition {
  key: string;
  category: P0RolloutFlagCategory;
  description: string;
  defaultEnabled: boolean;
  rolloutOrder: number;
}

export interface P0RolloutChangeRecord {
  tenant_id: string;
  flag_key: string;
  enabled: boolean;
  changed_at: string;
  actor_id?: string;
  reason?: string;
}

export interface TenantRolloutPosture {
  tenant_id: string;
  generated_at: string;
  summary: {
    total_flags: number;
    enabled_flags: number;
    cohort_enabled: boolean;
  };
  launch_policy: typeof P0_LAUNCH_INTEGRATION_POLICY;
  flags: Array<{
    flag_key: string;
    category: P0RolloutFlagCategory;
    description: string;
    rollout_order: number;
    enabled: boolean;
    reason: string;
    evaluated_at: string;
  }>;
  recent_changes: P0RolloutChangeRecord[];
}

const P0_ROLLOUT_FLAGS: readonly P0RolloutFlagDefinition[] = [
  {
    key: 'p0.rollout.design_partner_access',
    category: 'cohort',
    description: 'Tenant is admitted to controlled design-partner cohort workflows.',
    defaultEnabled: false,
    rolloutOrder: 10,
  },
  {
    key: 'p0.rollout.autotask.two_way_commands',
    category: 'core',
    description: 'Enable Cerebro-managed Autotask two-way command path for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 20,
  },
  {
    key: 'p0.rollout.ai_triage_assist',
    category: 'core',
    description: 'Enable AI triage/assist suggestion surfaces for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 30,
  },
  {
    key: 'p0.rollout.manager_visibility',
    category: 'core',
    description: 'Enable manager visibility QA/audit operational surfaces for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 40,
  },
  {
    key: 'p0.rollout.enrichment.itglue',
    category: 'enrichment',
    description: 'Enable IT Glue read-only enrichment surfaces for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 50,
  },
  {
    key: 'p0.rollout.enrichment.ninja',
    category: 'enrichment',
    description: 'Enable Ninja read-only enrichment surfaces for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 60,
  },
  {
    key: 'p0.rollout.enrichment.sentinelone',
    category: 'enrichment',
    description: 'Enable SentinelOne read-only enrichment surfaces for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 70,
  },
  {
    key: 'p0.rollout.enrichment.checkpoint',
    category: 'enrichment',
    description: 'Enable Check Point read-only enrichment surfaces for the tenant.',
    defaultEnabled: false,
    rolloutOrder: 80,
  },
  {
    key: 'p0.rollout.automation.simulation_only',
    category: 'automation',
    description: 'Enable simulation/dry-run automation controls (manual fallback preserved).',
    defaultEnabled: false,
    rolloutOrder: 90,
  },
] as const;

export class P0RolloutControlService {
  private readonly flags = new InMemoryFeatureFlagService();
  private readonly changes = new Map<string, P0RolloutChangeRecord[]>();
  private readonly persistenceFilePath: string | undefined;

  constructor(input?: { persistenceFilePath?: string }) {
    this.persistenceFilePath = input?.persistenceFilePath;
    this.loadPersistedState();
  }

  getSupportedFlags(): P0RolloutFlagDefinition[] {
    return [...P0_ROLLOUT_FLAGS].sort((a, b) => a.rolloutOrder - b.rolloutOrder);
  }

  getLaunchPolicySnapshot(): typeof P0_LAUNCH_INTEGRATION_POLICY {
    return { ...P0_LAUNCH_INTEGRATION_POLICY };
  }

  getTenantPosture(tenantId: string): TenantRolloutPosture {
    const evaluations = this.getSupportedFlags().map((flag) => {
      const evalResult = this.flags.evaluate(tenantId, flag.key);
      return {
        flag_key: flag.key,
        category: flag.category,
        description: flag.description,
        rollout_order: flag.rolloutOrder,
        enabled: evalResult.enabled,
        reason: evalResult.reason || 'default_false',
        evaluated_at: evalResult.evaluated_at,
      };
    });

    const enabledFlags = evaluations.filter((f) => f.enabled).length;
    return {
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      summary: {
        total_flags: evaluations.length,
        enabled_flags: enabledFlags,
        cohort_enabled: evaluations.some((f) => f.flag_key === 'p0.rollout.design_partner_access' && f.enabled),
      },
      launch_policy: this.getLaunchPolicySnapshot(),
      flags: evaluations,
      recent_changes: this.listChanges(tenantId, 25),
    };
  }

  setTenantFlag(input: {
    tenantId: string;
    flagKey: string;
    enabled: boolean;
    actorId?: string;
    reason?: string;
  }): TenantRolloutPosture {
    this.requireSupportedFlag(input.flagKey);
    this.flags.setFlag(input.tenantId, input.flagKey, input.enabled);
    this.recordChange({
      tenant_id: input.tenantId,
      flag_key: input.flagKey,
      enabled: input.enabled,
      changed_at: new Date().toISOString(),
      ...(input.actorId ? { actor_id: input.actorId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    });
    this.persistState();
    return this.getTenantPosture(input.tenantId);
  }

  rollbackFeature(input: {
    tenantId: string;
    flagKey: string;
    actorId?: string;
    reason?: string;
  }): TenantRolloutPosture {
    return this.setTenantFlag({
      tenantId: input.tenantId,
      flagKey: input.flagKey,
      enabled: false,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    });
  }

  rollbackTenantAllFlags(input: { tenantId: string; actorId?: string; reason?: string }): TenantRolloutPosture {
    for (const flag of this.getSupportedFlags()) {
      this.flags.setFlag(input.tenantId, flag.key, false);
      this.recordChange({
        tenant_id: input.tenantId,
        flag_key: flag.key,
        enabled: false,
        changed_at: new Date().toISOString(),
        ...(input.actorId ? { actor_id: input.actorId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      });
    }
    this.persistState();
    return this.getTenantPosture(input.tenantId);
  }

  listChanges(tenantId: string, limit = 25): P0RolloutChangeRecord[] {
    return (this.changes.get(tenantId) || []).slice(0, Math.max(1, Math.min(200, limit)));
  }

  private requireSupportedFlag(flagKey: string): void {
    if (!P0_ROLLOUT_FLAGS.some((f) => f.key === flagKey)) {
      throw new Error(`Unsupported rollout flag: ${flagKey}`);
    }
  }

  private recordChange(record: P0RolloutChangeRecord): void {
    const list = this.changes.get(record.tenant_id) || [];
    list.unshift(record);
    this.changes.set(record.tenant_id, list.slice(0, 200));
  }

  private loadPersistedState(): void {
    if (!this.persistenceFilePath) return;
    const snapshot = readJsonFileSafe<{
      flags?: Array<{ tenant_id: string; flag_key: string; enabled: boolean }>;
      changes?: Record<string, P0RolloutChangeRecord[]>;
    }>(this.persistenceFilePath);
    if (!snapshot) return;
    this.flags.importState(Array.isArray(snapshot.flags) ? snapshot.flags : []);
    this.changes.clear();
    if (snapshot.changes && typeof snapshot.changes === 'object') {
      for (const [tenantId, records] of Object.entries(snapshot.changes)) {
        if (!Array.isArray(records)) continue;
        this.changes.set(
          tenantId,
          records.filter(
            (r): r is P0RolloutChangeRecord =>
              Boolean(r && typeof r.tenant_id === 'string' && typeof r.flag_key === 'string' && typeof r.changed_at === 'string'),
          ),
        );
      }
    }
  }

  private persistState(): void {
    if (!this.persistenceFilePath) return;
    writeJsonFileAtomic(this.persistenceFilePath, {
      flags: this.flags.exportState(),
      changes: Object.fromEntries(this.changes.entries()),
    });
  }
}

export const p0RolloutControlService = new P0RolloutControlService({
  persistenceFilePath: process.env.P0_ROLLOUT_CONTROL_FILE || `${process.cwd()}/.run/p0-rollout-control.json`,
});
