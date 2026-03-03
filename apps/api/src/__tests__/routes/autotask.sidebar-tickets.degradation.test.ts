import router from '../../services/application/route-handlers/autotask-route-handlers.js';
import { AutotaskClient } from '../../clients/index.js';
import { queryOne, withTryAdvisoryLock } from '../../db/index.js';

jest.mock('../../clients/index.js', () => ({
  AutotaskClient: jest.fn(),
}));

jest.mock('../../db/index.js', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  withTryAdvisoryLock: jest.fn(),
}));

jest.mock('../../services/adapters/email/pg-store.js', () => ({
  pgStore: { saveProcessedTicket: jest.fn() },
}));

jest.mock('../../services/orchestration/triage-orchestrator.js', () => ({
  triageOrchestrator: { runPipeline: jest.fn() },
}));

const queryOneMock = queryOne as jest.MockedFunction<typeof queryOne>;
const withTryAdvisoryLockMock = withTryAdvisoryLock as jest.MockedFunction<typeof withTryAdvisoryLock>;
const AutotaskClientMock = AutotaskClient as unknown as jest.Mock;

function getSidebarTicketsHandler() {
  const layer = (router as any).stack.find(
    (entry: any) => entry?.route?.path === '/sidebar-tickets' && entry?.route?.methods?.get
  );
  if (!layer) throw new Error('sidebar-tickets route handler not found');
  return layer.route.stack[layer.route.stack.length - 1].handle as (req: any, res: any, next: any) => Promise<void>;
}

async function invokeSidebar(handler: (req: any, res: any, next: any) => Promise<void>, queueId: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  const next = jest.fn();

  await handler(
    {
      query: { queueId, limit: '5', lookbackHours: '24' },
      auth: { tid: 'tenant-1' },
    },
    { json, status },
    next
  );

  return { json, status, next };
}

describe('/autotask/sidebar-tickets degradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryOneMock.mockResolvedValue({
      credentials: {
        apiIntegrationCode: 'code',
        username: 'user',
        secret: 'secret',
      },
    } as never);

    withTryAdvisoryLockMock.mockImplementation(async (_namespace, _key, callback) => ({
      acquired: true,
      result: await callback(),
    } as never));
  });

  it('degrades to 200 with rate_limited when Autotask thread threshold error occurs', async () => {
    const client = {
      searchTickets: jest.fn().mockRejectedValue(new Error('Autotask API error: thread threshold of 3 threads has been exceeded')),
      getTicketQueues: jest.fn().mockResolvedValue([]),
    };
    AutotaskClientMock.mockImplementation(() => client);

    const handler = getSidebarTicketsHandler();
    const { json, next } = await invokeSidebar(handler, '29683512');

    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledTimes(1);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      success: true,
      data: [],
      source: 'autotask_direct',
      queueId: 29683512,
      degraded: {
        provider: 'Autotask',
        reason: 'rate_limited',
      },
    });
  });

  it('enters cooldown after rate limit and avoids immediate provider retries', async () => {
    const client = {
      searchTickets: jest.fn().mockRejectedValue(new Error('Autotask API error: thread threshold of 3 threads has been exceeded')),
      getTicketQueues: jest.fn().mockResolvedValue([]),
    };
    AutotaskClientMock.mockImplementation(() => client);

    const handler = getSidebarTicketsHandler();

    const first = await invokeSidebar(handler, '29683513');
    const second = await invokeSidebar(handler, '29683513');

    expect(first.next).not.toHaveBeenCalled();
    expect(second.next).not.toHaveBeenCalled();
    expect(client.searchTickets).toHaveBeenCalledTimes(1);

    expect(second.json.mock.calls[0]?.[0]).toMatchObject({
      success: true,
      source: 'autotask_direct',
      queueId: 29683513,
      degraded: {
        provider: 'Autotask',
        reason: 'rate_limited',
      },
    });
    expect(second.json.mock.calls[0]?.[0]?.degraded?.cooldownUntil).toEqual(expect.any(String));
  });
});
