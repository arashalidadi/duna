/**
 * Phase 0 / Phase 1 — record a dated, real e2e test figure.
 *
 * P0's acceptance requires "a **dated, real** pass/fail figure … replacing the
 * unverified `403/403`" (`initial-roadmap.md:74`), and P1's acceptance requires
 * "test status unchanged from the P0 baseline". Neither figure could be produced
 * in the build environment — the Prisma query engine cannot be downloaded there,
 * so 0 of the 22 suites have ever executed. [Update 2026-10-12: all 22 were executed in a sandbox through a sandbox-only WASM engine, 403/403 — see docs/duna-analysis/09-audit/e2e-sandbox-run-2026-10-12.md. The owner's server figure is still required.] This script produces the figure on a
 * machine that has a working database.
 *
 * Run:  pnpm test:e2e-baseline
 *
 * ---------------------------------------------------------------------------
 * PREREQUISITES — read before running
 * ---------------------------------------------------------------------------
 *  • Postgres reachable at DATABASE_URL, with the schema applied:
 *        npx prisma migrate deploy && npx prisma generate
 *  • A repository-root `.env` (copy `.env.example`) providing DATABASE_URL,
 *    AUTH_JWT_SECRET and the other required variables. Without it every suite
 *    aborts at load with `ConfigError: Missing required environment variable`.
 *  • The required seed applied — the suites log in as the administrator:
 *        pnpm db:seed        # or: SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm db:seed
 *  • Node dependencies installed (`pnpm install`).
 *
 * DATA: the suites create rows through the HTTP API and delete them again in
 * their own `afterAll` hooks. They do NOT drop the schema, but a crash mid-suite
 * can leave rows behind. Treat this as **development/test-database only**.
 *
 * The script writes a dated report to
 * `docs/duna-analysis/09-audit/e2e-baseline-<date>.md` and prints the figure.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'docs/duna-analysis/09-audit');

const date = new Date().toISOString().slice(0, 10);
const reportPath = path.join(reportDir, `e2e-baseline-${date}.md`);
const command = 'pnpm --filter @shipping/api test';

function describeTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return '(DATABASE_URL not set)';
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

/** Parse Jest's own summary lines out of the combined output. */
function parseJest(output: string) {
  const suites = /Suites:\s*(.*)/.exec(output);
  const tests = /Tests:\s*(.*)/.exec(output);
  const time = /Time:\s*(.*)/.exec(output);
  const failed = [...output.matchAll(/^\s*(?:FAIL|✕)\s+(.*)$/gm)].map((m) => m[1].trim());
  const passedSuites = [...output.matchAll(/^\s*PASS\s+(.*)$/gm)].map((m) => m[1].trim());
  return {
    suites: suites?.[1]?.trim() ?? 'not reported',
    tests: tests?.[1]?.trim() ?? 'not reported',
    time: time?.[1]?.trim() ?? 'not reported',
    failed,
    passedSuites,
  };
}

console.log('e2e baseline runner');
console.log(`  database : ${describeTarget()}`);
console.log(`  command  : ${command}`);
console.log('  (the suites write to this database and clean up after themselves)\n');

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env at the repository root and fill it in,\n' +
      'then apply the schema (`npx prisma migrate deploy`) and the required seed (`pnpm db:seed`).'
  );
  process.exit(2);
}

const started = Date.now();
const result = spawnSync('pnpm', ['--filter', '@shipping/api', 'test'], {
  cwd: root,
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  shell: false,
});
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(output.trim().split('\n').slice(-40).join('\n'));

const summary = parseJest(output);
const exitCode = result.status ?? -1;

// A baseline is a measurement of tests that actually ran. If Jest executed zero tests
// (suites failed at load — unbuilt workspace packages, missing env, unreachable DB),
// there is nothing to measure: write nothing and fail, rather than record "22 failed"
// as if it were a result.
const testsExecuted = Number(/(\d+)\s+total/.exec(summary.tests)?.[1] ?? 0);
if (testsExecuted === 0) {
  console.error(
    `\nNO BASELINE RECORDED — no test was executed (Jest: suites "${summary.suites}", tests "${summary.tests}").\n` +
      'Read the errors above. The usual causes are: workspace packages not built (run `pnpm build`),\n' +
      'a missing environment variable, or an unreachable DATABASE_URL. Nothing was written to docs/.'
  );
  process.exit(3);
}

const verdict =
  exitCode === 0
    ? '**All suites passed.**'
    : summary.tests === 'not reported' && summary.suites === 'not reported'
      ? '**No figure produced** — Jest did not report a summary. The suites most likely failed at config load (missing `.env` variables) or could not reach the database. See the output below.'
      : `**Failures present** (exit code ${exitCode}).`;

const report = `# e2e baseline — ${date}

**Recorded ${new Date().toISOString()}** by \`pnpm test:e2e-baseline\`.

This replaces the unverified \`403/403\` figure that \`initial-roadmap.md:74\` records
as UNVERIFIED. It is a real measurement from a real run.

| Field | Value |
| --- | --- |
| Date | ${date} |
| Command | \`${command}\` |
| Database | \`${describeTarget()}\` |
| Suites | ${summary.suites} |
| Tests | ${summary.tests} |
| Time | ${summary.time} |
| Wall clock | ${elapsed}s |
| Exit code | ${exitCode} |

## Verdict

${verdict}

## Failing suites

${summary.failed.length ? summary.failed.map((f) => `- ${f}`).join('\n') : '_None reported._'}

## Passing suites

${summary.passedSuites.length ? summary.passedSuites.map((s) => `- ${s}`).join('\n') : '_None reported._'}

## Data

The suites create rows through the HTTP API and delete them in their own
\`afterAll\` hooks. They do not drop the schema. This run targeted
\`${describeTarget()}\`.

## Raw tail of the run

\`\`\`
${output.trim().split('\n').slice(-60).join('\n')}
\`\`\`
`;

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf8');

console.log('\n--- figure ---');
console.log(`  suites : ${summary.suites}`);
console.log(`  tests  : ${summary.tests}`);
console.log(`  report : ${path.relative(root, reportPath)}`);

if (exitCode !== 0) {
  console.error(`\nThe run reported failures (exit ${exitCode}). The report was still written.`);
  process.exit(exitCode === -1 ? 1 : exitCode);
}
console.log('\nE2E BASELINE RECORDED.');
