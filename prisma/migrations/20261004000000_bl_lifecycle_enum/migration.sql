-- P4-U4 — ADR-045 decision 2 + ADR-046 ruling 1 (four-state lifecycle):
-- DRAFT -> FINAL -> APPROVED -> RELEASED (+ CANCELLED), ISSUED retained until an
-- approved later cleanup removes it. Additive only, no values removed.
--
-- Split from the backfill on purpose: PostgreSQL forbids USING a value added in the
-- same transaction (ALTER TYPE ... ADD VALUE pitfall), and Prisma applies each
-- migration file in its own transaction — so the enum values commit here and the
-- ISSUED -> APPROVED UPDATE runs in the next file/transaction.
ALTER TYPE "BlStatus" ADD VALUE IF NOT EXISTS 'FINAL';
ALTER TYPE "BlStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "BlStatus" ADD VALUE IF NOT EXISTS 'RELEASED';
