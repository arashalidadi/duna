import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NumberingService } from '../src/common/infrastructure/numbering/numbering.service';
import {
  PERIODIC_DOCUMENT_FORMATS,
  PeriodicDocumentKey,
  nextSequenceAfter,
  periodicSequenceRequest,
  yymmFor,
} from '../src/common/infrastructure/numbering/document-number-formats';
import type { AllocateNumberRequest } from '../src/common/infrastructure/numbering/numbering-sequence.types';

/**
 * Phase 2 — shared document numbering (DEC-024…DEC-028).
 *
 * Covers, for every periodic document type in the catalogue:
 *  - format match (prefix, period, rendered number),
 *  - month/year rollover with a fixed clock (UTC and server-local clocks),
 *  - sequence continuity and concurrent allocation (no duplicate, no gap),
 *  - seeding from existing issued numbers, no counter reset, rollback on failure.
 *
 * Writes ONLY NumberingSequence rows whose name starts with `test-<random tag>-`;
 * they are removed in afterAll. Real document counters (e.g. `invoice-2610`) are never
 * touched. Like the other e2e suites it runs against the configured database, so do not
 * point it at production data.
 */

const KEYS = Object.keys(PERIODIC_DOCUMENT_FORMATS) as PeriodicDocumentKey[];
// The catalogue includes salary records as well as the original twelve families.
// Keep the required set explicit so removing (or silently adding) a family fails.
const REQUIRED_KEYS: PeriodicDocumentKey[] = [
  'INVOICE', 'PROFORMA', 'QUOTATION', 'GENERAL_JOURNAL',
  'VOUCHER_RECEIPT', 'VOUCHER_PAYMENT', 'CARGO', 'INSPECTION',
  'LOAD_LIST', 'ACTUAL_LOADING', 'DISCHARGE', 'BOOKING_REQUEST', 'SALARY_RECORD',
];
const OCT_NOON_UTC = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const NOV_NOON_UTC = new Date(Date.UTC(2026, 10, 15, 12, 0, 0));

