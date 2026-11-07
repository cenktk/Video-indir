const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const { versionAtLeast } = require('../../scripts/doctor');

test('versionAtLeast compares numerically, not as text', () => {
  assert.ok(versionAtLeast('v24.1.0', '18'));
  assert.ok(versionAtLeast('v18.0.0', '18'));
  assert.ok(!versionAtLeast('v16.20.2', '18'));
  assert.ok(versionAtLeast('Python 3.10.1', '3.9'));
  assert.ok(!versionAtLeast('Python 3.8.18', '3.9'));
  assert.ok(versionAtLeast('Python 3.9.6', '3.9'));
  assert.ok(versionAtLeast('2026.08.19', ''));
  assert.ok(!versionAtLeast('garbage', '3.9'));
});

test('doctor exits 1 and names the fix when yt-dlp is missing', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'doctor.js')],
    { encoding: 'utf8', env: { ...process.env, YTDLP: '/nonexistent/yt-dlp' } });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /MISSING yt-dlp: not found/);
  assert.match(r.stdout, /fix: brew install yt-dlp/);
});

test('doctor exits 0 when only non-required checks fail', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'doctor.js')],
    { encoding: 'utf8', env: { ...process.env, SKOOL_CDP_URL: 'http://127.0.0.1:1' } });
  assert.match(r.stdout, /WARN {4}Browser over CDP/);
  assert.strictEqual(r.status, 0, r.stdout);
});
