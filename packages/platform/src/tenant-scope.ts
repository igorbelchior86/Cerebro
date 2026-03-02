import { tenantContext } from './lib/tenantContext.js';
import { MissingTenantContextError, TenantScopeViolationError } from './errors.js';

export function requireTenantScope(explicitTenantId?: string): string {
  const storeTenantId = tenantContext.getStore()?.tenantId;
  const tenantId = explicitTenantId ?? storeTenantId;
  if (!tenantId) {
    throw new MissingTenantContextError();
  }
  if (explicitTenantId && storeTenantId && explicitTenantId !== storeTenantId) {
    throw new TenantScopeViolationError(
      `Tenant scope mismatch (context=${storeTenantId}, requested=${explicitTenantId})`,
    );
  }
  return tenantId;
}

export function assertTenantMatch(a?: string | null, b?: string | null): void {
  if (!a || !b) {
    throw new MissingTenantContextError('Both tenant identifiers are required');
  }
  if (a !== b) {
    throw new TenantScopeViolationError(`Tenant scope mismatch (${a} != ${b})`);
  }
}

