/**
 * Record a dated E2E measurement on the owner's development/test database.
 *
 * Run: pnpm test:e2e-baseline
 *
 * Prerequisites: dependencies built, DATABASE_URL and auth env configured, and
 * the schema and required reference seed already present. Inspect the database
 * before any separate migration/seed command; this script never migrates or
 * resets it. Suites write fixtures and attempt their own cleanup, which is
 * best-effort after a failed run. Do not use this against production data.
 *
 * The report includes Jest's structured result for EVERY suite, EVERY failed
 * test's full error messages, suite-level errors, and the complete captured
 * stdout/stderr. Review the report for unexpected sensitive output before
 * committing it. No report is written when zero tests execute.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJestRun, redactOutput, renderJestDetails, runTotals, type JestRun } from './e2e-baseline-report.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'docs/duna-analysis/09-audit');
const date = new Date().toISOString().slice(0, 10);
const reportPath = path.join(reportDir, `e2e-baseline-${date}.md`);
const command = 'pnpm --filter @shipping/api run test --json --outputFile=<temporary Jest results file>';

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

console.log('e2e baseline runner');
console.log(`  database : ${describeTarget()}`);
console.log(`  command  : ${command}`);
console.log('  (the suites write to this database; cleanup on failure is best-effort)\n');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Configure the development/test database before running the baseline. No report was written.');
  process.exit(2);
}

// The JSON result is kept only in a private temporary directory. Jest's
// human-readable output is captured separately for the complete report.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'duna-e2e-'));
const resultsFile = path.join(temporary, 'jest-results.json');
const started = Date.now();
let result: SpawnSyncReturns<string>;
let json: string | undefined;
try {
  result = spawnSync('pnpm', ['--filter', '@shipping/api', 'run', 'test', '--json', `--outputFile=${resultsFile}`], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (fs.existsSync(resultsFile)) json = fs.readFileSync(resultsFile, 'utf8');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
const stdout = result.stdout ?? '';
const stderr = result.stderr ?? '';
const output = `${stdout}\n${stderr}`;
const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const redact = (text: string) => redactOutput(text, process.env);
console.log(redact(output).trim().split('\n').slice(-40).join('\n'));

if (result.error || result.status === null) {
  console.error(`\nNO BASELINE RECORDED — Jest did not finish: ${result.error?.message ?? result.signal}.`);
  process.exit(3);
}

let run: JestRun;
try {
  if (!json) throw new Error('Jest did not write its --json --outputFile results');
  run = parseJestRun(json);
} catch (error) {
  console.error(`\nNO BASELINE RECORDED — invalid or incomplete Jest results: ${String(error)}.`);
  console.error('The existing dated report was not overwritten. Inspect the output above.');
  process.exit(3);
}

// A suite-load/config failure is not a measured baseline. Keep the existing
// report untouched rather than recording failed suites with zero executed tests.
if (run.numTotalTests === 0) {
  console.error(`\nNO BASELINE RECORDED — no tests executed (Jest: ${runTotals(run).suites}).`);
  console.error('Check workspace builds, environment configuration, and database reachability. No report was written.');
  process.exit(3);
}

const summary = runTotals(run);
const time = /^\s*Time:\s*(.*)$/m.exec(output)?.[1]?.trim() ?? 'not reported';
const exitCode = result.status;
const verdict = exitCode === 0 ? '**All suites passed.**' : `**Failures present** (exit code ${exitCode}).`;
const report = `# e2e baseline — ${date}

**Recorded ${new Date().toISOString()}** by \`pnpm test:e2e-baseline\`.

A real E2E measurement (the historical \`403/403\` figure in \`initial-roadmap.md:74\` was unverified).

| Field | Value |
| --- | --- |
| Date | ${date} |
| Command | \`${command}\` |
| Database | \`${describeTarget()}\` |
| Suites | ${summary.suites} |
| Tests | ${summary.tests} |
| Time | ${time} |
| Wall clock | ${elapsed}s |
| Exit code | ${exitCode} |

## Verdict

${verdict}

## Data

Suites write test fixtures to the configured database. Cleanup is best-effort;
no schema reset or migration is performed by this command. This run targeted
\`${describeTarget()}\`.

${renderJestDetails(run, root, redact, stdout, stderr)}
`;

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf8');
console.log('\n--- figure ---');
console.log(`  suites : ${summary.suites}`);
console.log(`  tests  : ${summary.tests}`);
console.log(`  report : ${path.relative(root, reportPath)}`);
if (exitCode !== 0) {
  console.error(`\nThe run reported failures (exit ${exitCode}). The report was still written.`);
  process.exit(exitCode);
}
console.log('\nE2E BASELINE RECORDED.');
