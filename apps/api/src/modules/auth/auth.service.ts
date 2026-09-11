import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '@shipping/shared';
import { LoginDto } from './dto/auth.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_HASH_ROUNDS = 10;

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  /** DB id of the newly created refresh-token record (for rotation linking). */
  refreshId: string;
}

export interface ResolvedPrincipal {
  permissions: string[];
  roles: { id: string; code: string; name?: string }[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Effective permissions + roles from all assigned (non-deleted) roles.
   * Always computed server-side from the database — never trusted from tokens
   * or clients. Used by the authorization guard and /auth/me.
   */
  async resolvePermissions(userId: string): Promise<ResolvedPrincipal> {
    const roles = await this.prisma.role.findMany({
      where: { users: { some: { userId } }, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
    });

    const permissions = new Set<string>();
    for (const role of roles) {
      for (const rp of role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    return {
      permissions: [...permissions],
      roles: roles.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    };
  }

  /** Safe current-user payload (no password material) for /auth/me. */
  async buildCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: { select: { id: true, code: true, name: true } } } } },
    });
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      roles: user.roles.map((r) => r.role),
    };
  }

  async login(
    dto: LoginDto
  ): Promise<{ user: CurrentUser; permissions: string[] } & Omit<AuthTokenPair, 'refreshId'>> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Generic message for both unknown user and wrong password (anti-enumeration).
    if (!user || user.deletedAt) {
      await this.simulateHashComparison();
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      await this.recordFailedAttempt(user.id);
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const currentUser = await this.buildCurrentUser(user.id);
    const principal = await this.resolvePermissions(user.id);
    const pair = await this.issueTokenPair(user.id);

    return {
      user: currentUser,
      permissions: principal.permissions,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  /**
   * Rotated refresh via an opaque, DB-backed refresh token.
   *   - token is 48 random bytes; only its bcrypt hash is stored.
   *   - on use the old record is revoked & linked to its replacement (rotation).
   *   - presenting an already-replaced token => reuse detected => whole family revoked.
   */
  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    const record = await this.findByIdHash(refreshToken);
    if (!record || record.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.expiresAt < new Date()) {
      await this.revokeById(record.id);
      throw new UnauthorizedException('Refresh token has expired');
    }
    if (record.replacedByTokenId) {
      await this.revokeTokenFamily(record.id);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new ForbiddenException('Account is disabled');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is locked');
    }

    const pair = await this.issueTokenPair(user.id);

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedByTokenId: pair.refreshId },
    });

    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    const record = await this.findByIdHash(refreshToken);
    if (record) {
      await this.revokeById(record.id);
    }
    // Idempotent: unknown token => nothing to revoke.
  }

  private async issueTokenPair(userId: string): Promise<AuthTokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, typ: 'access' },
      {
        secret: this.configService.get<string>('config.auth.jwtSecret'),
        expiresIn: this.configService.get<string>('config.auth.jwtExpiresIn'),
      }
    );
    const { raw: refreshToken, refreshId } = await this.createRefreshTokenRecord(userId);
    return { accessToken, refreshToken, refreshId };
  }

  private async createRefreshTokenRecord(userId: string): Promise<{ raw: string; refreshId: string }> {
    const raw = randomBytes(48).toString('hex');
    const tokenHash = await bcrypt.hash(raw, REFRESH_HASH_ROUNDS);
    const lookupKey = this.sha256(raw);
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        lookupKey,
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });
    return { raw, refreshId: record.id };
  }

  /**
   * Locate a refresh token by its deterministic SHA-256 lookup key (O(1)
   * indexed lookup), then confirm with a bcrypt comparison against the stored
   * hash. The raw token is never stored; the lookup key is not reversible.
   */
  private async findByIdHash(raw: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedByTokenId: string | null;
  } | null> {
    const candidate = await this.prisma.refreshToken.findUnique({
      where: { lookupKey: this.sha256(raw) },
    });
    if (!candidate) return null;
    if (!(await bcrypt.compare(raw, candidate.tokenHash))) return null;
    return {
      id: candidate.id,
      userId: candidate.userId,
      expiresAt: candidate.expiresAt,
      revokedAt: candidate.revokedAt,
      replacedByTokenId: candidate.replacedByTokenId,
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeTokenFamily(startId: string): Promise<void> {
    const toRevoke = new Set<string>([startId]);
    let current: string | null | undefined = startId;
    let guard = 0;
    while (current && guard < 100) {
      guard++;
      const record: { id: string; replacedByTokenId: string | null } | null =
        await this.prisma.refreshToken.findUnique({ where: { id: current } });
      if (!record) break;
      toRevoke.add(record.id);
      current = record.replacedByTokenId;
    }
    for (const id of toRevoke) {
      await this.prisma.refreshToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const attempts = user.failedLoginAttempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: attempts },
      });
    }
  }

  private async simulateHashComparison(): Promise<void> {
    await bcrypt.compare(
      'invalid-password-simulated',
      '$2b$12$C6UzMDM5pRZgqY0W8h3z8eInvalidHashPlaceholderXX'
    );
  }

  private refreshTtlMs(): number {
    const expiresIn = this.configService.get<string>('config.auth.jwtRefreshExpiresIn') ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    switch (match[2]) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}