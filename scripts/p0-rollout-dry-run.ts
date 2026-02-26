import { P0RolloutControlService } from '../apps/api/src/services/p0-rollout-control.js';

function printSection(title: string, payload: unknown): void {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(payload, null, 2));
}

async function main(): Promise<void> {
  const service = new P0RolloutControlService();
  const tenantId = 'tenant-mock-design-partner-1';

  printSection('Launch Policy (frozen)', service.getLaunchPolicySnapshot());
  printSection('Initial Posture', service.getTenantPosture(tenantId));

  const rolloutSequence = [
    'p0.rollout.design_partner_access',
    'p0.rollout.autotask.two_way_commands',
    'p0.rollout.manager_visibility',
    'p0.rollout.ai_triage_assist',
    'p0.rollout.enrichment.itglue',
    'p0.rollout.enrichment.ninja',
  ];

  for (const flagKey of rolloutSequence) {
    service.setTenantFlag({
      tenantId,
      flagKey,
      enabled: true,
      actorId: 'founder-dry-run',
      reason: 'phase5 dry-run rollout',
    });
  }
  printSection('Posture After Wave Enablement', service.getTenantPosture(tenantId));

  service.rollbackFeature({
    tenantId,
    flagKey: 'p0.rollout.ai_triage_assist',
    actorId: 'founder-dry-run',
    reason: 'simulate AI assist rollback',
  });
  printSection('Posture After Feature Rollback (AI assist)', service.getTenantPosture(tenantId));

  service.rollbackTenantAllFlags({
    tenantId,
    actorId: 'founder-dry-run',
    reason: 'simulate tenant rollback',
  });
  printSection('Posture After Tenant Rollback', service.getTenantPosture(tenantId));

  console.log('\nExpected signals checklist:');
  console.log('- Non-Autotask integrations remain read_only in launch policy snapshot.');
  console.log('- Feature flags change only the mock tenant posture.');
  console.log('- Rollback produces recent change history entries for audit review.');
}

main().catch((error) => {
  console.error('[p0-rollout-dry-run] failed:', error);
  process.exit(1);
});
