import type { CP0QueueJobEnvelope } from '@playbook-brain/types';
import type { InMemoryQueueRuntime, QueueHandler } from './queue-runtime.js';
import { requireTenantScope } from './tenant-scope.js';

export class WorkerRuntime<TPayload = Record<string, unknown>> {
  constructor(
    private readonly queue: InMemoryQueueRuntime<TPayload>,
    private readonly handler: QueueHandler<TPayload>,
  ) {}

  async tick(): Promise<'empty' | 'ack' | 'retry' | 'dlq'> {
    return this.queue.processNext(async (job: CP0QueueJobEnvelope<TPayload>) => {
      requireTenantScope(job.tenant_id);
      await this.handler(job);
    });
  }
}
