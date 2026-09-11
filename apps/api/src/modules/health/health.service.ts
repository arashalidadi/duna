import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_NAME, APP_VERSION } from '@shipping/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async check() {
    let databaseUp = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseUp = true;
    } catch {
      databaseUp = false;
    }

    return {
      status: databaseUp ? 'ok' : 'error',
      app: {
        name: APP_NAME,
        version: APP_VERSION,
        environment: this.configService.get<string>('config.app.environment'),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      database: {
        status: databaseUp ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
