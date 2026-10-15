import path from 'node:path';

/** Jest's --json --outputFile result (the fields the baseline report consumes). */
export interface JestAssertion {
  fullName: string;
  status: string;
  failureMessages: string[];
}

export interface JestSuite {
  name: string;
  status: string;
  message: string;
  assertionResults: JestAssertion[];
}

export interface JestRun {
  numFailedTestSuites: number;
  numPassedTestSuites: number;
  numPendingTestSuites: number;
  numTotalTestSuites: number;
  numFailedTests: number;
  numPassedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  numTotalTests: number;
  testResults: JestSuite[];
}

/** Refuse incomplete/malformed JSON rather than publishing a partial baseline. */
export function parseJestRun(json: string): JestRun {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object') throw new Error('Jest did not produce a results object');
  const run = value as JestRun;
  const counts = [
    run.numFailedTestSuites, run.numPassedTestSuites, run.numPendingTestSuites, run.numTotalTestSuites,
    run.numFailedTests, run.numPassedTests, run.numPendingTests, run.numTodoTests, run.numTotalTests,
  ];
  if (counts.some((n) => !Number.isInteger(n) || n < 0) || !Array.isArray(run.testResults)) {
    throw new Error('Jest results are missing suite/test counts or testResults');
  }
  if (run.testResults.length !== run.numTotalTestSuites) {
    throw new Error(`Jest reported ${run.numTotalTestSuites} suites but supplied ${run.testResults.length} suite results`);
  }
  let assertions = 0;
  let failures = 0;
  for (const suite of run.testResults) {
    if (typeof suite.name !== 'string' || typeof suite.status !== 'string' ||
        typeof suite.message !== 'string' || !Array.isArray(suite.assertionResults)) {
      throw new Error('Jest supplied an incomplete suite result');
    }
    for (const test of suite.assertionResults) {
      if (typeof test.fullName !== 'string' || typeof test.status !== 'string' ||
          !Array.isArray(test.failureMessages) ||
          test.failureMessages.some((message) => typeof message !== 'string')) {
        throw new Error(`Jest supplied an incomplete test result in ${suite.name}`);
      }
      assertions += 1;
      if (test.status === 'failed') failures += 1;
    }
  }
  if (assertions !== run.numTotalTests || failures !== run.numFailedTests) {
    throw new Error(`Jest totals differ from test results: ${run.numTotalTests}/${run.numFailedTests} reported, ${assertions}/${failures} listed`);
  }
  return run;
}

export function runTotals(run: JestRun) {
  const suites = [
    `${run.numFailedTestSuites} failed`, `${run.numPassedTestSuites} passed`,
    ...(run.numPendingTestSuites ? [`${run.numPendingTestSuites} pending`] : []),
    `${run.numTotalTestSuites} total`,
  ].join(', ');
  const tests = [
    `${run.numFailedTests} failed`, `${run.numPassedTests} passed`,
    ...(run.numPendingTests ? [`${run.numPendingTests} skipped`] : []),
    ...(run.numTodoTests ? [`${run.numTodoTests} todo`] : []),
    `${run.numTotalTests} total`,
  ].join(', ');
  return { suites, tests };
}

/** Keep error text intact (apart from terminal colour and literal credential redaction). */
export function redactOutput(text: string, env: NodeJS.ProcessEnv): string {
  let clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (const key of ['DATABASE_URL', 'AUTH_JWT_SECRET', 'AUTH_JWT_REFRESH_SECRET', 'SEED_ADMIN_PASSWORD']) {
    const secret = env[key];
    if (secret && secret.length >= 6) clean = clean.replaceAll(secret, '[REDACTED]');
  }
  return clean;
}

function codeBlock(text: string): string {
  // Jest errors sometimes contain Markdown fences. Use a longer fence if needed.
  let longest = 2;
  for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${text.replace(/\s+$/, '')}\n${fence}`;
}

export function renderJestDetails(run: JestRun, root: string, redact: (text: string) => string,
  stdout: string, stderr: string): string {
  const suiteName = (name: string) => path.isAbsolute(name) ? path.relative(root, name).replaceAll('\\', '/') : name;
  const lines: string[] = ['## Suite results (all suites)', ''];
  for (const suite of run.testResults) {
    const tests = suite.assertionResults;
    const failed = tests.filter((test) => test.status === 'failed').length;
    const passed = tests.filter((test) => test.status === 'passed').length;
    const remaining = tests.length - failed - passed;
    lines.push(`- **${suite.status.toUpperCase()}** \`${suiteName(suite.name)}\` — ` +
      `${failed} failed, ${passed} passed${remaining ? `, ${remaining} skipped/todo` : ''}, ${tests.length} total`);
  }
  lines.push('', '## Failed tests and full error messages', '');
  let foundFailure = false;
  for (const suite of run.testResults) {
    if (suite.status !== 'failed') continue;
    foundFailure = true;
    lines.push(`### \`${suiteName(suite.name)}\``, '');
    const failed = suite.assertionResults.filter((test) => test.status === 'failed');
    if (!failed.length) lines.push('_Suite failed without an assertion (e.g. setup/teardown error)._', '');
    for (const test of failed) {
      lines.push(`**${redact(test.fullName)}**`, '');
      if (!test.failureMessages.length) lines.push('_No assertion-level error supplied by Jest._', '');
      for (const message of test.failureMessages) lines.push(codeBlock(redact(message)), '');
    }
    // Jest's suite message also includes beforeAll/afterAll and runtime errors,
    // which may not be attached to any assertion. It can repeat test errors.
    if (suite.message.trim()) lines.push('**Complete suite-level Jest message (may repeat test errors):**',
      '', codeBlock(redact(suite.message)), '');
  }
  if (!foundFailure) lines.push('_None._', '');
  lines.push('## Captured run output (complete, not a tail)', '',
    'Standard output and standard error are captured separately; their interleaving is not preserved.', '',
    '### Standard output', '', stdout.trim() ? codeBlock(redact(stdout)) : '_Empty._', '',
    '### Standard error', '', stderr.trim() ? codeBlock(redact(stderr)) : '_Empty._', '');
  return lines.join('\n');
}
