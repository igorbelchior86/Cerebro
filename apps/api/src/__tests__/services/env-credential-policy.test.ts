jest.mock('../../db/index.js', () => ({
  queryOne: jest.fn(),
}));

import { queryOne } from '../../db/index.js';
import { canUseEnvCredentialsForUser, isPlatformMasterEmail } from '../../services/identity/env-credential-policy.js';

describe('env credential policy', () => {
  const queryOneMock = queryOne as jest.MockedFunction<typeof queryOne>;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PLATFORM_MASTER_EMAIL;
  });

  it('allows env credentials only for platform master email', async () => {
    queryOneMock.mockResolvedValue({ email: 'admin@cerebro.local' } as any);

    await expect(canUseEnvCredentialsForUser('user-1')).resolves.toBe(true);
    expect(queryOneMock).toHaveBeenCalledWith(
      'SELECT email FROM users WHERE id = $1 LIMIT 1',
      ['user-1']
    );
  });

  it('denies env credentials for non-master users or missing actor', async () => {
    queryOneMock.mockResolvedValue({ email: 'tech@customer.com' } as any);
    await expect(canUseEnvCredentialsForUser('user-2')).resolves.toBe(false);
    await expect(canUseEnvCredentialsForUser('')).resolves.toBe(false);
  });

  it('supports PLATFORM_MASTER_EMAIL override', async () => {
    process.env.PLATFORM_MASTER_EMAIL = 'root@cerebro.local';
    queryOneMock.mockResolvedValue({ email: 'root@cerebro.local' } as any);

    await expect(canUseEnvCredentialsForUser('user-3')).resolves.toBe(true);
    expect(isPlatformMasterEmail('root@cerebro.local')).toBe(true);
    expect(isPlatformMasterEmail('admin@cerebro.local')).toBe(false);
  });
});
