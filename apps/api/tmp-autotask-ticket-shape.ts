import { queryOne } from './src/db/index';
import { AutotaskClient } from './src/clients/autotask';

(async () => {
  const row = await queryOne<{ credentials: any }>(
    "select credentials from integration_credentials where service='autotask' order by updated_at desc limit 1"
  );
  const c = row?.credentials;
  if (!c) throw new Error('No autotask creds');
  const client = new AutotaskClient({
    apiIntegrationCode: c.apiIntegrationCode,
    username: c.username,
    secret: c.secret,
    ...(c.zoneUrl ? { zoneUrl: c.zoneUrl } : {}),
  });
  const t = await client.getTicketByTicketNumber('T20260225.0013');
  console.log('KEYS', Object.keys(t).sort());
  console.log('COMPANY_FIELDS', Object.fromEntries(Object.entries(t).filter(([k]) => /company|account/i.test(k))));
})();
