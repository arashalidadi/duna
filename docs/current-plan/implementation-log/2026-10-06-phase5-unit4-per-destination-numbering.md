# P5-U4 — per-destination numbering (`MAN-{DEST}-{yymm}-#####`): COMPLETE (2026-10-06)

**Unit**: `phase5-unit4-per-destination-numbering`
**Authority**: ADR-047 decision 7 (`docs/decisions.md:1070-1077`) · roadmap §3 Phase 5 Tests 4 /
Acceptance 3 (`docs/current-plan/09-final-implementation-roadmap.md`) · ledger
`docs/current-plan/11-implementation-state.md`
**Scope**: replace the local read-then-write manifest-number generator with the transactional
per-destination `NumberingService` contract (the U3/bill pattern, verbatim). NO UI
(apps/web byte-identical) · NO party/summary work (U2+U3 shipped it) · NO charges (ADR-047 d9) ·
NO drops of any kind · NO legacy number rewrite · `docs/decisions.md` untouched.
**HEAD**: `f98c264` (U3 + decision-docs) + this unit's changes.

---

## 1. Generator swap

**Before** — `manifest.service.ts`, private `generateReference()` (HEAD lines ~947-968): the
race-prone read-then-write class, identical in shape to what U3 already deleted off bills:

```ts
/** Stable, ordered manifest number: MAN-YYMM-##### (mirrors AL/LL/VOY/INS/CRG). */
private async generateReference(): Promise<string> {
  const now = new Date();
  const yymm = ...;
  const prefix = `MAN-${yymm}-`;
  const latest = await this.prisma.manifest.findFirst({
    where: { manifestNumber: { startsWith: prefix } },
    orderBy: { manifestNumber: 'desc' },
    select: { manifestNumber: true },
  });
  const lastSeq = latest ? Number(latest.manifestNumber.slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}
```

Two independent defects: (a) `findFirst` + `orderBy desc` on a *string* prefix scan is not a
lock — two concurrent creates read the same max and emit the same number, losing the race to the
`manifestNumber @unique` constraint (409 to the caller); (b) `Number(...)` on a malformed
suffix silently yields `NaN → Number.isFinite false → 1`, i.e. a *reset*, not a crash.

**After** — `allocateManifestNumber(destinationPortId)` (now at `manifest.service.ts:1019`),
deleting `generateReference` entirely and injecting `NumberingService` into the `ManifestService`
constructor (line 182, same as `bill.service`):

```ts
private async allocateManifestNumber(destinationPortId: string): Promise<string> {
  if (!destinationPortId) throw new BadRequestException(
    'destinationPortId is required to number a Manifest per destination (ADR-047 decision 7)');
  const port = await this.prisma.port.findUnique({
    where: { id: destinationPortId }, select: { code: true, abbreviation: true } });
  if (!port) throw new BadRequestException(`Unknown destination port: ${destinationPortId}`);
  const destinationSegment = port.abbreviation || port.code;
  const now = new Date();
  const yymm = `${String(now.getUTCFullYear() % 100).padStart(2,'0')}${String(now.getUTCMonth()+1).padStart(2,'0')}`;
  const allocated = await this.numbering.allocateNumber({
    name: `manifest-${destinationPortId}-${yymm}`,
    documentType: 'MANIFEST',
    scopeType: 'DESTINATION',
    scopeValue: destinationPortId,
    prefix: `MAN-${destinationSegment}-${yymm}-`,
    padding: 5,
    format: '{prefix}{sequence}',
    period: 'YYYYMM',
  });
  return allocated.sequence;
}
```

### `NumberingService` arguments, verbatim (ADR-047 d7)

| arg | value | source |
|---|---|---|
| `name` | `manifest-{destinationPortId}-{yymm}` | d7 "`manifest-{destPortId}-{yymm}`" |
| `documentType` | `'MANIFEST'` | U4 brief |
| `scopeType` | `'DESTINATION'` | d7 |
| `scopeValue` | `voyage.destinationPortId` | d7 |
| `prefix` | `MAN-{DEST}-{yymm}-` | d7 |
| `padding` | `5` | d7 |
| `format` | `'{prefix}{sequence}'` | bill.service:1649 (U3 pattern verbatim) |
| `period` | `'YYYYMM'` | d7 |

