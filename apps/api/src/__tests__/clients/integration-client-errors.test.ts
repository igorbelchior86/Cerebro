import { ITGlueClient } from '../../clients/itglue.js';
import { NinjaOneClient } from '../../clients/ninjaone.js';

function jsonResponse(status: number, payload: unknown, statusText?: string): Response {
  const init: ResponseInit = statusText
    ? { status, statusText, headers: { 'content-type': 'application/json' } }
    : { status, headers: { 'content-type': 'application/json' } };
  return new Response(JSON.stringify(payload), {
    ...init,
  });
}

describe('integration client error normalization', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('ITGlue maps 401 to auth error', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(401, { error: 'unauthorized' }, 'Unauthorized'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ITGlueClient({ apiKey: 'test-key', timeoutMs: 50 });

    await expect(client.getOrganizations()).rejects.toMatchObject({
      name: 'IntegrationClientError',
      integration: 'itglue',
      code: 'auth',
      retryable: false,
      statusCode: 401,
    });
  });

  test('ITGlue maps 429 to rate_limit error', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(429, { error: 'too many requests' }, 'Too Many Requests'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ITGlueClient({ apiKey: 'test-key', timeoutMs: 50 });

    await expect(client.getOrganizations()).rejects.toMatchObject({
      name: 'IntegrationClientError',
      integration: 'itglue',
      code: 'rate_limit',
      retryable: true,
      statusCode: 429,
    });
  });

  test('ITGlue maps abort/timeout to timeout error', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'AbortError'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ITGlueClient({ apiKey: 'test-key', timeoutMs: 50 });

    await expect(client.getOrganizations()).rejects.toMatchObject({
      name: 'IntegrationClientError',
      integration: 'itglue',
      code: 'timeout',
      retryable: true,
    });
  });

  test('ITGlue fallback path uses typed 404 status instead of message parsing', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }, 'Not Found'))
      .mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { pages: 1 } }, 'OK'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ITGlueClient({ apiKey: 'test-key', timeoutMs: 50 });

    await expect(client.getOrganizationDocuments('1')).resolves.toEqual([]);
  });

  test('NinjaOne maps 403 auth failure to auth error', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(403, { error: 'forbidden' }, 'Forbidden'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new NinjaOneClient({ clientId: 'id', clientSecret: 'secret', timeoutMs: 50 });

    await expect(client.listDevices()).rejects.toMatchObject({
      name: 'IntegrationClientError',
      integration: 'ninjaone',
      code: 'auth',
      retryable: false,
      statusCode: 403,
    });
  });

  test('NinjaOne maps 5xx API failure to provider_error with retryable=true', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'token', expires_in: 3600 }, 'OK'))
      .mockResolvedValueOnce(jsonResponse(503, { error: 'upstream unavailable' }, 'Service Unavailable'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new NinjaOneClient({ clientId: 'id', clientSecret: 'secret', timeoutMs: 50 });

    await expect(client.listDevices()).rejects.toMatchObject({
      name: 'IntegrationClientError',
      integration: 'ninjaone',
      code: 'provider_error',
      retryable: true,
      statusCode: 503,
    });
  });
});
