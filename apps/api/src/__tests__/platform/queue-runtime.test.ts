import { InMemoryQueueRuntime } from '../../platform/queue-runtime.js';

describe('CP0 queue retry/DLQ skeleton', () => {
  it('retries transient errors then DLQs when attempts are exhausted', async () => {
    const queue = new InMemoryQueueRuntime<{ x: number }>();
    queue.enqueue({
      tenant_id: 'tenant-1',
      job_type: 'cp0.test',
      payload: { x: 1 },
      max_attempts: 2,
      available_at: new Date().toISOString(),
      correlation: { trace_id: 'trace-1' },
    });

    const first = await queue.processNext(async () => {
      throw new Error('timeout contacting dependency');
    });
    expect(first).toBe('retry');
    expect(queue.ready).toHaveLength(1);

    const second = await queue.processNext(async () => {
      throw new Error('timeout contacting dependency');
    });
    expect(second).toBe('dlq');
    expect(queue.dlq).toHaveLength(1);
    expect(queue.dlq[0]?.attempts).toHaveLength(2);
  });
});

