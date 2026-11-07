const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');

test('mac/build-app.sh builds a launcher bundle that points at this checkout', { skip: process.platform !== 'darwin' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-'));
  try {
    const r = spawnSync('bash', [path.join(REPO, 'mac', 'build-app.sh'), out], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    const launcher = path.join(out, 'Video-indir.app', 'Contents', 'MacOS', 'launcher');
    assert.ok(fs.statSync(launcher).mode & 0o111, 'launcher must be executable');
    const text = fs.readFileSync(launcher, 'utf8');
    assert.ok(text.startsWith('#!/bin/bash'));
    assert.ok(text.includes(`REPO=${REPO}`), 'repo path embedded');
    assert.strictEqual(spawnSync('bash', ['-n', launcher]).status, 0, 'launcher has valid bash syntax');
    const plist = path.join(out, 'Video-indir.app', 'Contents', 'Info.plist');
    assert.strictEqual(spawnSync('plutil', ['-lint', plist]).status, 0, 'valid Info.plist');
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
