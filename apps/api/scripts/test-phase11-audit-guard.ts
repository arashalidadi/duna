import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { REQUIRED_PERMISSIONS_KEY } from '../src/common/auth/decorators/require-permissions.decorator';

function auditContext(
  permissions: string[],
  primaryAdmin: boolean,
  exportRoute: boolean
): ExecutionContext {
  const handler = () => {};
  Reflect.defineMetadata(
    REQUIRED_PERMISSIONS_KEY,
    { match: 'AND', permissions: exportRoute ? ['audit:read', 'audit:export'] : ['audit:read'] },
    handler
  );
  return {
    getHandler: () => handler,
    getClass: () => class AuditController {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: 'test-actor',
          permissions,
          isPrimaryAdmin: primaryAdmin,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

const guard = new PermissionsGuard(new Reflector());

test('ordinary audit reader can browse but export is 403, not 404', () => {
  assert.equal(guard.canActivate(auditContext(['audit:read'], false, false)), true);
  assert.throws(
    () => guard.canActivate(auditContext(['audit:read'], false, true)),
    (e: unknown) => e instanceof ForbiddenException && e.getStatus() === 403
  );
});

test('export requires both permissions; primary owner has implicit authority', () => {
  assert.throws(
    () => guard.canActivate(auditContext(['audit:export'], false, true)),
    (e: unknown) => e instanceof ForbiddenException && e.getStatus() === 403
  );
  assert.throws(
    () => guard.canActivate(auditContext([], false, false)),
    (e: unknown) => e instanceof ForbiddenException && e.getStatus() === 403
  );
  assert.equal(guard.canActivate(auditContext(['audit:read', 'audit:export'], false, true)), true);
  assert.equal(guard.canActivate(auditContext([], true, true)), true);
});
