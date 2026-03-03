const mockQuery = jest.fn();
const mockQueryOne = jest.fn();
const mockWithTryAdvisoryLock = jest.fn();

jest.mock('../../db/index.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  withTryAdvisoryLock: (...args: unknown[]) => mockWithTryAdvisoryLock(...args),
}));

const mockClient = {
  searchTickets: jest.fn(),
  getTicketQueues: jest.fn(),
  getCompany: jest.fn(),
  getContact: jest.fn(),
};

const mockAutotaskClientCtor = jest.fn(() => mockClient);

jest.mock('../../clients/index.js', () => ({
  AutotaskClient: mockAutotaskClientCtor,
}));

import router from '../../services/application/route-handlers/autotask-route-handlers.js';

async function invokeSidebarTicketsRoute() {
  const req: any = {
    method: 'GET',
    url: '/sidebar-tickets',
    originalUrl: '/autotask/sidebar-tickets',
    query: { queueId: '7', limit: '25', lookbackHours: '24' },
    auth: { tid: 'tenant-1', sub: 'user-1', role: 'admin' },
    headers: {},
    header() {
      return undefined;
    },
  };

  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      setHeader() {},
    };

    (router as any).handle(req, res, (error: unknown) => {
      if (error) {
        reject(error);
      } else {
        resolve({ status: res.statusCode, body: {} });
      }
    });
  });
}

describe('autotask sidebar tickets coordination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryOne.mockResolvedValue({
      credentials: {
        apiIntegrationCode: 'at-code',
        username: 'at-user',
        secret: 'at-secret',
      },
    });
    mockClient.searchTickets.mockResolvedValue([
      {
        id: 1001,
        ticketNumber: 'T-1001',
        queueID: 7,
        companyID: 101,
        contactID: 202,
        status: 'Open',
        priority: 2,
        createDate: '2026-03-03T10:00:00.000Z',
      },
    ]);
    mockClient.getTicketQueues.mockResolvedValue([{ id: 7, label: 'Service Desk' }]);
    mockClient.getCompany.mockResolvedValue({ companyName: 'ACME' });
    mockClient.getContact.mockResolvedValue({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('retries coordination after lock miss before upstream fetch', async () => {
    mockWithTryAdvisoryLock
      .mockResolvedValueOnce({ acquired: false })
      .mockImplementationOnce(async (_namespace: number, _key: number, callback: () => Promise<unknown>) => ({
        acquired: true,
        result: await callback(),
      }));

    const response = await invokeSidebarTicketsRoute();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      source: 'autotask_direct',
      queueId: 7,
      lookbackHours: 24,
    });
    expect(mockWithTryAdvisoryLock).toHaveBeenCalledTimes(2);
    expect(mockClient.searchTickets).toHaveBeenCalledTimes(1);
    expect(mockClient.getCompany).toHaveBeenCalledTimes(1);
    expect(mockClient.getContact).toHaveBeenCalledTimes(1);
  });
});
