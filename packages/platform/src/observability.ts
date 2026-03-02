import type { NextFunction, Request, Response } from 'express';
import { getRequestContextSnapshot } from './request-context.js';

export interface MetricsSink {
  increment(name: string, value?: number, tags?: Record<string, string | number | boolean>): void;
}

export class InMemoryMetricsSink implements MetricsSink {
  public readonly counters: Array<{
    name: string;
    value: number;
    tags?: Record<string, string | number | boolean>;
  }> = [];

  increment(name: string, value = 1, tags?: Record<string, string | number | boolean>): void {
    const entry: { name: string; value: number; tags?: Record<string, string | number | boolean> } = {
      name,
      value,
    };
    if (tags) entry.tags = tags;
    this.counters.push(entry);
  }
}

export interface LogSink {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export class ConsoleLogSink implements LogSink {
  info(message: string, data?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', message, ...data }));
  }
  error(message: string, data?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 'error', message, ...data }));
  }
}

export interface TraceSink {
  startSpan(name: string, attrs?: Record<string, unknown>): { end: () => void };
}

export class NoopTraceSink implements TraceSink {
  startSpan(_name: string, _attrs?: Record<string, unknown>) {
    return { end: () => undefined };
  }
}

export type ObservabilityRuntime = {
  logs: LogSink;
  metrics: MetricsSink;
  traces: TraceSink;
};

export function createObservabilityRuntime(): ObservabilityRuntime {
  return {
    logs: new ConsoleLogSink(),
    metrics: new InMemoryMetricsSink(),
    traces: new NoopTraceSink(),
  };
}

export function createObservabilityMiddleware(runtime: ObservabilityRuntime) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const span = runtime.traces.startSpan('http.request', {
      'http.method': req.method,
      'url.path': req.path,
    });

    runtime.metrics.increment('http.request.started', 1, { method: req.method, path: req.path });

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const ctx = getRequestContextSnapshot();
      runtime.metrics.increment('http.request.completed', 1, {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
      });
      runtime.logs.info('http_request_completed', {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: durationMs,
        correlation: ctx,
      });
      span.end();
    });

    next();
  };
}
