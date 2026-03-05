import express from 'express';
import request from 'supertest';
import router from '../../services/application/route-handlers/integrations-route-handlers.js';
import * as db from '../../db/index.js';

describe('PUT /integrations/credentials/:service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves stored sensitive Autotask fields when masked placeholders are submitted', async () => {
    jest.spyOn(db, 'queryOne').mockResolvedValue({
      credentials: {
        apiIntegrationCode: 'real-code',
        username: 'old-user@company.com',
        secret: 'real-secret',
      },
    } as any);
    const querySpy = jest.spyOn(db, 'query').mockResolvedValue([] as any);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).auth = { tid: 'tenant-1' };
      next();
    });
    app.use('/integrations', router);

    const response = await request(app)
      .put('/integrations/credentials/autotask')
      .send({
        username: 'new-user@company.com',
        apiIntegrationCode: 're••••de',
        secret: 're••••et',
      });

    expect(response.status).toBe(200);
    expect(querySpy).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(String(querySpy.mock.calls[0]?.[1]?.[2] || '{}'));
    expect(persisted).toMatchObject({
      apiIntegrationCode: 'real-code',
      secret: 'real-secret',
      username: 'new-user@company.com',
    });
  });
});
