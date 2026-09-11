import { SetMetadata } from '@nestjs/common';
import { PermissionMatch, RequiredPermissions } from '../types';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permissions required to access a handler. Defaults to AND
 * (all listed permissions required). Use match: 'OR' for "any of".
 *
 * Example: @RequirePermissions('users:view', 'roles:view')
 *          @RequirePermissions(['users:view', 'users:create'], { match: 'OR' })
 */
export const RequirePermissions = (
  permissions: string | string[],
  options?: { match?: PermissionMatch }
) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions: Array.isArray(permissions) ? permissions : [permissions],
    match: options?.match ?? 'AND',
  } satisfies RequiredPermissions);