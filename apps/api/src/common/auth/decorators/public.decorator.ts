import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export interface IsPublicMetadata {
  public: boolean;
}

/**
 * Marks a controller handler (or controller) as publicly accessible,
 * bypassing the global authentication guard.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, { public: true } satisfies IsPublicMetadata);