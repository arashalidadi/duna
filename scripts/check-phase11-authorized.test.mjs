import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAuthorizedAudit } from './check-phase11-authorized.mjs';

const header =
  'id,timestamp,actorId,actorEmail,action,entityType,entityId,beforeData,afterData,metadata,ipAddress,userAgent';
const json = (data, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function fixture({ ordinaryStatus = 403, ownerIsPrimary = true, recordEvent = true } = {}) {
  let exports = 0;
  let event;
  const fetcher = async (rawUrl, options) => {
    const url = new URL(rawUrl);
    assert.match(options.headers.Authorization, /^Bearer /);
    const token = options.headers.Authorization.slice('Bearer '.length);
    const owner = token === 'private-owner-token';
    assert.ok(owner || token === 'private-ordinary-token');
    assert.ok(!url.toString().includes('token'));
    if (url.pathname.endsWith('/auth/me'))
      return json({
        user: { id: owner ? 'owner-id' : 'ordinary-id', isPrimaryAdmin: owner && ownerIsPrimary },
        permissions: owner ? [] : ['audit:read'],
      });
    if (url.pathname.endsWith('/audit/export')) {
      if (!owner) return json(null, ordinaryStatus);
      exports++;
      if (recordEvent)
        event = {
          id: 'new-event',
          actorId: 'owner-id',
          action: 'audit.export',
          entityType: 'AuditLog',
          entityId: 'export',
          metadata: {
            from: url.searchParams.get('from'),
            to: url.searchParams.get('to'),
            offset: 0,
            preparedRows: 0,
            hasMore: false,
          },
        };
      return new Response(`${header}\r\n`, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="audit-export.csv"',
          'cache-control': 'no-store',
          'x-audit-export-has-more': 'false',
        },
      });
    }
    if (url.pathname.endsWith('/audit') && owner) {
      assert.equal(url.searchParams.get('action'), 'audit.export');
      return json({ total: event ? 1 : 0, items: event ? [event] : [] });
    }
    if (url.pathname.endsWith('/audit')) return json({ total: 0, items: [] });
    throw new Error('Unexpected mock route');
  };
  return { fetcher, exportCount: () => exports };
}
const accounts = {
  ordinaryToken: 'private-ordinary-token',
  ownerToken: 'private-owner-token',
  port: 3101,
};

test('approved ordinary 403, owner CSV 200, and exactly one matching event; no sensitive output', async () => {
  const mock = fixture();
  const lines = [];
  const result = await checkAuthorizedAudit({
    ...accounts,
    fetcher: mock.fetcher,
    print: (line) => lines.push(line),
  });
  assert.deepEqual(result, {
    ordinaryBrowse: 200,
    ordinaryExport: 403,
    ownerExport: 200,
    auditEvent: true,
  });
  assert.equal(mock.exportCount(), 1);
  assert.match(lines.join('\n'), /audit\.export event: exactly \+1/);
  assert.doesNotMatch(lines.join('\n'), /private-|owner-id|ordinary-id|new-event|beforeData/);
});

test('ordinary 404 and unapproved identity abort BEFORE any owner export', async () => {
  for (const mock of [fixture({ ordinaryStatus: 404 }), fixture({ ownerIsPrimary: false })]) {
    await assert.rejects(
      checkAuthorizedAudit({ ...accounts, fetcher: mock.fetcher, print: () => {} }),
      /STOP before owner export|Account identity/
    );
    assert.equal(mock.exportCount(), 0);
  }
});

test('a 200 without a provable event fails, without retrying or printing CSV', async () => {
  const mock = fixture({ recordEvent: false });
  await assert.rejects(
    checkAuthorizedAudit({ ...accounts, fetcher: mock.fetcher, print: () => {} }),
    /Audit-event count/
  );
  assert.equal(mock.exportCount(), 1);
});
