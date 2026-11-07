const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { safeName } = require('../../scripts/safe_name');

const ROOT = path.resolve('/archive/root');
const inside = name => {
  const p = path.resolve(path.join(ROOT, safeName(name)));
  return p.startsWith(ROOT + path.sep);
};

test('names that would climb out of the folder stay inside it', () => {
  for (const evil of ['..', '.', '...', '../..', '../../etc/passwd', '..\\..\\x', '/etc/passwd', ' .. ', './..', '..//..', '.. /', '\0..']) {
    assert.ok(inside(evil), `${JSON.stringify(evil)} -> ${JSON.stringify(safeName(evil))}`);
    assert.ok(!/[/\\]/.test(safeName(evil)), `separator left in ${JSON.stringify(evil)}`);
  }
});

test('empty or unusable input falls back', () => {
  assert.strictEqual(safeName('..'), 'item');
  assert.strictEqual(safeName('...  '), 'item');
  assert.strictEqual(safeName('', 'Untitled'), 'Untitled');
  assert.strictEqual(safeName(null, 'X'), 'X');
  assert.strictEqual(safeName(undefined), 'item');
  assert.strictEqual(safeName('?*"<>|'), 'item');
});

test('normal titles are unchanged (existing archives keep their folder names)', () => {
  for (const ok of ['Masterclass 5 - GEO', 'Video 1', 'Ders 3: Giriş', 'a.b.c', 'Eğitim Özet', 'What is AI...']) {
    assert.strictEqual(safeName(ok), ok.replace(/:/g, '-'), ok);
  }
});

test('separators, control characters and extra spaces are cleaned', () => {
  assert.strictEqual(safeName('a/b\\c:d'), 'a-b-c-d');
  assert.strictEqual(safeName('a\x00b\x1fc'), 'abc');
  assert.strictEqual(safeName('  a \t\n b  '), 'a b');
  assert.strictEqual(safeName('.hidden'), 'hidden');
});

test('no Node script keeps its own weaker copy of safeName', () => {
  const dir = path.join(__dirname, '..', '..', 'scripts');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js') && n !== 'safe_name.js')) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/function safeName\s*\(/.test(src), `${f} defines its own safeName`);
  }
});
