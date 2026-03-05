import { AutotaskPollingService } from '../../services/adapters/autotask-polling.js';
import { workflowService } from '../../services/orchestration/workflow-runtime.js';

describe('AutotaskPollingService P0 hardening', () => {
  it('disables historical parity backfill when active-only mode is enabled', async () => {
    const service = new AutotaskPollingService({
      parityBackfillEnabled: true,
      parityActiveOnly: true,
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([]),
        } as any,
      }),
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });
    const backfillSpy = jest.spyOn(service as any, 'runParityBackfill').mockResolvedValue(undefined);

    await service.runOnce();

    expect(backfillSpy).not.toHaveBeenCalled();
  });

  it('keeps historical parity backfill available when active-only mode is disabled', async () => {
    const service = new AutotaskPollingService({
      parityBackfillEnabled: true,
      parityActiveOnly: false,
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([]),
        } as any,
      }),
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });
    const backfillSpy = jest.spyOn(service as any, 'runParityBackfill').mockResolvedValue(undefined);

    await service.runOnce();

    expect(backfillSpy).toHaveBeenCalledTimes(1);
  });

  it('excludes tickets from Complete queue in active-only mode', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const searchTickets = jest.fn(async (filter: string) => {
      const raw = JSON.parse(filter);
      const queueFilter = Array.isArray(raw?.filter)
        ? raw.filter.find((entry: any) => String(entry?.field || '') === 'queueID')
        : null;
      if (queueFilter) {
        if (Number(queueFilter.value) === 10) {
          return [
            { id: 1001, ticketNumber: 'T-COMPLETE-1', queueID: 10, createDate: '2026-03-03T12:00:00.000Z' },
          ];
        }
        if (Number(queueFilter.value) === 20) {
          return [
            { id: 2001, ticketNumber: 'T-ACTIVE-1', queueID: 20, createDate: '2026-03-03T12:01:00.000Z' },
          ];
        }
      }
      return [
        { id: 3001, ticketNumber: 'T-COMPLETE-RECENT', queueID: 10, createDate: '2026-03-03T12:02:00.000Z' },
        { id: 3002, ticketNumber: 'T-ACTIVE-RECENT', queueID: 20, createDate: '2026-03-03T12:03:00.000Z' },
      ];
    });
    const service = new AutotaskPollingService({
      parityBackfillEnabled: true,
      parityActiveOnly: true,
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          getTicketQueues: jest.fn().mockResolvedValue([
            { id: 10, name: 'Complete' },
            { id: 20, name: 'Service Desk' },
          ]),
          searchTickets,
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    const entityIds = workflowSync.mock.calls.map((call) => String(call?.[0]?.entity_id || ''));
    expect(entityIds).toEqual(expect.arrayContaining(['T-ACTIVE-1', 'T-ACTIVE-RECENT']));
    expect(entityIds).not.toEqual(expect.arrayContaining(['T-COMPLETE-1', 'T-COMPLETE-RECENT']));
    expect(triageRun).toHaveBeenCalledTimes(1);
    expect(triageRun).toHaveBeenCalledWith('3002', 'tenant-1');
  });

  it('feeds polled Autotask tickets into workflow sync path and triage pipeline', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([
            {
              id: 123,
              ticketNumber: 'T20260226.0123',
              title: 'Printer down',
              description: 'Queue stuck',
              status: 'New',
              queueID: 7,
              createDate: '2026-02-26T12:00:00.000Z',
            },
          ]),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    expect(workflowSync).toHaveBeenCalledTimes(1);
    expect(workflowSync.mock.calls[0]?.[0]).toMatchObject({
      tenant_id: 'tenant-1',
      event_type: 'ticket.created',
      entity_id: 'T20260226.0123',
      provenance: { source: 'autotask_poller' },
    });
    expect(triageRun).toHaveBeenCalledWith('123', 'tenant-1');
  });

  it('skips workflow sync when poller tenant is unavailable but preserves triage execution (degraded mode)', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        client: {
          searchTickets: jest.fn().mockResolvedValue([
            { id: 321, ticketNumber: 'T20260226.0321', createDate: '2026-02-26T12:00:00.000Z' },
          ]),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    expect(workflowSync).not.toHaveBeenCalled();
    expect(triageRun).toHaveBeenCalledWith('321', undefined);
  });

  it('retries transient sync ingestion failures and succeeds before DLQ', async () => {
    let now = 10_000;
    const searchTickets = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 777, ticketNumber: 'T20260227.0777', createDate: '2026-02-27T12:00:00.000Z' },
      ])
      .mockResolvedValue([]);
    const workflowSync = jest
      .fn()
      .mockRejectedValueOnce(new Error('Autotask API error: 429'))
      .mockRejectedValueOnce(new Error('timeout while writing sync event'))
      .mockResolvedValueOnce(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets,
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      now: () => now,
      retryBackoffMs: () => 0,
      syncRetryMaxAttempts: 5,
    });

    await service.runOnce();
    now += 1;
    await service.runOnce();
    now += 1;
    await service.runOnce();

    expect(workflowSync).toHaveBeenCalledTimes(3);
    expect(triageRun).toHaveBeenCalledWith('777', 'tenant-1');
  });

  it('moves sync ingestion failure to DLQ after max attempts', async () => {
    let now = 20_000;
    const searchTickets = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 999, ticketNumber: 'T20260227.0999', createDate: '2026-02-27T12:00:00.000Z' },
      ])
      .mockResolvedValue([]);
    const workflowSync = jest.fn().mockRejectedValue(new Error('Autotask API error: 429'));
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets,
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      now: () => now,
      retryBackoffMs: () => 0,
      syncRetryMaxAttempts: 2,
    });

    await service.runOnce();
    now += 1;
    await service.runOnce();
    now += 1;
    await service.runOnce();

    // 2 attempts total for the event (retry then DLQ), no unbounded retries.
    expect(workflowSync).toHaveBeenCalledTimes(2);
  });

  it('enters auth cooldown after 401 and skips immediate retries', async () => {
    let now = 30_000;
    const searchTickets = jest.fn().mockRejectedValue(new Error('Autotask API error: 401 Unauthorized'));
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets,
        } as any,
      }),
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      now: () => now,
    });

    await service.runOnce();
    expect(searchTickets).toHaveBeenCalledTimes(1);
    expect((service as any).authFailureCooldownUntil).toBeGreaterThan(now);

    now += 10_000;
    await service.runOnce();
    expect(searchTickets).toHaveBeenCalledTimes(1);
  });

  it('does not block workflow ingestion on slow company/contact lookup', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([
            {
              id: 456,
              ticketNumber: 'T20260305.0456',
              title: 'Slow identity lookup case',
              status: 'New',
              queueID: 7,
              companyID: 100,
              contactID: 200,
              createDate: '2026-03-05T12:00:00.000Z',
            },
          ]),
          getCompany: jest.fn().mockImplementation(() => new Promise(() => undefined)),
          getContact: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      identityLookupConcurrency: 1,
      identityLookupPerCallTimeoutMs: 20,
      identityLookupBudgetMs: 40,
      identityLookupMaxCompaniesPerRun: 1,
      identityLookupMaxContactsPerRun: 1,
    });

    const startedAt = Date.now();
    await service.runOnce();
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(400);
    expect(workflowSync).toHaveBeenCalledTimes(1);
    expect(triageRun).toHaveBeenCalledWith('456', 'tenant-1');
  });

  it('prioritizes identity lookup by ticket create time instead of last activity time', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          searchTickets: jest.fn().mockResolvedValue([
            {
              id: 801,
              ticketNumber: 'T20260305.0801',
              title: 'Older ticket with fresh activity',
              status: 'New',
              queueID: 7,
              companyID: 1001,
              contactID: 2001,
              createDate: '2026-03-05T09:00:00.000Z',
              lastActivityDate: '2026-03-05T20:00:00.000Z',
            },
            {
              id: 802,
              ticketNumber: 'T20260305.0802',
              title: 'Newer ticket visible in sidebar',
              status: 'New',
              queueID: 7,
              companyID: 1002,
              contactID: 2002,
              createDate: '2026-03-05T18:00:00.000Z',
              lastActivityDate: '2026-03-05T19:00:00.000Z',
            },
          ]),
          getCompany: jest.fn().mockImplementation(async (id: number) => ({ companyName: `Company ${id}` })),
          getContact: jest.fn().mockImplementation(async (id: number) => ({
            firstName: 'Contact',
            lastName: String(id),
            emailAddress: `contact-${id}@example.com`,
          })),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
      identityLookupMaxCompaniesPerRun: 1,
      identityLookupMaxContactsPerRun: 1,
    });

    await service.runOnce();

    const newerTicketEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260305.0802')?.[0];
    const olderTicketEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260305.0801')?.[0];

    expect(newerTicketEvent?.payload).toMatchObject({
      company_name: 'Company 1002',
      requester: 'Contact 2002',
      contact_name: 'Contact 2002',
      contact_email: 'contact-2002@example.com',
    });
    expect(olderTicketEvent?.payload).not.toMatchObject({
      company_name: 'Company 1001',
      requester: 'Contact 2001',
    });
  });

  it('propagates canonical org/requester when live-like Autotask lookup latency fits default timeout', async () => {
    const priorTimeout = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS;
    const priorBudget = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS;
    const priorMaxCompanies = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES;
    const priorMaxContacts = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS;

    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);

    try {
      const service = new AutotaskPollingService({
        buildPollContext: async () => ({
          tenantId: 'tenant-1',
          client: {
            searchTickets: jest.fn().mockResolvedValue([
              {
                id: 789,
                ticketNumber: 'T20260305.0789',
                title: 'Moderate identity lookup case',
                status: 'New',
                queueID: 7,
                companyID: 100,
                contactID: 200,
                createDate: '2026-03-05T12:00:00.000Z',
              },
            ]),
            getCompany: jest.fn().mockImplementation(
              async () => new Promise((resolve) => setTimeout(() => resolve({ companyName: 'Refresh Technologies' }), 1700))
            ),
            getContact: jest.fn().mockImplementation(
              async () => new Promise((resolve) => setTimeout(() => resolve({
                firstName: 'David',
                lastName: 'Martinez',
                emailAddress: 'david@refreshtech.com',
              }), 650))
            ),
          } as any,
        }),
        workflowSync,
        triageRun,
        runWithLock: async (fn) => {
          await fn();
          return { acquired: true };
        },
      });

      await service.runOnce();

      expect(workflowSync).toHaveBeenCalledTimes(1);
      expect(workflowSync.mock.calls[0]?.[0]?.payload).toMatchObject({
        company_name: 'Refresh Technologies',
        requester: 'David Martinez',
        contact_name: 'David Martinez',
        contact_email: 'david@refreshtech.com',
      });
      expect(triageRun).toHaveBeenCalledWith('789', 'tenant-1');
    } finally {
      if (priorTimeout === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS = priorTimeout;
      if (priorBudget === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS = priorBudget;
      if (priorMaxCompanies === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES = priorMaxCompanies;
      if (priorMaxContacts === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS = priorMaxContacts;
    }
  });

  it('resolves later recent tickets when ten unique companies and ten unique contacts fit default lookup coverage', async () => {
    const priorTimeout = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS;
    const priorBudget = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS;
    const priorMaxCompanies = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES;
    const priorMaxContacts = process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES;
    delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS;

    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);

    try {
      const recentTickets = [
        { id: 1001, ticketNumber: 'T20260305.1001', companyID: 501, contactID: 601, createDate: '2026-03-05T18:00:00.000Z' },
        { id: 1002, ticketNumber: 'T20260305.1002', companyID: 502, contactID: 602, createDate: '2026-03-05T17:59:00.000Z' },
        { id: 1003, ticketNumber: 'T20260305.1003', companyID: 503, contactID: 603, createDate: '2026-03-05T17:58:00.000Z' },
        { id: 1004, ticketNumber: 'T20260305.1004', companyID: 504, contactID: 604, createDate: '2026-03-05T17:57:00.000Z' },
        { id: 1005, ticketNumber: 'T20260305.1005', companyID: 505, contactID: 605, createDate: '2026-03-05T17:56:00.000Z' },
        { id: 1006, ticketNumber: 'T20260305.1006', companyID: 506, contactID: 606, createDate: '2026-03-05T17:55:00.000Z' },
        { id: 1007, ticketNumber: 'T20260305.1007', companyID: 507, contactID: 607, createDate: '2026-03-05T17:54:00.000Z' },
        { id: 1008, ticketNumber: 'T20260305.1008', companyID: 508, contactID: 608, createDate: '2026-03-05T17:53:00.000Z' },
        { id: 1009, ticketNumber: 'T20260305.1009', companyID: 509, contactID: 609, createDate: '2026-03-05T17:52:00.000Z' },
        { id: 1010, ticketNumber: 'T20260305.1010', companyID: 510, contactID: 610, createDate: '2026-03-05T17:51:00.000Z' },
      ].map((ticket) => ({
        ...ticket,
        title: `Coverage case ${ticket.id}`,
        status: 'New',
        queueID: 7,
      }));

      const service = new AutotaskPollingService({
        buildPollContext: async () => ({
          tenantId: 'tenant-1',
          client: {
            searchTickets: jest.fn().mockResolvedValue(recentTickets),
            getCompany: jest.fn().mockImplementation(
              async (id: number) => new Promise((resolve) => setTimeout(() => resolve({ companyName: `Company ${id}` }), 20))
            ),
            getContact: jest.fn().mockImplementation(
              async (id: number) => new Promise((resolve) => setTimeout(() => resolve({
                firstName: 'Contact',
                lastName: String(id),
                emailAddress: `contact-${id}@example.com`,
              }), 15))
            ),
          } as any,
        }),
        workflowSync,
        triageRun,
        runWithLock: async (fn) => {
          await fn();
          return { acquired: true };
        },
      });

      await service.runOnce();

      const sixthTicketEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260305.1006')?.[0];
      const tenthTicketEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260305.1010')?.[0];

      expect(workflowSync).toHaveBeenCalledTimes(10);
      expect(sixthTicketEvent?.payload).toMatchObject({
        company_name: 'Company 506',
        requester: 'Contact 606',
        contact_name: 'Contact 606',
        contact_email: 'contact-606@example.com',
      });
      expect(tenthTicketEvent?.payload).toMatchObject({
        company_name: 'Company 510',
        requester: 'Contact 610',
        contact_name: 'Contact 610',
        contact_email: 'contact-610@example.com',
      });
    } finally {
      if (priorTimeout === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_TIMEOUT_MS = priorTimeout;
      if (priorBudget === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_BUDGET_MS = priorBudget;
      if (priorMaxCompanies === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_COMPANIES = priorMaxCompanies;
      if (priorMaxContacts === undefined) delete process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS;
      else process.env.AUTOTASK_POLLER_IDENTITY_LOOKUP_MAX_CONTACTS = priorMaxContacts;
    }
  });

  it('hydrates older queue snapshot tickets that are still missing canonical identity in the inbox', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const getCompany = jest.fn().mockImplementation(async (id: number) => ({ companyName: `Company ${id}` }));
    const getContact = jest.fn().mockImplementation(async (id: number) => ({
      firstName: 'Contact',
      lastName: String(id),
      emailAddress: `contact-${id}@example.com`,
    }));
    const searchTickets = jest.fn(async (filter: string) => {
      const raw = JSON.parse(filter);
      if (raw?.op === 'gt' && raw?.field === 'createDate') return [];
      if (!Array.isArray(raw?.filter)) return [];
      const fields = raw.filter.map((entry: any) => String(entry?.field || ''));
      if (fields.includes('queueID') && fields.includes('createDate')) return [];
      if (!fields.includes('queueID')) return [];
      return [
        {
          id: 9001,
          ticketNumber: 'T20260304.0001',
          title: 'Already hydrated backlog ticket',
          status: 'New',
          queueID: 7,
          companyID: 901,
          contactID: 1001,
          createDate: '2026-03-04T18:00:00.000Z',
        },
        {
          id: 9002,
          ticketNumber: 'T20260303.0001',
          title: 'Older backlog ticket still missing identity',
          status: 'New',
          queueID: 7,
          companyID: 902,
          contactID: 1002,
          createDate: '2026-03-03T18:00:00.000Z',
        },
      ];
    });
    const listInboxSpy = jest.spyOn(workflowService, 'listInbox').mockResolvedValue([
      {
        ticket_id: 'T20260304.0001',
        company: 'Hydrated Org',
        requester: 'Hydrated User',
        domain_snapshots: {
          tickets: {
            company_name: 'Hydrated Org',
            requester_name: 'Hydrated User',
          },
        },
      } as any,
      {
        ticket_id: 'T20260303.0001',
        company: null,
        requester: null,
        domain_snapshots: {
          tickets: {},
        },
      } as any,
    ]);

    try {
      const service = new AutotaskPollingService({
        buildPollContext: async () => ({
          tenantId: 'tenant-1',
          client: {
            getTicketQueues: jest.fn().mockResolvedValue([{ id: 7, name: 'Service Desk' }]),
            searchTickets,
            getCompany,
            getContact,
          } as any,
        }),
        workflowSync,
        triageRun,
        runWithLock: async (fn) => {
          await fn();
          return { acquired: true };
        },
        identityLookupMaxCompaniesPerRun: 1,
        identityLookupMaxContactsPerRun: 1,
      });

      await service.runOnce();

      const missingBacklogEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260303.0001')?.[0];

      expect(getCompany).toHaveBeenCalledTimes(1);
      expect(getCompany).toHaveBeenCalledWith(902);
      expect(getContact).toHaveBeenCalledTimes(1);
      expect(getContact).toHaveBeenCalledWith(1002);
      expect(workflowSync).toHaveBeenCalledTimes(2);
      expect(missingBacklogEvent).toMatchObject({
        tenant_id: 'tenant-1',
        event_type: 'ticket.created',
        entity_id: 'T20260303.0001',
        provenance: { source: 'autotask_reconcile' },
        payload: {
          company_name: 'Company 902',
          requester: 'Contact 1002',
          contact_name: 'Contact 1002',
          contact_email: 'contact-1002@example.com',
        },
      });
      expect(triageRun).not.toHaveBeenCalled();
    } finally {
      listInboxSpy.mockRestore();
    }
  });

  it('changes the reconcile event id when canonical payload gains identity fields', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      workflowSync,
      buildPollContext: async () => null,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });
    const ticket = {
      id: 9002,
      ticketNumber: 'T20260303.0001',
      title: 'Older backlog ticket still missing identity',
      status: 'New',
      queueID: 7,
      companyID: 902,
      contactID: 1002,
      createDate: '2026-03-03T18:00:00.000Z',
    };

    await (service as any).ingestWorkflowSyncEvent(ticket, 'tenant-1', 'autotask_reconcile');
    await (service as any).ingestWorkflowSyncEvent(ticket, 'tenant-1', 'autotask_reconcile', {
      companyNameById: new Map([[902, 'Company 902']]),
      requesterNameByContactId: new Map([[1002, 'Contact 1002']]),
      contactEmailByContactId: new Map([[1002, 'contact-1002@example.com']]),
    });

    const unenrichedEvent = workflowSync.mock.calls[0]?.[0];
    const enrichedEvent = workflowSync.mock.calls[1]?.[0];

    expect(unenrichedEvent?.event_id).toMatch(/^autotask_reconcile:9002:ticket\.created:2026-03-03T18:00:00.000Z:/);
    expect(enrichedEvent?.event_id).toMatch(/^autotask_reconcile:9002:ticket\.created:2026-03-03T18:00:00.000Z:/);
    expect(enrichedEvent?.event_id).not.toBe(unenrichedEvent?.event_id);
    expect(unenrichedEvent?.payload).toMatchObject({
      company_name: undefined,
      requester: undefined,
      contact_email: undefined,
    });
    expect(enrichedEvent?.payload).toMatchObject({
      company_name: 'Company 902',
      requester: 'Contact 1002',
      contact_email: 'contact-1002@example.com',
    });
  });

  it('runs queue snapshot reconcile before dispatching triage for recent tickets', async () => {
    const callOrder: string[] = [];
    const workflowSync = jest.fn().mockImplementation(async (event) => {
      callOrder.push(`${event.provenance?.source}:${event.entity_id}`);
    });
    const triageRun = jest.fn().mockImplementation(async (ticketId: string) => {
      callOrder.push(`triage:${ticketId}`);
    });
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          getTicketQueues: jest.fn().mockResolvedValue([{ id: 7, name: 'Service Desk' }]),
          searchTickets: jest.fn().mockImplementation(async (filter: string) => {
            const raw = JSON.parse(filter);
            if (raw?.op === 'gt' && raw?.field === 'createDate') {
              return [
                {
                  id: 3001,
                  ticketNumber: 'T20260305.3001',
                  title: 'Recent ticket',
                  status: 'New',
                  queueID: 7,
                  createDate: '2026-03-05T18:00:00.000Z',
                },
              ];
            }
            if (!Array.isArray(raw?.filter)) return [];
            const fields = raw.filter.map((entry: any) => String(entry?.field || ''));
            if (fields.includes('queueID') && fields.includes('createDate')) return [];
            if (!fields.includes('queueID')) return [];
            return [
              {
                id: 3002,
                ticketNumber: 'T20260304.3002',
                title: 'Older backlog ticket',
                status: 'New',
                queueID: 7,
                companyID: 902,
                contactID: 1002,
                createDate: '2026-03-04T18:00:00.000Z',
              },
            ];
          }),
          getCompany: jest.fn().mockResolvedValue({ companyName: 'Company 902' }),
          getContact: jest.fn().mockResolvedValue({
            firstName: 'Contact',
            lastName: '1002',
            emailAddress: 'contact-1002@example.com',
          }),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    expect(callOrder).toEqual([
      'autotask_poller:T20260305.3001',
      'autotask_reconcile:T20260304.3002',
      'triage:3001',
    ]);
  });

  it('prioritizes the oldest missing backlog tickets for queue snapshot identity hydration', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const inboxSpy = jest.spyOn(workflowService, 'listInbox').mockResolvedValue([
      {
        tenant_id: 'tenant-1',
        ticket_id: 'T20260301.1001',
        company: undefined,
        requester: undefined,
        comments: [],
        source_of_truth: 'Autotask',
        updated_at: '2026-03-05T12:00:00.000Z',
      },
      {
        tenant_id: 'tenant-1',
        ticket_id: 'T20260304.1002',
        company: undefined,
        requester: undefined,
        comments: [],
        source_of_truth: 'Autotask',
        updated_at: '2026-03-05T12:00:00.000Z',
      },
    ] as any);

    try {
      const service = new AutotaskPollingService({
        buildPollContext: async () => ({
          tenantId: 'tenant-1',
          client: {
            getTicketQueues: jest.fn().mockResolvedValue([{ id: 7, name: 'Service Desk' }]),
            searchTickets: jest.fn(async (filter: string) => {
              const raw = JSON.parse(filter);
              if (!Array.isArray(raw?.filter)) return [];
              const fields = raw.filter.map((entry: any) => String(entry?.field || ''));
              if (!fields.includes('queueID')) return [];
              if (fields.includes('createDate')) return [];
              return [
                {
                  id: 1002,
                  ticketNumber: 'T20260304.1002',
                  title: 'Newer missing backlog ticket',
                  status: 'New',
                  queueID: 7,
                  companyID: 902,
                  contactID: 1002,
                  createDate: '2026-03-04T18:00:00.000Z',
                },
                {
                  id: 1001,
                  ticketNumber: 'T20260301.1001',
                  title: 'Oldest missing backlog ticket',
                  status: 'New',
                  queueID: 7,
                  companyID: 901,
                  contactID: 1001,
                  createDate: '2026-03-01T18:00:00.000Z',
                },
              ];
            }),
            getCompany: jest.fn().mockImplementation(async (id: number) => ({ companyName: `Company ${id}` })),
            getContact: jest.fn().mockImplementation(async (id: number) => ({
              firstName: 'Contact',
              lastName: String(id),
              emailAddress: `contact-${id}@example.com`,
            })),
          } as any,
        }),
        workflowSync,
        runWithLock: async (fn) => {
          await fn();
          return { acquired: true };
        },
        identityLookupMaxCompaniesPerRun: 1,
        identityLookupMaxContactsPerRun: 1,
      });

      await service.runOnce();

      const oldestEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260301.1001')?.[0];
      const newerEvent = workflowSync.mock.calls.find((call) => call?.[0]?.entity_id === 'T20260304.1002')?.[0];

      expect(oldestEvent?.payload).toMatchObject({
        company_name: 'Company 901',
        requester: 'Contact 1001',
        contact_name: 'Contact 1001',
      });
      expect(newerEvent?.payload).not.toMatchObject({
        company_name: 'Company 902',
        requester: 'Contact 1002',
      });
    } finally {
      inboxSpy.mockRestore();
    }
  });

  it('runs aggressive inbox hydration sweep after recent triage dispatch', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const catchupSpy = jest.spyOn(workflowService, 'runInboxHydrationSweep').mockResolvedValue({
      candidateCount: 12,
      selectedCount: 12,
      hydratedCount: 8,
      remainingCount: 4,
      strategy: 'oldest-first',
    } as any);

    try {
      const service = new AutotaskPollingService({
        buildPollContext: async () => ({
          tenantId: 'tenant-1',
          client: {
            searchTickets: jest.fn().mockResolvedValue([
              {
                id: 9001,
                ticketNumber: 'T20260305.9001',
                title: 'Recent ticket',
                status: 'New',
                queueID: 7,
                createDate: '2026-03-05T18:00:00.000Z',
              },
            ]),
          } as any,
        }),
        workflowSync,
        triageRun,
        runWithLock: async (fn) => {
          await fn();
          return { acquired: true };
        },
      });

      await service.runOnce();

      expect(triageRun).toHaveBeenCalledWith('9001', 'tenant-1');
      expect(catchupSpy).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
        batchSize: 100,
        remoteBatchSize: 50,
        strategy: 'oldest-first',
      }));
    } finally {
      catchupSpy.mockRestore();
    }
  });

  it('pushes terminal status exclusions into queue snapshot queries', async () => {
    const searchTickets = jest.fn().mockResolvedValue([]);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          getTicketQueues: jest.fn().mockResolvedValue([{ id: 7, name: 'Service Desk' }]),
          getTicketStatusOptions: jest.fn().mockResolvedValue([
            { id: 1, label: 'New' },
            { id: 5, label: 'Complete' },
            { id: 6, label: 'Resolved' },
          ]),
          searchTickets,
        } as any,
      }),
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    const queueSearches = searchTickets.mock.calls
      .map((call) => JSON.parse(String(call?.[0] || '{}')))
      .filter((raw) => Array.isArray(raw?.filter) && raw.filter.some((entry: any) => entry?.field === 'queueID'));
    const backlogSearch = queueSearches.find((raw) => !raw.filter.some((entry: any) => entry?.field === 'createDate'));

    expect(backlogSearch?.filter).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'queueID', op: 'eq', value: 7 }),
      expect.objectContaining({ field: 'status', op: 'noteq', value: '5' }),
      expect.objectContaining({ field: 'status', op: 'noteq', value: '6' }),
    ]));
  });

  it('resolves picklist labels (status, priority, etc.) from numeric IDs', async () => {
    const workflowSync = jest.fn().mockResolvedValue(undefined);
    const triageRun = jest.fn().mockResolvedValue(undefined);
    const service = new AutotaskPollingService({
      buildPollContext: async () => ({
        tenantId: 'tenant-1',
        client: {
          getTicketStatusOptions: jest.fn().mockResolvedValue([{ id: 1, label: 'New' }, { id: 5, label: 'Complete' }]),
          getTicketPriorityOptions: jest.fn().mockResolvedValue([{ id: 1, label: 'High' }, { id: 2, label: 'Medium' }]),
          getTicketIssueTypeOptions: jest.fn().mockResolvedValue([{ id: 10, label: 'Bug' }]),
          getTicketSubIssueTypeOptions: jest.fn().mockResolvedValue([{ id: 101, label: 'UI Bug' }]),
          getTicketServiceLevelAgreementOptions: jest.fn().mockResolvedValue([{ id: 50, label: 'Standard SLA' }]),
          getTicketQueues: jest.fn().mockResolvedValue([{ id: 7, label: 'Support Queue' }]),
          searchTickets: jest.fn().mockResolvedValue([
            {
              id: 789,
              ticketNumber: 'T20260305.0789',
              title: 'Label resolution test',
              status: 1,
              priority: 2,
              issueType: 10,
              subIssueType: 101,
              serviceLevelAgreementID: 50,
              queueID: 7,
              createDate: '2026-03-05T13:00:00.000Z',
            },
          ]),
        } as any,
      }),
      workflowSync,
      triageRun,
      runWithLock: async (fn) => {
        await fn();
        return { acquired: true };
      },
    });

    await service.runOnce();

    expect(workflowSync).toHaveBeenCalledTimes(1);
    const payload = workflowSync.mock.calls[0]?.[0]?.payload;
    expect(payload).toMatchObject({
      status: 1,
      status_label: 'New',
      priority: 2,
      priority_label: 'Medium',
      issue_type: 10,
      issue_type_label: 'Bug',
      sub_issue_type: 101,
      sub_issue_type_label: 'UI Bug',
      sla_id: 50,
      sla_label: 'Standard SLA',
      queue_id: 7,
      queue_name: 'Support Queue',
    });
  });
});
