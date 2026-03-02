import { createObservabilityRuntime, getRequestContextSnapshot } from '../platform/index.js';
import { tenantContext } from './tenantContext.js';

type CorrelationFields = {
  tenant_id: string | null;
  ticket_id: string | null;
  trace_id: string | null;
  request_id: string | null;
  job_id: string | null;
  command_id: string | null;
};

type LogRecord = Record<string, unknown>;

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveCorrelation(overrides?: Partial<CorrelationFields>): CorrelationFields {
  const platformCtx = getRequestContextSnapshot();
  const localCtx = tenantContext.getStore();

  return {
    tenant_id: overrides?.tenant_id ?? toStringOrNull(platformCtx.tenant_id) ?? toStringOrNull(localCtx?.tenantId),
    ticket_id: overrides?.ticket_id ?? toStringOrNull(platformCtx.ticket_id) ?? toStringOrNull(localCtx?.ticketId),
    trace_id: overrides?.trace_id ?? toStringOrNull(platformCtx.trace_id) ?? toStringOrNull(localCtx?.traceId),
    request_id: overrides?.request_id ?? toStringOrNull(platformCtx.request_id) ?? toStringOrNull(localCtx?.requestId),
    job_id: overrides?.job_id ?? toStringOrNull(platformCtx.job_id) ?? toStringOrNull(localCtx?.jobId),
    command_id: overrides?.command_id ?? toStringOrNull(platformCtx.command_id) ?? toStringOrNull(localCtx?.commandId),
  };
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorCode = (error as Error & { code?: unknown }).code;
    return {
      error_name: error.name,
      error_message: error.message,
      ...(typeof errorCode === 'string'
        ? { error_code: errorCode }
        : {}),
    };
  }
  return { error_message: String(error) };
}

export const observabilityRuntime = createObservabilityRuntime();

export const operationalLogger = {
  info(event: string, data: LogRecord = {}, correlation?: Partial<CorrelationFields>): void {
    observabilityRuntime.logs.info(event, {
      ...resolveCorrelation(correlation),
      ...data,
    });
  },
  warn(event: string, data: LogRecord = {}, correlation?: Partial<CorrelationFields>): void {
    observabilityRuntime.logs.info(event, {
      ...resolveCorrelation(correlation),
      severity: 'warn',
      ...data,
    });
  },
  error(
    event: string,
    error?: unknown,
    data: LogRecord = {},
    correlation?: Partial<CorrelationFields>
  ): void {
    observabilityRuntime.logs.error(event, {
      ...resolveCorrelation(correlation),
      ...(error !== undefined ? serializeError(error) : {}),
      ...data,
    });
  },
};
