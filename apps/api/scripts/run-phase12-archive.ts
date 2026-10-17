import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configFactory } from '../src/config/config.factory';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditModule } from '../src/common/infrastructure/audit/audit.module';
import { ArchiveModule } from '../src/modules/archive/archive.module';
import { ArchiveService } from '../src/modules/archive/archive.service';

// Do not bootstrap AppModule: its notification worker starts a separate poller.
// This context only opens the dependencies needed for the archive job.
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [configFactory] }),
  PrismaModule, AuditModule, ArchiveModule] })
class ArchiveWorkerModule {}

/** Scheduled by an explicitly approved owner-host timer, never at API startup. */
async function main() {
  if (process.env.PHASE12_EXPECTED_DB !== 'duna_seed_test') throw new Error('Approved target assertion missing');
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '5432' || url.pathname !== '/duna_seed_test' ||
      decodeURIComponent(url.username) !== 'shipping_runtime_p11') {
    throw new Error('Runtime URL differs from approved role/host/port/database');
  }
  const app = await NestFactory.createApplicationContext(ArchiveWorkerModule, { logger: false });
  try {
    const db = app.get(PrismaService);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const [who] = await tx.$queryRaw<Array<{ database: string; role: string;
        server: string; port: number; version: number }>>`
        SELECT current_database()::text AS database, current_user::text AS role,
          inet_server_addr()::text AS server, inet_server_port()::int AS port,
          current_setting('server_version_num')::int AS version`;
      if (!who || who.database !== 'duna_seed_test' || who.role !== 'shipping_runtime_p11' ||
          !who.server || who.port !== 5432 ||
          who.version < 160000 || who.version >= 170000) {
        throw new Error('Live database identity differs; automatic archiving stopped');
      }
    });
    const archive = app.get(ArchiveService);
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await archive.runBatch(100);
      total += batch.archived;
      if (!batch.configured || batch.scanned < 100) break;
    }
    console.log(`Phase 12 automatic archive: ${total} letter(s); no deletion performed.`);
  } finally { await app.close(); }
}
main().catch(() => {
  console.error('Phase 12 archive job FAILED; check protected server logs, DB identity and audit sink.');
  process.exitCode = 1;
});
