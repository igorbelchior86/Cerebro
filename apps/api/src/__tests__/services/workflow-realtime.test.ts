import { WorkflowRealtimeHub, toSseChunk, HEARTBEAT_INTERVAL_MS } from '../../services/orchestration/workflow-realtime.js';
import type { Response } from 'express';

type FakeResponse = {
  write: jest.Mock<void, [string]>;
  end: jest.Mock<void, []>;
};

function fakeResponse(): FakeResponse {
  return {
    write: jest.fn<void, [string]>(),
    end: jest.fn<void, []>(),
  };
}

describe('WorkflowRealtimeHub', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats SSE chunks with event id and reconnect hint', () => {
    const chunk = toSseChunk({
      event: 'connection.state',
      id: 'evt-1',
      retryMs: 2000,
      data: { kind: 'connection.state', ok: true },
    });
    expect(chunk).toContain('id: evt-1');
    expect(chunk).toContain('event: connection.state');
    expect(chunk).toContain('retry: 2000');
    expect(chunk).toContain('data: {"kind":"connection.state","ok":true}');
  });

  it('publishes tenant-scoped events only to subscribed tenant clients', () => {
    const hub = new WorkflowRealtimeHub();
    const tenantA1 = fakeResponse();
    const tenantA2 = fakeResponse();
    const tenantB = fakeResponse();
    hub.subscribe('tenant-a', tenantA1 as unknown as Response);
    hub.subscribe('tenant-a', tenantA2 as unknown as Response);
    hub.subscribe('tenant-b', tenantB as unknown as Response);

    const sent = hub.publishTicketChange({
      tenant_id: 'tenant-a',
      ticket_id: '5001',
      trace_id: 'trace-1',
      occurred_at: '2026-02-27T00:00:00.000Z',
      change_kind: 'status',
      status: 'In Progress',
    });

    expect(sent).toBe(2);
    expect(tenantA1.write).toHaveBeenCalledTimes(1);
    expect(tenantA2.write).toHaveBeenCalledTimes(1);
    expect(tenantB.write).not.toHaveBeenCalled();
    hub.close();
  });

  it('emits heartbeat events and removes broken clients', () => {
    jest.useFakeTimers();
    const hub = new WorkflowRealtimeHub();
    const healthy = fakeResponse();
    const broken = fakeResponse();
    broken.write.mockImplementation(() => {
      throw new Error('socket closed');
    });
    hub.subscribe('tenant-a', healthy as unknown as Response);
    hub.subscribe('tenant-a', broken as unknown as Response);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 5);

    expect(healthy.write).toHaveBeenCalled();
    expect(hub.clientCount('tenant-a')).toBe(1);
    hub.close();
  });
});
