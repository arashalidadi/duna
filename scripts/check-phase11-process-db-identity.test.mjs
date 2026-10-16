import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProcessDbEnvironment } from './check-phase11-process-db-identity.mjs';

const expected =
  'postgresql://shipping_runtime_p11:secret-sentinel@127.0.0.1:5432/duna_seed_test?schema=public';
const startup = (url) =>
  Buffer.from(`OTHER=irrelevant\0DATABASE_URL=${url}\0ACCESS_TOKEN=other-secret\0`);

test('process startup identity is checked without printing credentials or unrelated env', () => {
  const result = classifyProcessDbEnvironment(startup(expected));
  assert.match(result, /^EXPECTED STARTUP ENV/);
  assert.ok(!/secret-sentinel|ACCESS_TOKEN|other-secret|DATABASE_URL=/.test(result));
});

test('wrong role, database, host and schema fail closed with values suppressed', () => {
  for (const wrong of [
    expected.replace('shipping_runtime_p11', 'shipping'),
    expected.replace('duna_seed_test', 'duna_seed_test1'),
    expected.replace('127.0.0.1', 'localhost'),
    expected.replace('schema=public', 'schema=private'),
  ]) {
    const result = classifyProcessDbEnvironment(startup(wrong));
    assert.match(result, /^MISMATCH/);
    assert.ok(!/secret-sentinel|DATABASE_URL=|duna_seed_test1/.test(result));
  }
});

test('dotenv loaded after exec or duplicated startup setting is explicitly unproven', () => {
  assert.match(classifyProcessDbEnvironment(Buffer.from('OTHER=x\0')), /^UNPROVEN/);
  assert.match(
    classifyProcessDbEnvironment(
      Buffer.from(`DATABASE_URL=${expected}\0DATABASE_URL=${expected}\0`)
    ),
    /^UNPROVEN/
  );
  assert.match(classifyProcessDbEnvironment(startup('not a URL')), /^UNPROVEN/);
});
