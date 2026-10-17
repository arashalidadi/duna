'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { render } = require('./render-units.cjs');
const { BackupStop } = require('./backup-policy.cjs');
test('systemd templates require operator calendars and affect only new Phase 12 jobs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duna-p12-units-'));
  try {
    const backupEnv = path.join(dir, 'backup.env');
    const archiveEnv = path.join(dir, 'archive.env');
    fs.writeFileSync(backupEnv, 'TEST_ONLY=1\n');
    fs.writeFileSync(archiveEnv, 'TEST_ONLY=1\n');
    const inputs = { repo: fs.realpathSync(path.resolve(__dirname, '../..')),
      serviceUser: os.userInfo().username, node: fs.realpathSync(process.execPath),
      corepack: fs.realpathSync(process.execPath), backupEnv, archiveEnv,
      backupSchedule: '*-*-* 04:01:00', archiveSchedule: '*-*-* 04:11:00',
      monitorSchedule: '*-*-* 05:01:00' };
    const files = render(inputs);
    assert.equal(Object.keys(files).length, 7);
    assert.match(files['duna-phase12-backup.timer'], /OnCalendar=\*-\*-\* 04:01:00/);
    assert.match(files['duna-phase12-backup.service'], /backup\.cjs backup/);
    assert.match(files['duna-phase12-backup.service'], /ExecStartPost=.*backup\.cjs prune/);
    assert.match(files['duna-phase12-archive.service'], /run-phase12-archive\.ts/);
    assert.match(files['duna-phase12-monitor.service'], /backup\.cjs status/);
    assert.match(files['duna-phase12-backup.service'], /OnFailure=duna-phase12-alert@%n\.service/);
    assert.match(files['duna-phase12-alert@.service'], /alert-mail\.sh %i FAILED/);
    assert.ok(Object.values(files).every((v) => !v.includes('postgres') && !v.includes('systemctl')));
    assert.throws(() => render({ ...inputs, backupSchedule: '' }), BackupStop);
    assert.throws(() => render({ ...inputs, archiveSchedule: 'OnFailure=bad\n' }), BackupStop);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
