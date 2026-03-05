import express from 'express';
import request from 'supertest';
import router from '../../services/application/route-handlers/autotask-route-handlers.js';
import { AutotaskClient } from '../../clients/index.js';
import * as db from '../../db/index.js';

describe('GET /autotask/sidebar-tickets', () => {
  const originalEnv = {
    AUTOTASK_API_INTEGRATION_CODE: process.env.AUTOTASK_API_INTEGRATION_CODE,
    AUTOTASK_USERNAME: process.env.AUTOTASK_USERNAME,
    AUTOTASK_SECRET: process.env.AUTOTASK_SECRET,
  };

  beforeEach(() => {
    process.env.AUTOTASK_API_INTEGRATION_CODE = 'test-code';
    process.env.AUTOTASK_USERNAME = 'test-user';
    process.env.AUTOTASK_SECRET = 'test-secret';
    jest.restoreAllMocks();
    jest.spyOn(db, 'queryOne').mockResolvedValue({ email: 'admin@cerebro.local' } as any);
  });

  afterAll(() => {
    process.env.AUTOTASK_API_INTEGRATION_CODE = originalEnv.AUTOTASK_API_INTEGRATION_CODE;
    process.env.AUTOTASK_USERNAME = originalEnv.AUTOTASK_USERNAME;
    process.env.AUTOTASK_SECRET = originalEnv.AUTOTASK_SECRET;
    jest.restoreAllMocks();
  });

  it('returns degraded 200 with empty data when provider is rate-limited', async () => {
    jest.spyOn(AutotaskClient.prototype, 'searchTickets').mockRejectedValue(
      new Error('Autotask API error: 429 - thread threshold of 3 threads has been exceeded')
    );
    jest.spyOn(AutotaskClient.prototype, 'getTicketQueues').mockResolvedValue([]);

    const app = express();
    app.use((req, _res, next) => {
      (req as any).auth = { sub: 'master-user', tid: '', role: 'owner', scope: 'full' };
      next();
    });
    app.use('/autotask', router);
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: String(err?.message || err) });
    });

    const response = await request(app).get('/autotask/sidebar-tickets?queueId=29683512&limit=75');

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.data).toEqual([]);
    expect(response.body?.degraded).toMatchObject({ provider: 'Autotask', reason: 'rate_limited' });
  });

  it('propagates non-provider errors to error middleware', async () => {
    jest.spyOn(AutotaskClient.prototype, 'searchTickets').mockRejectedValue(new Error('unexpected local failure'));
    jest.spyOn(AutotaskClient.prototype, 'getTicketQueues').mockResolvedValue([]);

    const app = express();
    app.use((req, _res, next) => {
      (req as any).auth = { sub: 'master-user', tid: '', role: 'owner', scope: 'full' };
      next();
    });
    app.use('/autotask', router);
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: String(err?.message || err) });
    });

    const response = await request(app).get('/autotask/sidebar-tickets?queueId=29683513&limit=75');

    expect(response.status).toBe(500);
    expect(String(response.body?.error || '')).toContain('unexpected local failure');
  });
});
