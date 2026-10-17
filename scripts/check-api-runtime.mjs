#!/usr/bin/env node
/** Read-only attestation for an API listener managed by this repo OR an external manager. */
import { attestRunningApi } from './phase11-apps.mjs';

try {
  const pid = Number(process.argv[2]);
  const actual = attestRunningApi(pid);
  console.log(
    `API listener PID ${actual.pid} on :${actual.port} is executing ${actual.entry} with the current build marker. Database identity NOT verified.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Runtime attestation failed');
  process.exitCode = 1;
}
