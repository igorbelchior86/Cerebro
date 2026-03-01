import type {
  CP0AuditRecord,
  CP0IntegrationMode,
  CP0IntegrationMutationRequest,
  CP0LaunchIntegrationId,
} from '@cerebro/types';
import { ReadOnlyIntegrationMutationError } from './errors.js';
import type { AuditTrailService } from './audit-trail.js';

export const P0_LAUNCH_INTEGRATION_POLICY: Record<CP0LaunchIntegrationId, CP0IntegrationMode> = {
  autotask: 'two_way',
  itglue: 'read_only',
  ninja: 'read_only',
  sentinelone: 'read_only',
  checkpoint: 'read_only',
};

export function getIntegrationMode(integration: CP0LaunchIntegrationId): CP0IntegrationMode {
  return P0_LAUNCH_INTEGRATION_POLICY[integration];
}

export function ensureIntegrationMutationAllowed(request: CP0IntegrationMutationRequest): void {
  const mode = getIntegrationMode(request.integration);
  if (mode !== 'two_way') {
    throw new ReadOnlyIntegrationMutationError(request.integration, request.action);
  }
}

export async function enforceIntegrationMutationPolicy(
  request: CP0IntegrationMutationRequest,
  audit: AuditTrailService,
): Promise<{ allowed: true } | { allowed: false; error: ReadOnlyIntegrationMutationError; audit: CP0AuditRecord }> {
  try {
    ensureIntegrationMutationAllowed(request);
    await audit.emit({
      tenant_id: request.tenant_id,
      actor: request.actor,
      action: `integration.${request.action}.policy_check`,
      target: { type: 'integration', id: request.integration, integration: request.integration },
      result: 'success',
      metadata: { policy_mode: getIntegrationMode(request.integration) },
    });
    return { allowed: true };
  } catch (error) {
    if (!(error instanceof ReadOnlyIntegrationMutationError)) {
      throw error;
    }
    const record = await audit.emit({
      tenant_id: request.tenant_id,
      actor: request.actor,
      action: `integration.${request.action}.policy_check`,
      target: { type: 'integration', id: request.integration, integration: request.integration },
      result: 'rejected',
      reason: error.message,
      metadata: { policy_mode: getIntegrationMode(request.integration), policy_enforced: 'cp0_launch_policy' },
    });
    return { allowed: false, error, audit: record };
  }
}
