import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types';

/**
 * Injects the authenticated principal (id + email + roles + permissions) into a
 * handler. The value is populated by JwtAuthGuard/PermissionsGuard. Never trust
 * a client-supplied user id — this value always derives from the verified token
 * and a fresh server-side lookup.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  }
);