import { AsyncLocalStorage } from 'async_hooks';

export type TenantContextState = {
    tenantId?: string | undefined;
    bypassRLS?: boolean;
    traceId?: string | undefined;
    requestId?: string | undefined;
    ticketId?: string | undefined;
    jobId?: string | undefined;
    commandId?: string | undefined;
    actorId?: string | undefined;
    actorType?: 'user' | 'system' | 'ai' | undefined;
    actorRole?: string | undefined;
};

export const tenantContext = new AsyncLocalStorage<TenantContextState>();