**`{DEST}` = `Port.abbreviation ?? code`** — same resolution rule as bills
(`bill.service.ts:1637`), read from the port row inside `allocateManifestNumber`, 400 if the
port is unknown (defensive; `voyage.destinationPortId` is NOT NULL so this is unreachable with
legal data — same defensive note bills carry). The destination segment is what keeps the global
`manifestNumber @unique` intact: legacy `MAN-2609-00001` and new `MAN-MFP2-2610-00001` can never
collide, which is the exact collision-proofing U3 proved on bills.

Sequence rows are **created lazily by `allocateNumber`** (upsert under `SELECT ... FOR UPDATE`,
ADR-008) — no pre-seeded rows, no invented sequence id, the sequence `name` is the key.

### Both call-sites

| path | line | shape |
|---|---|---|
| consolidation (`billIds`) | `manifest.service.ts:327` | allocation **outside** the `$transaction`, number passed into `tx.manifest.create` — see §4 |
| legacy (no `billIds`) | `manifest.service.ts:487` | allocation **inside** the existing `MAX_MANIFEST_ATTEMPTS = 10` bounded-retry loop, one number per attempt |

Both paths issue the **same** new format — one number shape per document type, no forked legacy
format on the create path (U4 brief: "Legacy path uses the SAME new numbering"). `NumberingModule`
is `@Global()`, so no `manifest.module.ts` change was needed (verified: neither `manifest.module`
nor `bill.module` declares `NumberingService`).

---

## 2. Legacy data — the 4 live manifests are byte-identical

No `UPDATE` touches `manifestNumber`, no backfill, no renumbering: the swap only changes what the
*next* create emits. Verified live immediately before commit:

```
manifests 4   MAN-2609-00001, MAN-2609-00002, MAN-2609-00003, MAN-2609-00004
MANIFEST NumberingSequence rows: 0
```

The legacy `MAN-YYMM-#####` shape is simply no longer issued for new rows; it coexists under
`manifestNumber @unique` (§1). Sequence rows may grow only from `allocateNumber` during tests,
swept in `afterAll` — see §5.

---

## 3. Tests — 6 new, 3 updated (roadmap Test 4 / Acceptance 3)

**New (6), all in `manifest.e2e-spec.ts`:**

1. `numbering: legacy path issues MAN-{DEST}-YYMM-##### using the port abbreviation` — port
   created *with* `abbreviation: MAB…`, asserts `^MAN-MAB<…>-\d{4}-\d{5}$`.
2. `numbering: port without abbreviation falls back to code for {DEST}` — fixture `destPortId`
   has `abbreviation: null` (asserted), number starts `MAN-${code}-`.
3. `numbering: per-destination independence — two different destinations each start at 00001;
   same destination increments` — **the core Test 4 claim**: destC → `…-00001`, destD →
   `…-00001` (independent counters), destC again → `…-00002`, and `numC1 !== numD1`.
4. `numbering: the NumberingSequence row embeds name/period/scope (month-reset pinned without
   time travel)` — queries the rows by explicit name and asserts `documentType='MANIFEST'`,
   `scopeType='DESTINATION'`, `period='YYYYMM'`, name ends `-<yymm>` and *contains* its own
   `scopeValue`. A second month would reset to `00001` because the month is part of the key —
   asserted structurally instead of by time travel, per the brief.
5. `numbering: consolidation retries a manifestNumber collision with a fresh number` — §4.
6. `numbering: an abandoned allocation leaves a gap, never a reuse` — §4.

**Updated assertions (3) — the expected test churn:**

| # | line | before | after |
|---|---|---|---|
| 1 | `manifest.e2e-spec.ts:459` (test title) | `MAN-YYMM-##### number` | `MAN-{DEST}-YYMM-##### number` |
| 2 | `manifest.e2e-spec.ts:468` | `toMatch(/^MAN-\d{4}-\d{5}$/)` | `toMatch(/^MAN-.+-\d{4}-\d{5}$/)` |
| 3 | `manifest.e2e-spec.ts:1058` | `toMatch(/^MAN-\d{4}-\d{5}$/)` | `toMatch(/^MAN-.+-\d{4}-\d{5}$/)` |

(`{DEST}` deliberately matches `.+`: fixture port codes themselves contain a dash —
`MFP2-<tag>` — so a `[A-Z0-9]+` class would be wrong and did fail on the first run.)

No other spec asserts a manifest-number shape: `bill.e2e-spec.ts:571` uses `/^MAN-/`,
`party-cutover` only round-trips the number through search — 0 churn outside this file.

