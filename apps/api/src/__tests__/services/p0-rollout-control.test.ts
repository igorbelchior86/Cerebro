import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { P0RolloutControlService } from '../../services/p0-rollout-control.js';

describe('P0RolloutControlService', () => {
  it('returns tenant-scoped rollout posture with all flags default false and frozen launch policy', () => {
    const service = new P0RolloutControlService();

    const posture = service.getTenantPosture('tenant-alpha');

    expect(posture.tenant_id).toBe('tenant-alpha');
    expect(posture.summary.total_flags).toBeGreaterThan(0);
    expect(posture.summary.enabled_flags).toBe(0);
    expect(posture.summary.cohort_enabled).toBe(false);
    expect(posture.flags.every((f) => f.enabled === false)).toBe(true);
    expect(posture.launch_policy).toEqual({
      autotask: 'two_way',
      itglue: 'read_only',
      ninja: 'read_only',
      sentinelone: 'read_only',
      checkpoint: 'read_only',
    });
  });

  it('supports per-tenant enablement and feature rollback without cross-tenant bleed', () => {
    const service = new P0RolloutControlService();
    const flagKey = 'p0.rollout.design_partner_access';

    service.setTenantFlag({
      tenantId: 'tenant-a',
      flagKey,
      enabled: true,
      actorId: 'user-1',
      reason: 'admit cohort wave 1',
    });
    const tenantAPosture = service.getTenantPosture('tenant-a');
    const tenantBPosture = service.getTenantPosture('tenant-b');

    expect(tenantAPosture.flags.find((f) => f.flag_key === flagKey)?.enabled).toBe(true);
    expect(tenantAPosture.summary.cohort_enabled).toBe(true);
    expect(tenantAPosture.recent_changes[0]?.flag_key).toBe(flagKey);
    expect(tenantAPosture.recent_changes[0]?.actor_id).toBe('user-1');
    expect(tenantBPosture.flags.find((f) => f.flag_key === flagKey)?.enabled).toBe(false);

    const rolledBack = service.rollbackFeature({
      tenantId: 'tenant-a',
      flagKey,
      reason: 'incident containment',
    });
    expect(rolledBack.flags.find((f) => f.flag_key === flagKey)?.enabled).toBe(false);
    expect(rolledBack.summary.cohort_enabled).toBe(false);
    expect(rolledBack.recent_changes[0]?.enabled).toBe(false);
  });

  it('rolls back all rollout flags for a tenant', () => {
    const service = new P0RolloutControlService();
    const keys = service.getSupportedFlags().slice(0, 3).map((f) => f.key);

    for (const key of keys) {
      service.setTenantFlag({ tenantId: 'tenant-z', flagKey: key, enabled: true });
    }
    const postureBefore = service.getTenantPosture('tenant-z');
    expect(postureBefore.summary.enabled_flags).toBe(3);

    const postureAfter = service.rollbackTenantAllFlags({
      tenantId: 'tenant-z',
      actorId: 'commander-1',
      reason: 'tenant rollback dry-run',
    });
    expect(postureAfter.summary.enabled_flags).toBe(0);
    expect(postureAfter.flags.every((f) => f.enabled === false)).toBe(true);
    expect(postureAfter.recent_changes[0]?.actor_id).toBe('commander-1');
  });

  it('rejects unsupported flag keys', () => {
    const service = new P0RolloutControlService();
    expect(() =>
      service.setTenantFlag({ tenantId: 'tenant-a', flagKey: 'p0.rollout.invalid', enabled: true }),
    ).toThrow(/Unsupported rollout flag/);
  });

  it('restores rollout posture and change history after reload when file backing is enabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cerebro-rollout-'));
    const filePath = join(dir, 'rollout-control.json');
    try {
      const flagKey = 'p0.rollout.enrichment.itglue';
      const service1 = new P0RolloutControlService({ persistenceFilePath: filePath });
      service1.setTenantFlag({
        tenantId: 'tenant-persist',
        flagKey,
        enabled: true,
        actorId: 'founder-1',
        reason: 'durability test',
      });

      const service2 = new P0RolloutControlService({ persistenceFilePath: filePath });
      const posture = service2.getTenantPosture('tenant-persist');
      expect(posture.flags.find((f) => f.flag_key === flagKey)?.enabled).toBe(true);
      expect(posture.recent_changes[0]).toEqual(
        expect.objectContaining({
          tenant_id: 'tenant-persist',
          flag_key: flagKey,
          enabled: true,
          actor_id: 'founder-1',
          reason: 'durability test',
        }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
