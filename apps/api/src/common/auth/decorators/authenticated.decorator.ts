import { SetMetadata } from '@nestjs/common';

/**
 * Explicit policy for JWT-only self-service routes. Unlike @Public(), this does
 * NOT bypass JwtAuthGuard; it merely explains why no role permission is needed.
 * Do not use for record or configuration access (those require a permission).
 */
export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';
export const Authenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
