import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '../lib/tenantContext.js';

/**
 * Middleware that extracts the tenant context from the authorized user or headers
 * and injects it into the asynchronous execution context for the RLS DB pool.
 */
export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Ideally this comes from the JWT payload after auth middleware.
    // For safety and local development, we might also read a header.

    // Example: Assuming auth middleware sets req.user
    const user = (req as any).user;
    let tenantId: string | undefined = undefined;

    if (user && user.tenantId) {
        tenantId = user.tenantId;
    } else {
        // Fallback: If your frontend sends X-Tenant-Id header specifically
        const headerTenant = req.header('x-tenant-id');
        if (headerTenant) {
            tenantId = headerTenant;
        }
    }

    // If no tenant is present, should we block? 
    // It depends. Some public routes shouldn't be blocked.
    // We'll let the database RLS naturally block queries that require tenant_id.

    tenantContext.run({ tenantId, bypassRLS: false }, () => {
        next();
    });
};
