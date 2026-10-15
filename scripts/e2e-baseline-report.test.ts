import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJestRun, redactOutput, renderJestDetails, runTotals, type JestRun } from './e2e-baseline-report.ts';

const longError = ['Expected: 400', 'Received: 450', ...Array.from({ length: 85 }, (_, i) => `stack line ${i}`), 'END OF ERROR'];
const sample: JestRun = {
  numFailedTestSuites: 2, numPassedTestSuites: 1, numPendingTestSuites: 0, numTotalTestSuites: 3,
  numFailedTests: 1, numPassedTests: 2, numPendingTests: 0, numTodoTests: 0, numTotalTests: 3,
  testResults: [
    { name: '/project/apps/api/test/voucher.e2e-spec.ts', status: 'failed', message: 'Suite failed during cleanup',
      assertionResults: [
        { fullName: 'Voucher › recalculates paidAmount', status: 'failed', failureMessages: [longError.join('\n')] },
        { fullName: 'Voucher › login', status: 'passed', failureMessages: [] },
      ] },
    { name: '/project/apps/api/test/numbering.e2e-spec.ts', status: 'failed',
      message: 'beforeAll: could not connect to the database', assertionResults: [] },
    { name: '/project/apps/api/test/vessel.e2e-spec.ts', status: 'passed', message: '',
      assertionResults: [{ fullName: 'Vessel › creates', status: 'passed', failureMessages: [] }] },
  ],
};

test('parses complete Jest results and refuses missing or inconsistent summaries', () => {
  assert.deepEqual(runTotals(parseJestRun(JSON.stringify(sample))), {
    suites: '2 failed, 1 passed, 3 total', tests: '1 failed, 2 passed, 3 total',
  });
  assert.throws(() => parseJestRun('{}'), /missing suite\/test counts/);
  assert.throws(() => parseJestRun(JSON.stringify({ ...sample, numTotalTestSuites: 4 })), /supplied 3 suite results/);
  assert.throws(() => parseJestRun(JSON.stringify({ ...sample, numFailedTests: 2 })), /totals differ/);
  assert.throws(() => parseJestRun(JSON.stringify({ ...sample, testResults: [{ name: 'broken' }, ...sample.testResults.slice(1)] })),
    /incomplete suite/);
});

test('lists EVERY suite, each failed test with untruncated errors, suite errors and complete captured output', () => {
  const stdout = ['first stdout line', ...Array.from({ length: 80 }, (_, i) => `stdout ${i}`), 'last stdout line'].join('\n');
  const stderr = 'stderr: database credentials should not be published: postgresql://me:secret@db/test';
  const redact = (text: string) => redactOutput(text, { DATABASE_URL: 'postgresql://me:secret@db/test' });
  const report = renderJestDetails(sample, '/project', redact, stdout, stderr);
  assert.equal((report.match(/^- \*\*(?:FAILED|PASSED)\*\*/gm) ?? []).length, 3);
  assert.match(report, /apps\/api\/test\/numbering.e2e-spec.ts/);
  assert.match(report, /apps\/api\/test\/vessel.e2e-spec.ts/);
  assert.match(report, /Voucher › recalculates paidAmount/);
  assert.match(report, /Expected: 400/);
  assert.match(report, /Received: 450/);
  assert.match(report, /END OF ERROR/);
  assert.match(report, /beforeAll: could not connect/);
  assert.match(report, /first stdout line/);
  assert.match(report, /last stdout line/);
  assert.match(report, /stderr: database credentials should not be published: \[REDACTED\]/);
  assert.doesNotMatch(report, /me:secret/);
});

test('escaped Markdown fences in Jest messages do not prematurely end a block', () => {
  const escaped = renderJestDetails({ ...sample, testResults: [{ ...sample.testResults[0],
    assertionResults: [{ fullName: 'fence', status: 'failed', failureMessages: ['test contains ``` a fence'] },
      sample.testResults[0].assertionResults[1]], }, ...sample.testResults.slice(1)] },
    '/project', (text) => text, '', '');
  assert.match(escaped, /````text\ntest contains ``` a fence\n````/);
});
