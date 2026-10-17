#!/usr/bin/env node
'use strict';
// Render ONLY. Installation/enabling on the owner host is a separate approval
// stage, after an independently executed and signed restore rehearsal.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BackupStop } = require('./backup-policy.cjs');
function stop() { throw new BackupStop('Explicit approved service user, checkout, schedules, environment files and empty staging directory required'); }
function safePath(value) {
  if (!value || !/^\/[a-zA-Z0-9_./-]+$/.test(value) || value.includes('/../') ||
      !fs.existsSync(value) || path.resolve(value) !== fs.realpathSync(value)) stop();
  return value;
}
function calendar(value) {
  if (!value || !/^[a-zA-Z0-9 *:,/.-]{4,100}$/.test(value)) stop();
  const result = spawnSync('systemd-analyze', ['calendar', value], { stdio: 'ignore', timeout: 5000 });
  if (result.status !== 0) throw new BackupStop('Owner-supplied calendar expression is not accepted by systemd');
  return value;
}
function render(config) {
  const { repo, serviceUser, node, corepack, backupEnv, archiveEnv, backupSchedule,
    archiveSchedule, monitorSchedule } = config;
  for (const file of [node, corepack, backupEnv, archiveEnv]) safePath(file);
  safePath(repo);
  if (!/^[a-z_][a-z0-9_-]{1,30}$/.test(serviceUser || '') ||
      spawnSync('id', ['-u', serviceUser], { stdio: 'ignore' }).status !== 0) stop();
  const schedules = [backupSchedule, archiveSchedule, monitorSchedule].map(calendar);
  const prefix = '[Unit]\nAfter=network-online.target\nWants=network-online.target\n';
  const common = (description, env) => `${prefix}Description=${description}\nOnFailure=duna-phase12-alert@%n.service\n\n[Service]\nType=oneshot\nUser=${serviceUser}\nWorkingDirectory=${repo}\nEnvironmentFile=${env}\nUMask=0077\n`;
  const timer = (description, schedule, unit) => `[Unit]\nDescription=${description}\n\n[Timer]\nOnCalendar=${schedule}\nPersistent=true\nUnit=${unit}\n\n[Install]\nWantedBy=timers.target\n`;
  return {
    'duna-phase12-backup.service': common('Duna encrypted off-server backup', backupEnv) +
      `ExecStart=${node} ${repo}/scripts/phase12/backup.cjs backup\n` +
      `ExecStartPost=${node} ${repo}/scripts/phase12/backup.cjs prune\n`,
    'duna-phase12-backup.timer': timer('Scheduled Duna off-server backup', schedules[0], 'duna-phase12-backup.service'),
    'duna-phase12-archive.service': common('Duna configured automatic letter archive', archiveEnv) +
      `ExecStart=${corepack} pnpm exec tsx apps/api/scripts/run-phase12-archive.ts\n`,
    'duna-phase12-archive.timer': timer('Scheduled Duna letter archive', schedules[1], 'duna-phase12-archive.service'),
    'duna-phase12-monitor.service': common('Duna backup and restore freshness check', backupEnv) +
      `ExecStart=${node} ${repo}/scripts/phase12/backup.cjs status\n`,
    'duna-phase12-monitor.timer': timer('Duna backup and restore failure monitoring', schedules[2], 'duna-phase12-monitor.service'),
    'duna-phase12-alert@.service': `[Unit]\nDescription=Duna Phase 12 failed job notifier for %i\n\n[Service]\nType=oneshot\nUser=${serviceUser}\nWorkingDirectory=${repo}\nEnvironmentFile=${backupEnv}\nExecStart=${repo}/scripts/phase12/alert-mail.sh %i FAILED\n`,
  };
}
if (require.main === module) {
  try {
    const E = process.env;
    if (E.PHASE12_PRUNE_APPROVAL !== 'I_APPROVE_OFFSITE_RETENTION') {
      throw new BackupStop('Automatic retention requires explicit owner-approved offsite pruning');
    }
    const repo = safePath(E.PHASE12_CHECKOUT);
    if (!fs.existsSync(path.join(repo, 'scripts/phase12/backup.cjs'))) stop();
    const staging = safePath(E.PHASE12_UNIT_STAGING_DIR);
    if (!fs.lstatSync(staging).isDirectory() || fs.readdirSync(staging).length) stop();
    const files = render({ repo, serviceUser: E.PHASE12_SERVICE_USER,
      node: E.PHASE12_NODE_BIN, corepack: E.PHASE12_COREPACK_BIN,
      backupEnv: E.PHASE12_BACKUP_ENV_FILE, archiveEnv: E.PHASE12_ARCHIVE_ENV_FILE,
      backupSchedule: E.PHASE12_BACKUP_CALENDAR,
      archiveSchedule: E.PHASE12_ARCHIVE_CALENDAR,
      monitorSchedule: E.PHASE12_MONITOR_CALENDAR });
    for (const [name, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(staging, name), contents, { flag: 'wx', mode: 0o600 });
    }
    console.log('PHASE12_UNITS_RENDERED: 3 timers, 3 jobs and an alert handler; NOT INSTALLED OR ENABLED.');
  } catch (e) {
    console.error('PHASE12_UNITS_FAIL:', e instanceof BackupStop ? e.message : 'Safe unit rendering failed');
    process.exitCode = 1;
  }
}
module.exports = { render };