**Test delta: 397 → 403** (+6). Manifest suite 26 → 32. Full battery **403/403, 22/22**.

---

## 4. Nested transactions — the allocation cannot sit inside the consolidation transaction

**Finding (recorded as required):** `NumberingService.allocateNumber` opens **its own**
`$transaction` (`numbering.service.ts:40`) to take `SELECT ... FOR UPDATE` on the sequence row.
It therefore **cannot run inside** the outer consolidation `$transaction` — Prisma's interactive
transaction would either reject the nested client or, worse, the row lock would be taken and
released without the outer transaction's guarantee (the lock must outlive the create that
consumes the number). Consequently the allocation was moved **outside** the outer transaction in
the consolidation path — matching what `bill.service.ts:382` and `voyages.service` already do.

**Correctness property (the same trade-off bills accepted in P4-U3):** a number allocated and
then abandoned when a later step inside the transaction fails (validation, claim guard, unique
collision) leaves a **harmless gap — never a reuse**. The counter was already committed by
`allocateNumber`'s own transaction, so it only moves forward; the manifest create rolls back, the
number does not. A gap in a document sequence is invisible to users; a *reused* number would
break `@unique` and, worse, could silently alias two documents.

**Retry (added in this unit — the outside-allocation path did NOT previously retry):** the
consolidation path had *no* retry loop around its create — a `manifestNumber` collision would
have surfaced as a raw 409 with no second attempt. It now carries the **bill-pattern bounded
retry** (`MAX_MANIFEST_ATTEMPTS = 10`, allocation inside the loop, `manifest.service.ts:325-477`):

```ts
const MAX_MANIFEST_ATTEMPTS = 10;
for (let attempt = 1; ; attempt += 1) {
  const manifestNumber = await this.allocateManifestNumber(voyage.destinationPortId);
  try {
    return await this.prisma.$transaction(async (tx) => { /* validate + create */ });
  } catch (e) {
    if (P2002 && attempt < MAX && target.includes('manifestNumber')) continue; // fresh number
    if (P2002 || P2018) throw new ConflictException('Could not create Manifest: duplicate reference');
    if (P2003) throw new BadRequestException('Invalid reference: party ids must reference existing master records');
    throw e;
  }
}
```

Each retry allocates a *fresh* number, so a retry also costs only a gap (never a reuse). The
legacy path already had this exact loop from before U4 (allocation was already inside it), so it
needed only the generator swap.

**Verified by test, both halves:**

- **Retry** (test 5): a blocker manifest is seeded holding the very number the lazy sequence will
  hand out (`MAN-{code}-{yymm}-00001`), then a consolidation create runs. First attempt collides
  inside the transaction → the loop re-allocates → response is asserted to be exactly
  `…-00002`. Without the loop this test 409s.
- **Gap** (test 6): a consolidation against a DRAFT B/L fails *after* the number was allocated
  (400 "…APPROVED"), the manifest create rolls back; the next successful create on the same
  destination is asserted to be `…-00002`, i.e. `00001` was consumed and **skipped**, never
  reissued.

Error mapping in the new catch is copied from the legacy path (and matches bills): `P2002`
→ 409 `duplicate reference`, `P2003` → 400 `Invalid reference`, everything else rethrown
(the global `http-exception.filter.ts` still maps any P-code that escapes).

---

## 5. Fixture sweep — the 16-orphan incident (honest account)

**The incident.** The U4 brief's no-accumulation requirement was **unmet when the unit was
picked up**: **16 orphan `MANIFEST` `NumberingSequence` rows** were live in the database. I
re-queried them myself before touching anything: all 16 had `scopeValue` pointing at an already
deleted fixture port, **0 rows with a live port scope**, so deleting them by explicit name filter
could not touch production data. Deleted by the ids observed in that query (never blind-pasted
from the brief — the brief's own list was explicitly illustrative and, when I compared it, did
not match the live ids exactly):

```
deleted: 16   (documentType MANIFEST, name IN [...observed ids...])
MANIFEST rows after: 0
```

**Root cause — the sweep missed 19 of the 22 sites.** My first cut instrumented only the 3
numbering-test call sites with `trackManifestSeq(...)` and swept `name IN createdManifestSeqNames`
in `afterAll`. The other 19 `POST /manifests` sites in `manifest.e2e-spec.ts` (fixtures, lifecycle
tests, U3 tests) allocated sequence rows on the same fixture ports and pushed **no** name, so the
name-filter sweep silently skipped them — the same class of miss as the U2/U3 `afterAll` swallow:
a filter that looks explicit but is fed an incomplete list.

