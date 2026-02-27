import assert from 'node:assert/strict';
import {
  HttpError,
  mapCommandStatusToUxState,
  mapHttpErrorToFrontendState,
} from '../src/lib/p0-ui-client';

function run() {
  assert.equal(mapCommandStatusToUxState('accepted'), 'pending');
  assert.equal(mapCommandStatusToUxState('processing'), 'pending');
  assert.equal(mapCommandStatusToUxState('retry_pending'), 'retrying');
  assert.equal(mapCommandStatusToUxState('failed'), 'failed');
  assert.equal(mapCommandStatusToUxState('dlq'), 'failed');
  assert.equal(mapCommandStatusToUxState('completed'), 'succeeded');

  const e401 = mapHttpErrorToFrontendState(new HttpError(401, 'Tenant context required', { error: 'Tenant context required' }));
  assert.equal(e401.code, 'auth');
  assert.equal(e401.retryable, false);

  const e403 = mapHttpErrorToFrontendState(new HttpError(403, 'forbidden', { error: 'forbidden' }));
  assert.equal(e403.code, 'forbidden');
  assert.equal(e403.retryable, false);

  const e429 = mapHttpErrorToFrontendState(new HttpError(429, 'RATE_LIMITED', { error: 'RATE_LIMITED' }));
  assert.equal(e429.code, 'rate_limit');
  assert.equal(e429.retryable, true);

  const e500 = mapHttpErrorToFrontendState(new HttpError(503, 'backend unavailable', { error: 'backend unavailable' }));
  assert.equal(e500.code, 'server');
  assert.equal(e500.retryable, true);

  const network = mapHttpErrorToFrontendState(new Error('socket hang up'));
  assert.equal(network.code, 'network');
  assert.equal(network.retryable, true);

  console.log('workflow-ux-state-smoke: OK');
}

run();
