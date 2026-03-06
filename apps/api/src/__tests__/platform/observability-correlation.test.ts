import { EventEmitter } from 'events';
import {
  createObservabilityMiddleware,
  InMemoryMetricsSink,
  NoopTraceSink,
  requestContextMiddleware,
} from '../../platform/index.js';

type MiddlewareRequest = Parameters<typeof requestContextMiddleware>[0];
type MiddlewareResponse = Parameters<typeof requestContextMiddleware>[1];

describe('CP0 observability + correlation middleware', () => {
  it('propagates request/trace ids and emits correlated log/metrics', async () => {
    const metrics = new InMemoryMetricsSink();
    const logs: Array<{ message: string; data: Record<string, unknown> | undefined }> = [];
    const req = {
      method: 'GET',
      path: '/cp0-test',
      headers: {
        'x-request-id': 'req-123',
        'x-trace-id': 'trace-abc',
        'x-ticket-id': 'ticket-9',
      },
    } as unknown as MiddlewareRequest;
    const headerBag = new Map<string, string>();
    const res = new EventEmitter() as unknown as MiddlewareResponse & EventEmitter;
    res.statusCode = 200;
    res.setHeader = (name: string, value: string) => {
      headerBag.set(name.toLowerCase(), value);
      return res;
    };

    const observability = createObservabilityMiddleware({
      metrics,
      traces: new NoopTraceSink(),
      logs: {
        info: (message, data) => logs.push({ message, data }),
        error: (message, data) => logs.push({ message, data }),
      },
    });

    await new Promise<void>((resolve) => {
      requestContextMiddleware(req, res, () => {
        observability(req, res, () => {
          res.emit('finish');
          resolve();
        });
      });
    });

    expect(headerBag.get('x-request-id')).toBe('req-123');
    expect(headerBag.get('x-trace-id')).toBe('trace-abc');
    expect(req.correlation?.requestId).toBe('req-123');
    expect(req.correlation?.traceId).toBe('trace-abc');

    expect(metrics.counters.some((m) => m.name === 'http.request.started')).toBe(true);
    expect(metrics.counters.some((m) => m.name === 'http.request.completed')).toBe(true);
    expect(logs.some((l) => l.message === 'http_request_completed')).toBe(true);
    const completionLog = logs.find((l) => l.message === 'http_request_completed');
    const correlation = completionLog?.data?.correlation as Record<string, unknown> | undefined;
    expect(correlation?.trace_id).toBe('trace-abc');
    expect(correlation?.ticket_id).toBe('ticket-9');
  });
});
