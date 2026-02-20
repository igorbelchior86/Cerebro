import { AsyncLocalStorage } from 'async_hooks';

export type TenantContextState = {
    tenantId?: string | undefined;
    bypassRLS?: boolean;
};

export const tenantContext = new AsyncLocalStorage<TenantContextState>();