**Fix — one sweep that covers all 22 sites by construction** (`manifest.e2e-spec.ts:325-343`):
`afterAll` now deletes by **exact scope ids**, not by a hand-maintained name list:

```ts
await prisma.numberingSequence.deleteMany({
  where: { documentType: 'MANIFEST',
           scopeValue: { in: createdPorts.map((p) => p.id) } },
});
await prisma.numberingSequence.deleteMany({
  where: { name: { in: createdManifestSeqNames } },   // kept: per-name proof
});
```

This works without instrumenting every site because **every one of the 22 sites numbers off its
voyage's destination port, and every destination port this suite uses is one of its own fixture
ports** (`destPortId`, `destWithAbbr`, `destC`, `destD`, plus the §4 retry/gap ports) — all pushed
to `createdPorts` at creation. `in: []` matches nothing, so an empty list can never collapse into
a wildcard (the U2 incident pattern).

**Proven — run, then query, assert 0:**

```
$ pnpm --filter api test
Test Suites: 22 passed, 22 total
Tests:       403 passed, 403 total
$ node qa_seq.js   # counts MANIFEST rows whose scopeValue is NOT a live port
rows=0 orphan=0
```

**Scope note (test-file work only).** The first full-suite query returned **3** remaining orphans
even after manifest's own sweep was correct — attribution by running each suite solo showed they
came from `bill.e2e-spec.ts`, `delivery-release.e2e-spec.ts` and `party-cutover.e2e-spec.ts`
(1 each). Those three suites also `POST /manifests`, and since U4 they therefore allocate MANIFEST
sequences on their own fixture ports — a row type **none of them wrote before U4**, so this is
U4's regression to close, not the separate bill/voyage hygiene unit. Each got a MANIFEST-only
`scopeValue IN (createdPorts)` sweep appended next to its existing BILL sweep. **Their bill/voyage
sweeps were not touched**, no bill/voyage/manifest/port row was deleted by this unit (sequence
rows only), and all deletes use explicit id/name/scope filters per the U2 incident rule.
After the fix: `rows=0 orphan=0` on a full run.

---

## 6. Battery, live counts, migration reconciliation

**Test delta: 397 → 403** (decision-maker independently re-verified the intermediate 401 during
the interruption). Final battery, all gates:

| gate | result |
|---|---|
| `pnpm --filter api test` (triplet) | **403/403/0 ×3**, 22/22 suites |
| `npx tsc -p apps/api --noEmit` | **0** |
| apps/web `tsc` | exactly the 3 pre-existing `[locale]/page.tsx` errors |
| shared build | **0** |
| `CONTRACT GUARD` | **OK 87 ⊆ 95** (no new `@Post` routes — 87 unchanged) |
| `prisma migrate status` | **37 up to date**, shadow clean |
| `curl :3101/api/v1/health` / `:3000` | **200 / 200** (never started, stopped or restarted) |

**Live counts before → after:** manifests `4 → 4`, manifest items `4 → 4`, legacy numbers
`MAN-2609-00001..00004` **byte-identical**, `MANIFEST` NumberingSequence
**16 orphans → 0 → 0 after a full suite run**, `VOYAGE` 2676 and `BILL` 72 sequences untouched.

**Migration: none — status stays 37.** ADR-047 d7's entire footprint is *behavioural*: it swaps
which code path writes `manifests.manifestNumber` (a column that has existed since the first
migration) and introduces no DDL, no index, no constraint. `NumberingSequence` rows are **lazy** —
`allocateNumber` upserts them on first use, so there is nothing to migrate and no seed to write;
the live count is 0 before and after this unit. Shadow diff: `No difference detected`
(`prisma/schema.prisma` untouched by this unit). This mirrors U3's reconciliation (no migration
there either, for the same class of reason).

**Porcelain**: `manifest.service.ts`, `manifest.e2e-spec.ts`, `bill.e2e-spec.ts`,
`delivery-release.e2e-spec.ts`, `party-cutover.e2e-spec.ts` (test-file sweep only), this log,
ledger. `apps/web` **0** · `docs/decisions.md` **untouched** · legacy numbers **immutable**.

---

## 7. Next

**P5-U5 — UI consolidation flow + doc hook + closure** (roadmap Test 5 / Acceptance 4; the final
Phase 5 unit, which also closes the phase).
