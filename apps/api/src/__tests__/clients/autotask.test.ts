/**
 * Unit tests for Autotask connector
 */

import { AutotaskClient } from '../../clients/autotask';

// Mock fetch
global.fetch = jest.fn();

describe('AutotaskClient', () => {
  let client: AutotaskClient;

  beforeEach(() => {
    jest.resetAllMocks();
    AutotaskClient.__resetAuthFailureCooldownForTests();
    client = new AutotaskClient({
      apiIntegrationCode: 'test-code',
      username: 'test@example.com',
      secret: 'test-secret',
      zoneUrl: 'https://webservices14.autotask.net/atservicesrest/v1.0'
    });
  });

  function findFetchCall(
    pathSuffix: string,
    method: string,
  ): [string, { method?: string; body?: unknown } | undefined] {
    const call = (global.fetch as jest.Mock).mock.calls.find(([url, init]: [string, { method?: string } | undefined]) => {
      const pathname = new URL(String(url)).pathname.toLowerCase();
      const requestMethod = String(init?.method || 'GET').toUpperCase();
      return pathname.endsWith(pathSuffix.toLowerCase()) && requestMethod === method.toUpperCase();
    });
    if (!call) {
      throw new Error(`Expected fetch call ${method} ${pathSuffix}`);
    }
    return call as [string, { method?: string; body?: unknown } | undefined];
  }

  describe('constructor', () => {
    it('should initialize with correct base URL', () => {
      expect(client).toBeDefined();
    });

    it('should throw error if credentials not set', () => {
      expect(() => new AutotaskClient({ apiIntegrationCode: '', username: '', secret: '' })).toBeDefined();
    });
  });

  describe('getTicket', () => {
    it('should fetch ticket by numeric ID', async () => {
      const mockTicket = {
        id: 123,
        ticketNumber: 'T-001',
        summary: 'Test ticket',
        companyName: 'Test Corp'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pageDetails: { id: 1 }, records: [mockTicket] })
      });

      const result = await client.getTicket(123);

      expect(result).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should parse ticket by ID responses that return item', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ item: { id: 123, ticketNumber: 'T20260225.0123', title: 'Single item ticket' } })
      });

      const result = await client.getTicket(123);
      expect((result as any).ticketNumber).toBe('T20260225.0123');
    });

    it('should throw error if ticket not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pageDetails: { id: 1 }, records: [] })
      });

      await expect(client.getTicket(999)).rejects.toThrow('Ticket 999 not found');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(client.getTicket(123)).rejects.toThrow('Autotask API error');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused')
      );

      await expect(client.getTicket(123)).rejects.toThrow('Connection refused');
    });

    it('should short-circuit repeated auth attempts while cooldown is active', async () => {
      const lockedClient = new AutotaskClient({
        apiIntegrationCode: 'lock-test-code',
        username: 'lock-test@example.com',
        secret: 'lock-test-secret',
        zoneUrl: 'https://webservices14.autotask.net/atservicesrest/v1.0',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Account locked',
      });

      await expect(lockedClient.getTicket(123)).rejects.toThrow('Autotask API error: 401 Unauthorized');

      await expect(lockedClient.getTicket(123)).rejects.toThrow('authentication cooldown active');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should bypass previous cooldown after secret rotation for same principal', async () => {
      const oldSecretClient = new AutotaskClient({
        apiIntegrationCode: 'lock-test-code',
        username: 'lock-test@example.com',
        secret: 'old-secret',
        zoneUrl: 'https://webservices14.autotask.net/atservicesrest/v1.0',
      });
      const newSecretClient = new AutotaskClient({
        apiIntegrationCode: 'lock-test-code',
        username: 'lock-test@example.com',
        secret: 'new-secret',
        zoneUrl: 'https://webservices14.autotask.net/atservicesrest/v1.0',
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'Account locked',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ item: { id: 123, ticketNumber: 'T20260305.0123' } }),
          headers: { get: () => 'application/json' },
        });

      await expect(oldSecretClient.getTicket(123)).rejects.toThrow('Autotask API error: 401 Unauthorized');
      await expect(newSecretClient.getTicket(123)).resolves.toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchTickets', () => {
    it('should send documented search payload format for ticket queries', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pageDetails: {}, records: [] })
        });

      await client.searchTickets('{"op":"gt","field":"createDate","value":"2026-02-25T16:00:00.000Z"}', 50, 0);

      const requestUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const url = new URL(requestUrl);
      const searchParam = url.searchParams.get('search');
      expect(searchParam).toBeTruthy();

      const parsed = JSON.parse(searchParam as string);
      expect(parsed.MaxRecords).toBe(50);
      expect(Array.isArray(parsed.filter)).toBe(true);
      expect(parsed.filter[0]).toMatchObject({ op: 'gt', field: 'createDate' });
      expect(url.searchParams.get('pageSize')).toBeNull();
      expect(url.searchParams.get('pageNumber')).toBeNull();
    });

    it('should parse query responses that return items', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 321, ticketNumber: 'T20260225.9999', title: 'From query items' }] })
      });

      const result = await client.searchTickets('{"op":"eq","field":"ticketNumber","value":"T20260225.9999"}', 5, 0);
      expect(result).toHaveLength(1);
      expect((result[0] as any).ticketNumber).toBe('T20260225.9999');
    });

    it('should follow nextPageUrl until all query pages are collected', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { id: 101, ticketNumber: 'T20260305.0101' },
              { id: 102, ticketNumber: 'T20260305.0102' },
            ],
            pageDetails: {
              nextPageUrl: 'https://webservices14.autotask.net/atservicesrest/v1.0/Tickets/query?nextId=page-2',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { id: 103, ticketNumber: 'T20260305.0103' },
            ],
            pageDetails: {},
          }),
        });

      const result = await client.searchTickets('{"op":"gt","field":"createDate","value":"2026-03-01T00:00:00.000Z"}', 2, 0);

      expect(result).toHaveLength(3);
      expect((result[2] as any).ticketNumber).toBe('T20260305.0103');
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(
        'https://webservices14.autotask.net/atservicesrest/v1.0/Tickets/query?nextId=page-2',
      );
    });
  });

  describe('getTicketByTicketNumber', () => {
    it('should return exact ticket match from query results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 111, ticketNumber: 'T20260225.0001', title: 'Match' }] })
      });

      const result = await client.getTicketByTicketNumber('T20260225.0001');
      expect((result as any).id).toBe(111);
    });
  });

  describe('write contracts', () => {
    it('should resolve created ticket by itemId when POST /tickets omits item payload', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ itemId: 1234 }),
          headers: { get: () => 'application/json' },
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ item: { id: 1234, ticketNumber: 'T20260302.1234', title: 'Created ticket' } }),
          headers: { get: () => 'application/json' },
        });

      const result = await client.createTicket({ title: 'Created ticket', companyID: 10 });

      const createUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
      expect(createUrl.pathname.toLowerCase()).toContain('/tickets');
      const fetchByIdUrl = new URL((global.fetch as jest.Mock).mock.calls[1][0] as string);
      expect(fetchByIdUrl.pathname.toLowerCase()).toContain('/tickets/1234');
      expect((result as any).ticketNumber).toBe('T20260302.1234');
    });

    it('should PATCH /tickets with body id when updating by ticket number', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 333, ticketNumber: 'T20260226.0033' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ item: { id: 333 } })
        });

      await client.updateTicket('T20260226.0033', { status: 'In Progress' });

      const queryUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
      expect(queryUrl.pathname.toLowerCase()).toContain('/tickets/query');

      const patchUrl = new URL((global.fetch as jest.Mock).mock.calls[1][0] as string);
      const patchInit = (global.fetch as jest.Mock).mock.calls[1][1];
      expect(patchUrl.pathname.toLowerCase()).toContain('/tickets');
      expect(patchInit.method).toBe('PATCH');
      expect(JSON.parse(String(patchInit.body))).toMatchObject({ id: 333, status: 'In Progress' });
    });

    it('should POST /tickets/{id}/notes when creating notes by ticket number', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 444, ticketNumber: 'T20260226.0044' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            fields: [
              { name: 'noteType', picklistValues: [{ value: 7, label: 'Internal' }] },
              {
                name: 'publish',
                picklistValues: [{ value: 1, label: 'All Autotask Users' }, { value: 2, label: 'Internal' }]
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ item: { id: 12345 } })
        });

      await client.createTicketNote('T20260226.0044', { noteText: 'hello', noteType: 'Internal' });

      const [postUrlRaw, postInit] = findFetchCall('/tickets/444/notes', 'POST');
      const postUrl = new URL(postUrlRaw);
      expect(postUrl.pathname.toLowerCase()).toContain('/tickets/444/notes');
      expect(postInit?.method).toBe('POST');
      expect(JSON.parse(String(postInit!.body))).toMatchObject({ noteText: 'hello', description: 'hello', noteType: 7, title: 'hello' });
    });

    it('should DELETE /tickets/{id} for ticket delete operations', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 777, ticketNumber: 'T20260227.0777' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: { get: () => null },
          text: async () => ''
        });

      await client.deleteTicket('T20260227.0777');

      const [deleteUrlRaw, deleteInit] = findFetchCall('/tickets/777', 'DELETE');
      const deleteUrl = new URL(deleteUrlRaw);
      expect(deleteUrl.pathname.toLowerCase()).toContain('/tickets/777');
      expect(deleteInit?.method).toBe('DELETE');
    });

    it('should PATCH /timeEntries with body id for time entry update', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ item: { id: 991 } })
      });

      await client.updateTimeEntry(991, { hoursWorked: 2 });

      const patchUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
      const patchInit = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(patchUrl.pathname.toLowerCase()).toContain('/timeentries');
      expect(patchInit.method).toBe('PATCH');
      expect(JSON.parse(String(patchInit.body))).toMatchObject({ id: 991, hoursWorked: 2 });
    });

    it('should POST /tickets/{id}/attachments with attachmentInfo payload', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 888, ticketNumber: 'T20260227.0888' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ item: { id: 5555 } })
        });

      await client.createTicketAttachment('T20260227.0888', {
        title: 'error screenshot',
        fileName: 'error.png',
        contentType: 'image/png',
        dataBase64: 'data:image/png;base64,QUJD',
      });

      const [postUrlRaw, postInit] = findFetchCall('/tickets/888/attachments', 'POST');
      const postUrl = new URL(postUrlRaw);
      expect(postUrl.pathname.toLowerCase()).toContain('/tickets/888/attachments');
      expect(postInit?.method).toBe('POST');
      expect(JSON.parse(String(postInit!.body))).toMatchObject({
        attachmentInfo: {
          title: 'error screenshot',
          fullPath: 'error.png',
          contentType: 'image/png',
          data: 'QUJD',
        },
      });
    });
  });
});
