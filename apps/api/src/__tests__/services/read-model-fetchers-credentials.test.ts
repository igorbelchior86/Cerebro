import { queryOne } from '../../db/index.js';
import { AutotaskFetcher } from '../../services/read-models/data-fetchers/autotask-fetcher.js';
import { ITGlueFetcher } from '../../services/read-models/data-fetchers/itglue-fetcher.js';
import { NinjaOneFetcher } from '../../services/read-models/data-fetchers/ninjaone-fetcher.js';

jest.mock('../../db/index.js', () => ({
  queryOne: jest.fn(),
}));

const queryOneMock = queryOne as jest.MockedFunction<typeof queryOne>;

describe('read-model fetchers credential lookup', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
  });

  it('uses integration_credentials with tenant scope for Autotask', async () => {
    queryOneMock.mockResolvedValueOnce({
      credentials: { apiIntegrationCode: 'code', username: 'user', secret: 'secret' },
    } as never);

    const fetcher = new AutotaskFetcher() as any;
    const creds = await fetcher.getCredentials({ tenantId: 'tenant-1' });

    expect(creds).toEqual({ apiIntegrationCode: 'code', username: 'user', secret: 'secret' });
    expect(queryOneMock).toHaveBeenCalledTimes(1);
    expect(String(queryOneMock.mock.calls[0]?.[0] || '')).toContain('FROM integration_credentials');
    expect(String(queryOneMock.mock.calls[0]?.[0] || '')).toContain("service = 'autotask'");
    expect(queryOneMock.mock.calls[0]?.[1]).toEqual(['tenant-1']);
  });

  it('uses integration_credentials with tenant scope for ITGlue', async () => {
    queryOneMock.mockResolvedValueOnce({
      credentials: { apiKey: 'k', region: 'us' },
    } as never);

    const fetcher = new ITGlueFetcher() as any;
    const creds = await fetcher.getCredentials({ tenantId: 'tenant-1' });

    expect(creds).toEqual({ apiKey: 'k', region: 'us' });
    expect(String(queryOneMock.mock.calls[0]?.[0] || '')).toContain('FROM integration_credentials');
    expect(String(queryOneMock.mock.calls[0]?.[0] || '')).toContain("service = 'itglue'");
    expect(queryOneMock.mock.calls[0]?.[1]).toEqual(['tenant-1']);
  });

  it('uses integration_credentials with tenant scope for NinjaOne', async () => {
    queryOneMock.mockResolvedValueOnce({
      credentials: { clientId: 'id', clientSecret: 'secret', region: 'us' },
    } as never);

    const fetcher = new NinjaOneFetcher() as any;
    const creds = await fetcher.getCredentials({ tenantId: 'tenant-1' });

    expect(creds).toEqual({ clientId: 'id', clientSecret: 'secret', region: 'us' });
    expect(String(queryOneMock.mock.calls[0]?.[0] || '')).toContain('FROM integration_credentials');
    expect(String(queryOneMock.mock.calls[0]?.[0] || '')).toContain("service = 'ninjaone'");
    expect(queryOneMock.mock.calls[0]?.[1]).toEqual(['tenant-1']);
  });

  it('returns null and avoids query when tenantId is missing', async () => {
    const autotaskFetcher = new AutotaskFetcher() as any;
    const itglueFetcher = new ITGlueFetcher() as any;
    const ninjaFetcher = new NinjaOneFetcher() as any;

    await expect(autotaskFetcher.getCredentials({ tenantId: '' })).resolves.toBeNull();
    await expect(itglueFetcher.getCredentials({})).resolves.toBeNull();
    await expect(ninjaFetcher.getCredentials({ tenantId: '   ' })).resolves.toBeNull();
    expect(queryOneMock).not.toHaveBeenCalled();
  });

  it('returns null when DB lookup throws', async () => {
    queryOneMock.mockRejectedValueOnce(new Error('db failed'));

    const fetcher = new AutotaskFetcher() as any;
    await expect(fetcher.getCredentials({ tenantId: 'tenant-1' })).resolves.toBeNull();
  });
});

