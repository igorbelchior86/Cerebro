import type { CP0IntegrationAdapterContract, CP0IntegrationMutationRequest } from '@cerebro/types';
import type { AuditTrailService } from './audit-trail.js';
import { enforceIntegrationMutationPolicy } from './policy.js';

export async function guardedAdapterMutation(
  adapter: CP0IntegrationAdapterContract,
  request: CP0IntegrationMutationRequest & { payload: Record<string, unknown>; idempotency_key: string },
  audit: AuditTrailService,
) {
  const decision = await enforceIntegrationMutationPolicy(request, audit);
  if (!decision.allowed) {
    throw decision.error;
  }
  if (!adapter.mutate) {
    throw new Error(`Adapter ${adapter.integration} does not implement mutate()`);
  }
  return adapter.mutate(request);
}
