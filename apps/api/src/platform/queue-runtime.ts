import { randomUUID } from 'crypto';
import type { CP0QueueDisposition, CP0QueueJobEnvelope } from '@playbook-brain/types';
import { classifyQueueError } from './errors.js';

export class IdempotencyKeyStore {
  private readonly keys = new Set<string>();

  claim(key: string): boolean {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
}

export type QueueHandler<TPayload = Record<string, unknown>> = (
  job: CP0QueueJobEnvelope<TPayload>,
) => Promise<void>;

export class InMemoryQueueRuntime<TPayload = Record<string, unknown>> {
  public readonly ready: Array<CP0QueueJobEnvelope<TPayload>> = [];
  public readonly dlq: Array<CP0QueueJobEnvelope<TPayload>> = [];

  enqueue(input: Omit<CP0QueueJobEnvelope<TPayload>, 'job_id' | 'attempts' | 'created_at'> & { job_id?: string }) {
    const job: CP0QueueJobEnvelope<TPayload> = {
      ...input,
      job_id: input.job_id ?? randomUUID(),
      attempts: [],
      created_at: new Date().toISOString(),
    };
    this.ready.push(job);
    return job;
  }

  async processNext(handler: QueueHandler<TPayload>): Promise<CP0QueueDisposition | 'empty'> {
    const job = this.ready.shift();
    if (!job) return 'empty';

    try {
      await handler(job);
      return 'ack';
    } catch (error) {
      const classification = classifyQueueError(error);
      job.attempts.push({
        attempt: job.attempts.length + 1,
        error_code: classification.code,
        at: new Date().toISOString(),
      });

      const shouldRetry =
        classification.disposition === 'retry' && job.attempts.length < Math.max(1, job.max_attempts);
      if (shouldRetry) {
        this.ready.push(job);
        return 'retry';
      }

      this.dlq.push(job);
      return 'dlq';
    }
  }
}
