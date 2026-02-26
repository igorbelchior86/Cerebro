import express from 'express';
import request from 'supertest';
import {
  createObservabilityMiddleware,
  InMemoryMetricsSink,
  NoopTraceSink,
  requestContextMiddleware,
} from '../../platform/index.js';

describe('CP0 observability + correlation middleware', () => {
  it('propagates request/trace ids and emits correlated log/metrics', async () => {
    const metrics = new InMemoryMetricsSink();
    const logs: Array<{ message: string; data: Record<string, unknown> | undefined }> = [];
    const app = express();

    app.use(requestContextMiddleware);
    app.use(
      createObservabilityMiddleware({
        metrics,
        traces: new NoopTraceSink(),
        logs: {
          info: (message, data) => logs.push({ message, data }),
          error: (message, data) => logs.push({ message, data }),
        },
      }),
    );
    app.get('/cp0-test', (req, res) => {
      res.json({ ok: true, correlation: req.correlation });
    });

    const response = await request(app)
      .get('/cp0-test')
      .set('x-request-id', 'req-123')
      .set('x-trace-id', 'trace-abc')
      .set('x-ticket-id', 'ticket-9');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('req-123');
    expect(response.headers['x-trace-id']).toBe('trace-abc');
    expect(response.body.correlation.requestId).toBe('req-123');
    expect(response.body.correlation.traceId).toBe('trace-abc');

    expect(metrics.counters.some((m) => m.name === 'http.request.started')).toBe(true);
    expect(metrics.counters.some((m) => m.name === 'http.request.completed')).toBe(true);
    expect(logs.some((l) => l.message === 'http_request_completed')).toBe(true);
    const completionLog = logs.find((l) => l.message === 'http_request_completed');
    expect((completionLog?.data?.correlation as any)?.trace_id).toBe('trace-abc');
    expect((completionLog?.data?.correlation as any)?.ticket_id).toBe('ticket-9');
  });
});
