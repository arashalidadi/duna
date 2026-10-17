import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAuthenticated } from './check-authenticated.mjs';
const env = { API_PORT: '3101', PHASE12_LIVE_DB_ATTESTED: 'I_MATCHED_API_PID_AND_DB_SESSION',
  PHASE12_LIFECYCLE_TEST_APPROVED: 'I_AUTHORIZE_SYNTHETIC_LETTER',
  PHASE12_OWNER_TOKEN: 'test-owner-token', PHASE12_READER_TOKEN: 'test-reader-token' };
test('lifecycle probe requires independent live session proof, owner approval and distinct tokens', async () => {
  for (const key of ['PHASE12_LIVE_DB_ATTESTED', 'PHASE12_LIFECYCLE_TEST_APPROVED',
    'PHASE12_OWNER_TOKEN', 'PHASE12_READER_TOKEN']) {
    const without = { ...env }; delete without[key];
    await assert.rejects(checkAuthenticated(without, () => { throw new Error('unexpected fetch'); }),
      /required/);
  }
});
test('approved synthetic lifecycle checks search, permission denial, history and deletion refusal', async () => {
  let status = 'DRAFT';
  let archived = false;
  const events = [];
  const calls = [];
  const result = await checkAuthenticated(env, async (url, opts) => {
    const route = url.split('/api/v1/')[1];
    calls.push({ route, method: opts.method, body: opts.body });
    let code = 200, data = {};
    if (route === 'archive/policies') data = [];
    else if (route.startsWith('archive/letters?')) data = { data: archived ? [{ id: 'test-id' }] : [] };
    else if (route === 'letters' && opts.method === 'POST') {
      assert.match(JSON.parse(opts.body).subject, /^PHASE12-TEST-[A-F0-9]+$/);
      code = 201; data = { id: 'test-id', letterNumber: 'LET-2601-00001', status };
    } else if (route === 'letters/test-id/send') { status = 'SENT'; data = { status }; }
    else if (route === 'letters/test-id/archive') {
      status = 'ARCHIVED'; archived = true;
      events.push({ action: 'letter.archive', metadata: { reason: 'Reason' } }); data = { status };
    } else if (route === 'archive/letters/test-id/reopen') {
      code = opts.headers.Authorization.includes('test-reader-token') ? 403 :
        JSON.parse(opts.body).reason === 'short' ? 400 : 200;
      if (code === 200) {
        status = 'SENT'; events.push({ action: 'letter.reopen', metadata: { reason: 'Reason' } });
      }
      data = { status };
    } else if (route === 'archive/letters/test-id/history') data = { items: events };
    else if (route === 'letters/test-id' && opts.method === 'DELETE') code = 409;
    else throw new Error(`unhandled ${route}`);
    return { status: code, json: async () => ({ data }) };
  }, () => {});
  assert.equal(result, 'test-id');
  assert.equal(status, 'SENT');
  assert.ok(calls.some((c) => c.method === 'DELETE'));
  assert.equal(calls.some((c) => c.route.includes('reset')), false);
});
