import type { CP0QueueErrorClassification } from '@playbook-brain/types';

export class PlatformError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly statusCode: number;

  constructor(message: string, options: { code: string; retryable?: boolean; statusCode?: number }) {
    super(message);
    this.code = options.code;
    this.retryable = Boolean(options.retryable);
    this.statusCode = options.statusCode ?? 500;
  }
}

export class TenantScopeViolationError extends PlatformError {
  constructor(message = 'Tenant scope violation') {
    super(message, { code: 'TENANT_SCOPE_VIOLATION', retryable: false, statusCode: 403 });
  }
}

export class ReadOnlyIntegrationMutationError extends PlatformError {
  constructor(integration: string, action: string) {
    super(`Integration ${integration} is read-only for action ${action}`, {
      code: 'READ_ONLY_INTEGRATION_MUTATION',
      retryable: false,
      statusCode: 403,
    });
  }
}

export class MissingTenantContextError extends PlatformError {
  constructor(message = 'Tenant context is required') {
    super(message, { code: 'MISSING_TENANT_CONTEXT', retryable: false, statusCode: 400 });
  }
}

export function classifyQueueError(error: unknown): CP0QueueErrorClassification {
  if (error instanceof PlatformError) {
    if (error.code === 'READ_ONLY_INTEGRATION_MUTATION') {
      return { code: 'POLICY_REJECTED', disposition: 'dlq', reason: error.message };
    }
    if (error.code === 'TENANT_SCOPE_VIOLATION' || error.code === 'MISSING_TENANT_CONTEXT') {
      return { code: 'VALIDATION', disposition: 'dlq', reason: error.message };
    }
    return {
      code: error.retryable ? 'TRANSIENT' : 'UNKNOWN',
      disposition: error.retryable ? 'retry' : 'dlq',
      reason: error.message,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('timeout')) {
    return { code: 'TIMEOUT', disposition: 'retry', reason: message };
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return { code: 'RATE_LIMIT', disposition: 'retry', reason: message };
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden')) {
    return { code: 'AUTH', disposition: 'dlq', reason: message };
  }
  if (lower.includes('validation') || lower.includes('invalid')) {
    return { code: 'VALIDATION', disposition: 'dlq', reason: message };
  }

  return { code: 'UNKNOWN', disposition: 'retry', reason: message };
}