describe('Document numbering (e2e)', () => {
  let app: INestApplication;
  let numbering: NumberingService;
  let prisma: PrismaService;
  const tag = Math.random().toString(36).slice(2, 8);
  const testName = (suffix: string) => `test-${tag}-${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    numbering = app.get(NumberingService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.numberingSequence.deleteMany({ where: { name: { startsWith: `test-${tag}-` } } });
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Catalogue: format match and rollover (no database writes)
  // ---------------------------------------------------------------------------

  it('catalogue: every periodic document type has a unique sequence family', () => {
    const families = KEYS.map((key) => PERIODIC_DOCUMENT_FORMATS[key].sequenceFamily);
    expect(new Set(families).size).toBe(KEYS.length);
    expect([...KEYS].sort()).toEqual([...REQUIRED_KEYS].sort());
  });

  it.each(KEYS)('%s: request uses the printed code, period YYYYMM and five-digit padding', (key) => {
    const spec = PERIODIC_DOCUMENT_FORMATS[key];
    const req = periodicSequenceRequest(key, OCT_NOON_UTC);
    expect(req.prefix).toMatch(new RegExp(`^${spec.code}-\\d{4}-$`));
    expect(req.prefix).toBe(`${spec.code}-${req.scopeValue}-`);
    expect(req.name).toBe(`${spec.sequenceFamily}-${req.scopeValue}`);
    expect(req.documentType).toBe(spec.documentType);
    expect(req.period).toBe('YYYYMM');
    expect(req.padding).toBe(5);
    expect(req.format).toBe('{prefix}{sequence}');
  });

  it.each(KEYS)('%s: rendered number matches CODE-YYMM-##### (format match)', (key) => {
    const spec = PERIODIC_DOCUMENT_FORMATS[key];
    const req = periodicSequenceRequest(key, OCT_NOON_UTC);
    const rendered = numbering.renderNumber({
      prefix: req.prefix,
      sequenceNumber: 1,
      padding: req.padding,
      format: req.format,
    });
    expect(rendered).toBe(`${spec.code}-2610-00001`);
    expect(numbering.renderNumber({ ...req, sequenceNumber: 12345 })).toMatch(
      new RegExp(`^${spec.code}-2610-\\d{5}$`),
    );
  });

  it.each(KEYS)('%s: month rollover with a fixed clock (utc and local clocks)', (key) => {
    const spec = PERIODIC_DOCUMENT_FORMATS[key];
    // Build the boundary instants on the clock the family uses, so the test does not depend on TZ.
    const lastOfOctober =
      spec.clock === 'utc'
        ? new Date(Date.UTC(2026, 9, 31, 23, 59, 59))
        : new Date(2026, 9, 31, 23, 59, 59);
    const firstOfNovember =
      spec.clock === 'utc' ? new Date(Date.UTC(2026, 10, 1, 0, 0, 0)) : new Date(2026, 10, 1, 0, 0, 0);
    expect(yymmFor(lastOfOctober, spec.clock)).toBe('2610');
    expect(yymmFor(firstOfNovember, spec.clock)).toBe('2611');
    expect(periodicSequenceRequest(key, firstOfNovember).name).toBe(`${spec.sequenceFamily}-2611`);
  });

  it('nextSequenceAfter: first number, continuation, and no padding cap', () => {
    expect(nextSequenceAfter('INV-2610-', null)).toBe(1);
    expect(nextSequenceAfter('INV-2610-', 'INV-2610-00041')).toBe(42);
    expect(nextSequenceAfter('INV-2610-', 'INV-2610-99999')).toBe(100000);
  });

  // ---------------------------------------------------------------------------
  // Allocator: continuity, concurrency, seeding, reactivation, rollback (database)
  // ---------------------------------------------------------------------------

  function requestFor(key: PeriodicDocumentKey, suffix: string, now = OCT_NOON_UTC): AllocateNumberRequest {
    const req = periodicSequenceRequest(key, now);
    return {
      ...req,
      // Test-only counter name; prefix, format and padding still come from the catalogue.
      name: testName(`${key.toLowerCase()}-${suffix}-${req.scopeValue}`),
    };
  }

  it.each(KEYS)('%s: sequence continuity from the first allocation', async (key) => {
    const req = requestFor(key, 'seq');
    const spec = PERIODIC_DOCUMENT_FORMATS[key];
    const got: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      got.push((await numbering.allocateNumber(req)).sequence);
    }
    expect(got).toEqual([1, 2, 3].map((n) => `${spec.code}-2610-${String(n).padStart(5, '0')}`));
  });

  it.each(KEYS)('%s: concurrent allocation gives distinct, contiguous numbers', async (key) => {
    const req = requestFor(key, 'conc');
    const results = await Promise.all(Array.from({ length: 10 }, () => numbering.allocateNumber(req)));
    const raw = results.map((r) => r.rawSequence).sort((a, b) => a - b);
    expect(raw).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(results.map((r) => r.sequence)).size).toBe(10);
  });

  it.each(KEYS)('%s: month rollover gives an independent counter for the new period', async (key) => {
    const oct = requestFor(key, 'roll', OCT_NOON_UTC);
    const nov = requestFor(key, 'roll', NOV_NOON_UTC);
    await numbering.allocateNumber(oct);
    await numbering.allocateNumber(oct);
    const first = await numbering.allocateNumber(nov);
    expect(first.rawSequence).toBe(1);
    expect(first.sequence.endsWith('-00001')).toBe(true);
    expect(first.sequence.includes('-2611-')).toBe(true);
  });

  it('seeds a new counter from existing issued numbers and never restarts at 1', async () => {
    const req = { ...requestFor('INVOICE', 'seed'), seedNextSequence: jest.fn(async () => 42) };
    const first = await numbering.allocateNumber(req);
    expect(first.rawSequence).toBe(42);
    expect(first.sequence).toBe('INV-2610-00042');
    // Existing row: seed is not consulted again.
    await numbering.allocateNumber(req);
    expect(req.seedNextSequence).toHaveBeenCalledTimes(1);
  });

  it('reactivating an inactive counter keeps its position (no reset)', async () => {
    const req = requestFor('CARGO', 'reactivate');
    await numbering.allocateNumber(req);
    await numbering.allocateNumber(req);
    await prisma.numberingSequence.update({
      where: { name: req.name },
      data: { isActive: false },
    });
    const next = await numbering.allocateNumber(req);
    expect(next.rawSequence).toBe(3);
    const row = await prisma.numberingSequence.findUniqueOrThrow({ where: { name: req.name } });
    expect(row.isActive).toBe(true);
    expect(row.nextSequence).toBe(4);
  });

  it('a rolled-back transaction does not consume a number', async () => {
    const req = requestFor('DISCHARGE', 'rollback');
    await numbering.allocateNumber(req);
    await expect(
      prisma.$transaction(async (tx) => {
        await numbering.allocateNumber({ ...req, tx });
        throw new Error('insert failed');
      }),
    ).rejects.toThrow('insert failed');
    const next = await numbering.allocateNumber(req);
    expect(next.rawSequence).toBe(2);
  });
});
