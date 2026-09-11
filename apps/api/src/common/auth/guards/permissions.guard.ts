import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
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
    const required = this.reflector.getAllAndOverride<RequiredPermissions>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required || required.permissions.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Identified user not found');
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