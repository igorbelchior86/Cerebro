import { AutotaskPollingService } from '../../services/adapters/autotask-polling.js';

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
    expect(triageRun).toHaveBeenCalledWith('3002');
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
    expect(triageRun).toHaveBeenCalledWith('123');
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
    expect(triageRun).toHaveBeenCalledWith('321');
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
    expect(triageRun).toHaveBeenCalled();
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
    expect(triageRun).toHaveBeenCalledWith('456');
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
      expect(triageRun).toHaveBeenCalledWith('789');
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
