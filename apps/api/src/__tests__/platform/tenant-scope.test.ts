import {
  tenantContext,
  MissingTenantContextError,
  TenantScopeViolationError,
  assertTenantMatch,
  requireTenantScope,
} from '@cerebro/platform';

describe('CP0 tenant scope enforcement', () => {
  it('returns tenant from async context', () => {
    tenantContext.run({ tenantId: 'tenant-a', bypassRLS: false }, () => {
      expect(requireTenantScope()).toBe('tenant-a');
    });
  });

  it('rejects mismatched explicit tenant vs context tenant', () => {
    tenantContext.run({ tenantId: 'tenant-a', bypassRLS: false }, () => {
      expect(() => requireTenantScope('tenant-b')).toThrow(TenantScopeViolationError);
    });
  });

  it('throws when tenant context is missing', () => {
    tenantContext.run({ bypassRLS: false }, () => {
      expect(() => requireTenantScope()).toThrow(MissingTenantContextError);
    });
  });

  it('asserts equal tenant ids', () => {
    expect(() => assertTenantMatch('t1', 't1')).not.toThrow();
    expect(() => assertTenantMatch('t1', 't2')).toThrow(TenantScopeViolationError);
  });
});
