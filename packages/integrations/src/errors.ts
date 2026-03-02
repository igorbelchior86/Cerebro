export type IntegrationErrorCode =
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'validation'
  | 'provider_error'
  | 'unknown';

export interface IntegrationClientErrorOptions {
  integration: 'itglue' | 'ninjaone' | string;
  code: IntegrationErrorCode;
  retryable: boolean;
  statusCode?: number;
  operation?: string;
  cause?: unknown;
}

export class IntegrationClientError extends Error {
  public readonly kind = 'integration_client_error';
  public readonly integration: string;
  public readonly code: IntegrationErrorCode;
  public readonly retryable: boolean;
  public readonly statusCode: number | undefined;
  public readonly operation: string | undefined;

  constructor(message: string, options: IntegrationClientErrorOptions) {
    super(message);
    this.name = 'IntegrationClientError';
    this.integration = options.integration;
    this.code = options.code;
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
    this.operation = options.operation;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function summarizeBody(rawBody: string): string {
  const compact = rawBody.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length <= 200 ? compact : `${compact.slice(0, 200)}...`;
}

function codeFromStatus(status: number): IntegrationErrorCode {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500) return 'provider_error';
  return 'unknown';
}

function retryableFromStatus(status: number): boolean {
  return status === 429 || status === 408 || status === 504 || status >= 500;
}

export function isIntegrationClientError(error: unknown): error is IntegrationClientError {
  return error instanceof IntegrationClientError;
}

export async function throwFromHttpResponse(options: {
  integration: 'itglue' | 'ninjaone' | string;
  operation: string;
  response: Response;
}): Promise<never> {
  const { integration, operation, response } = options;
  const bodyText = await response.text().catch(() => '');
  const messageSuffix = summarizeBody(bodyText);
  const messageBase = `${integration} ${operation} failed with ${response.status} ${response.statusText || 'HTTP_ERROR'}`;
  const message = messageSuffix ? `${messageBase}: ${messageSuffix}` : messageBase;

  throw new IntegrationClientError(message, {
    integration,
    operation,
    code: codeFromStatus(response.status),
    retryable: retryableFromStatus(response.status),
    statusCode: response.status,
  });
}

export function normalizeIntegrationError(options: {
  integration: 'itglue' | 'ninjaone' | string;
  operation: string;
  error: unknown;
}): IntegrationClientError {
  const { integration, operation, error } = options;

  if (isIntegrationClientError(error)) return error;

  const name = typeof error === 'object' && error && 'name' in error ? String((error as { name?: unknown }).name ?? '') : '';
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : `Unknown ${integration} error`;

  if (name === 'AbortError' || /timeout/i.test(message)) {
    return new IntegrationClientError(`${integration} ${operation} timeout: ${message}`, {
      integration,
      operation,
      code: 'timeout',
      retryable: true,
      cause: error,
    });
  }

  return new IntegrationClientError(`${integration} ${operation} request failed: ${message}`, {
    integration,
    operation,
    code: 'provider_error',
    retryable: true,
    cause: error,
  });
}
