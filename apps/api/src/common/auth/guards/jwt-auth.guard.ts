import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../../../modules/auth/auth.service';
import { IS_PUBLIC_KEY, IsPublicMetadata } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types';

export interface JwtPayload {
  sub: string;
  email?: string;
}

/**
 * Global default guard: every handler is considered authenticated unless marked
 * @Public(). Validates the JWT access token signature and expiration, then loads
 * the user's *current* state (active? locked?) and effective permissions from
 * the database so authorization never trusts a stale token payload. Deactivated
 * or locked users lose access immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<IsPublicMetadata>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic?.public) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('config.auth.jwtSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt || !user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is locked');
    }

    const principal: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      roles: [], // hydrated below
      permissions: [],
    };
    const resolved = await this.authService.resolvePermissions(user.id);
    principal.roles = resolved.roles.map((r) => ({ id: r.id, code: r.code }));
    principal.permissions = resolved.permissions;

    request.user = principal;
    return true;
  }

  private extractToken(request: {
    headers?: Record<string, string | string[] | undefined>;
  }): string | null {
    const header =
      typeof request.headers?.authorization === 'string'
        ? request.headers.authorization
        : undefined;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    return token;
  }
}