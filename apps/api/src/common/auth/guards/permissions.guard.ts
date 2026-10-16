import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated.decorator';
import { IS_PUBLIC_KEY, IsPublicMetadata } from '../decorators/public.decorator';
import { AuthenticatedUser, RequiredPermissions } from '../types';

/**
 * Authorization guard. Runs after JwtAuthGuard and evaluates the handler's
 * @RequirePermissions() metadata against the principal's server-loaded effective
 * permissions. Multiple permissions are AND-ed unless match: 'OR' is set.
 *
 * Authorization is fully server-side; the frontend cannot bypass this by hiding
 * UI or fabricating request data (the principal always derives from the token).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<IsPublicMetadata>(IS_PUBLIC_KEY, targets)?.public) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<RequiredPermissions>(
      REQUIRED_PERMISSIONS_KEY, targets
    );
    // Default deny: a newly added route cannot silently inherit JWT-only access.
    // @Authenticated is reserved for deliberately permissionless self-service
    // handlers; JwtAuthGuard still loads the principal before this guard runs.
    if (!required?.permissions.length &&
      this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, targets) !== true) {
      throw new ForbiddenException('Permission policy missing');
    }

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Identified user not found');
    }
    if (!required?.permissions.length) return true;

    // DEC-116 — the primary administrator (the company owner) holds full system
    // authority. It is IMPLICIT: deliberately not derived from roles or permission
    // rows, so it cannot be lost through permission misconfiguration or by a
    // mistaken permission revocation.
    //
    // This is not a hidden backdoor: the flag is a single, auditable database
    // column constrained to at most one row, and every action is still written to
    // the audit log. Audit RECORDS authority here — it does not gate it, and it
    // creates no approval step above the owner.
    if (user.isPrimaryAdmin === true) {
      return true;
    }

    const has = user.permissions ?? [];
    const ok =
      required.match === 'OR'
        ? required.permissions.some((p) => has.includes(p))
        : required.permissions.every((p) => has.includes(p));

    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}