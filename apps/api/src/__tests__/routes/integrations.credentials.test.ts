import express from 'express';
import type { Server } from 'http';
import request from 'supertest';
import router from '../../services/application/route-handlers/integrations-route-handlers.js';
import * as db from '../../db/index.js';

describe('PUT /integrations/credentials/:service', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('clears timeout timers when a wrapped integration check resolves quickly', async () => {
    jest.useFakeTimers();

    try {
      const { __testables } = await import('../../services/application/route-handlers/integrations-route-handlers.js');
      const promise = __testables.withTimeout(Promise.resolve('ok'), 8_000);

      await expect(promise).resolves.toBe('ok');
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('preserves stored sensitive Autotask fields when masked placeholders are submitted', async () => {
    jest.spyOn(db, 'queryOne').mockResolvedValue({
      credentials: {
        apiIntegrationCode: 'real-code',
        username: 'old-user@company.com',
        secret: 'real-secret',
      },
    } as never);
    const querySpy = jest.spyOn(db, 'query').mockResolvedValue([] as never);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.auth = {
        sub: 'user-1',
        tid: 'tenant-1',
        role: 'admin',
        scope: 'full',
        iat: 0,
        exp: 0,
      };
      next();
    });
    app.use('/integrations', router);

    const server: Server = app.listen();

    try {
      const response = await request(server)
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
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
