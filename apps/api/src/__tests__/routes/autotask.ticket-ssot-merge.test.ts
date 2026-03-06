import { query, queryOne } from '../../db/index.js';

jest.mock('../../db/index.js', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}));

const queryMock = query as jest.MockedFunction<typeof query>;
const queryOneMock = queryOne as jest.MockedFunction<typeof queryOne>;

describe('autotask ticket ssot merge concurrency guard', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
  });

  it('merges ssot patches atomically so concurrent authoritative updates do not clobber each other', async () => {
    let currentPayload: Record<string, unknown> = {
      summary: 'keep-me',
      autotask_authoritative: {
        priority_label: 'Low',
      },
    };

    queryMock.mockImplementation(async (sql, params) => {
      const normalized = String(sql);
      expect(normalized).toContain("COALESCE(ticket_ssot.payload, '{}'::jsonb)");
      expect(normalized).toContain("ticket_ssot.payload->'autotask_authoritative'");

      const patch = JSON.parse(String(params?.[2] || '{}')) as Record<string, unknown>;
      const nextAutotask = {
        ...((currentPayload.autotask_authoritative || {}) as Record<string, unknown>),
        ...(((patch.autotask_authoritative as Record<string, unknown>) || {})),
      };

      currentPayload = {
        ...currentPayload,
        ...patch,
        autotask_authoritative: nextAutotask,
      };

      return [] as never;
    });

    const { __testables } = await import('../../services/application/route-handlers/autotask-route-handlers.js');

    await Promise.all([
      __testables.mergeAutotaskContextIntoTicketSsot('T20260306.0100', 'session-a', {
        company: 'Acme MSP',
        autotask_authoritative: {
          company_name: 'Acme MSP',
        },
      }),
      __testables.mergeAutotaskContextIntoTicketSsot('T20260306.0100', 'session-b', {
        requester_name: 'Jane Doe',
        autotask_authoritative: {
          priority_label: 'High',
          contact_name: 'Jane Doe',
        },
      }),
    ]);

    expect(queryOneMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(currentPayload).toEqual({
      summary: 'keep-me',
      company: 'Acme MSP',
      requester_name: 'Jane Doe',
      autotask_authoritative: {
        priority_label: 'High',
        company_name: 'Acme MSP',
        contact_name: 'Jane Doe',
      },
    });
  });
});
