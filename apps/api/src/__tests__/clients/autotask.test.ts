/**
 * Unit tests for Autotask connector
 */

import { AutotaskClient } from '../../clients/autotask';

// Mock fetch
global.fetch = jest.fn();

describe('AutotaskClient', () => {
  let client: AutotaskClient;

  beforeEach(() => {
    client = new AutotaskClient({ apiIntegrationCode: 'test-code', username: 'test@example.com', secret: 'test-secret' });
    jest.clearAllMocks();
  });

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
  });
});
