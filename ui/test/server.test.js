const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

// Must be set before the server module is loaded: it reads them at import time.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-test-'));
const PORT = 47000 + Math.floor(Math.random() * 1000);
process.env.UI_PORT = String(PORT);
process.env.SKOOL_ARCHIVE_ROOT = TMP;

// Fake yt-dlp: behaviour chosen by the URL (the last argument).
const FAKE = path.join(TMP, 'fake-yt-dlp');
fs.writeFileSync(FAKE, `#!/bin/sh
for a; do url="$a"; done
case "$url" in
  *fail*) echo "boom" >&2; exit 1 ;;
  *slow*) sleep 60 & echo $! > "${TMP}/slow.pid"; wait ;;
  *) echo "fake ok $url"; exit 0 ;;
esac
`, { mode: 0o755 });
process.env.YTDLP = FAKE;

const { server, cleanOpts, TOKEN } = require('../server');

const call = (method, p, body, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, res => {
    let s = '';
    res.on('data', d => (s += d));
    res.on('end', () => resolve({ status: res.statusCode, body: s }));
  });
  req.on('error', reject);
  if (body) req.write(JSON.stringify(body));
  req.end();
});
const api = (p, body) => call('POST', `/api/${p}?t=${TOKEN}`, body);
const snapshot = () => new Promise(resolve => {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: `/api/events?t=${TOKEN}` }, res => {
    res.once('data', d => { resolve(JSON.parse(d.toString().replace(/^data: /, ''))); req.destroy(); });
  });
});
const waitFor = async (pred, ms = 15000) => {
  const end = Date.now() + ms;
  for (;;) {
    const s = await snapshot();
    const v = pred(s);
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout: ' + JSON.stringify(s.jobs.map(j => [j.url, j.status])));
    await new Promise(r => setTimeout(r, 100));
  }
};
const job = (s, needle) => s.jobs.find(j => j.url.includes(needle));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

test.before(() => new Promise(r => server.listen(PORT, '127.0.0.1', r)));
test.after(() => { server.close(); fs.rmSync(TMP, { recursive: true, force: true }); setImmediate(() => process.exit(0)); });

test('security: token, Host and Origin are enforced', async () => {
  assert.strictEqual((await call('GET', '/api/events')).status, 403, 'no token');
  assert.strictEqual((await call('GET', `/api/events?t=wrong`)).status, 403, 'wrong token');
  assert.strictEqual((await call('POST', '/api/add', { urls: 'https://a.com' })).status, 403, 'POST without token');
  assert.strictEqual((await call('GET', `/api/events?t=${TOKEN}`, null, { host: 'evil.com' })).status, 403, 'bad host');
  assert.strictEqual((await call('GET', `/api/events?t=${TOKEN}`, null, { origin: 'https://evil.com' })).status, 403, 'bad origin');
  assert.strictEqual((await call('GET', `/api/events?t=${TOKEN}`, null, { origin: 'null' })).status, 403, 'null origin');
  assert.strictEqual((await call('GET', '/', null, { host: 'evil.com' })).status, 403, 'page with bad host');
});

test('security: server survives a hostile Origin and still answers', async () => {
  await call('GET', `/api/events?t=${TOKEN}`, null, { origin: 'null' });
  assert.strictEqual((await call('GET', '/')).status, 200);
});

test('page is served with the token embedded and not cached', async () => {
  const r = await call('GET', '/');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.includes(TOKEN));
  assert.ok(!r.body.includes('__TOKEN__'));
});

test('unknown API path and wrong method are refused', async () => {
  assert.strictEqual((await api('nope', {})).status, 404);
  assert.strictEqual((await call('GET', `/api/add?t=${TOKEN}`)).status, 405);
  assert.strictEqual((await call('GET', '/elsewhere')).status, 403);
});

test('invalid URLs are rejected and nothing is queued', async () => {
  const r = JSON.parse((await api('add', { urls: 'javascript:alert(1) file:///etc/passwd nonsense' })).body);
  assert.strictEqual(r.added, 0);
  assert.strictEqual(r.rejected.length, 3);
  assert.strictEqual((await snapshot()).jobs.length, 0);
});

test('a successful job ends as bitti with its log', async () => {
  await api('add', { urls: 'https://example.com/ok' });
  const j = await waitFor(s => ['bitti', 'hata'].includes(job(s, '/ok')?.status) && job(s, '/ok'));
  assert.strictEqual(j.status, 'bitti');
  assert.ok(j.log.some(l => l.includes('fake ok')));
});

test('a failing job ends as hata and the queue keeps going', async () => {
  await api('add', { urls: 'https://example.com/fail https://example.com/after' });
  const s = await waitFor(s => job(s, '/after')?.status === 'bitti' && s);
  assert.strictEqual(job(s, '/fail').status, 'hata');
  assert.ok(job(s, '/fail').log.some(l => l.includes('boom')));
});

test('only one job runs at a time', async () => {
  await api('add', { urls: 'https://example.com/slow-1 https://example.com/slow-2' });
  await waitFor(s => job(s, 'slow-1')?.status === 'çalışıyor');
  const s = await snapshot();
  assert.strictEqual(s.jobs.filter(j => j.status === 'çalışıyor').length, 1);
  assert.strictEqual(job(s, 'slow-2').status, 'bekliyor');
  // clean up so later tests start from a free queue
  await api('cancel', { id: job(s, 'slow-2').id });
  await api('cancel', { id: job(s, 'slow-1').id });
  await waitFor(s => job(s, 'slow-1').status === 'iptal' && s);
});

test('cancel kills the whole process group, not only the direct child', async () => {
  fs.rmSync(path.join(TMP, 'slow.pid'), { force: true });
  await api('add', { urls: 'https://example.com/slow-kill' });
  const id = (await waitFor(s => job(s, 'slow-kill')?.status === 'çalışıyor' && job(s, 'slow-kill'))).id;
  const pidFile = path.join(TMP, 'slow.pid');
  await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').trim());
  const grandchild = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.ok(alive(grandchild), 'grandchild should be running before cancel');
  assert.strictEqual(JSON.parse((await api('cancel', { id })).body).ok, true);
  await waitFor(s => job(s, 'slow-kill').status === 'iptal' && s);
  await new Promise(r => setTimeout(r, 500));
  assert.ok(!alive(grandchild), 'grandchild must be dead after cancel');
});

test('cancel of an unknown or finished job returns ok:false', async () => {
  assert.strictEqual(JSON.parse((await api('cancel', { id: 'nope' })).body).ok, false);
  const done = (await snapshot()).jobs.find(j => j.status === 'bitti');
  assert.strictEqual(JSON.parse((await api('cancel', { id: done.id })).body).ok, false);
});

test('cancelling a waiting job removes it from the queue without running it', async () => {
  await api('add', { urls: 'https://example.com/slow-a https://example.com/ok-waiting' });
  await waitFor(s => job(s, 'slow-a')?.status === 'çalışıyor');
  const w = job(await snapshot(), 'ok-waiting');
  assert.strictEqual(JSON.parse((await api('cancel', { id: w.id })).body).ok, true);
  await api('cancel', { id: job(await snapshot(), 'slow-a').id });
  await waitFor(s => job(s, 'slow-a').status === 'iptal' && s);
  const s = await snapshot();
  assert.strictEqual(job(s, 'ok-waiting').status, 'iptal');
  assert.strictEqual(job(s, 'ok-waiting').log.length, 0);
});

test('state reports the archive root and booleans', async () => {
  const s = await snapshot();
  assert.strictEqual(s.root, TMP);
  assert.strictEqual(typeof s.cdp, 'boolean');
  assert.strictEqual(typeof s.whisper, 'boolean');
});

test('cleanOpts sanitises user input', () => {
  assert.strictEqual(cleanOpts({ folder: '../../etc' }).folder, 'etc');
  assert.strictEqual(cleanOpts({ folder: 'a/b\\c' }).folder, 'abc');
  assert.strictEqual(cleanOpts({ folder: 'Eğitimler 2' }).folder, 'Eğitimler 2');
  assert.strictEqual(cleanOpts({ folder: '   ' }).folder, undefined);
  assert.strictEqual(cleanOpts({ folder: ' . x ' }).folder, 'x');
  assert.strictEqual(cleanOpts({ folder: '/' }).folder, undefined);
  assert.strictEqual(cleanOpts({ folder: 'x'.repeat(200) }).folder.length, 60);
  assert.strictEqual(cleanOpts({ quality: 'hack' }).quality, undefined);
  assert.strictEqual(cleanOpts({ quality: 'best' }).quality, 'best');
  assert.strictEqual(cleanOpts({ shortName: '5' }).shortName, 0);
  assert.strictEqual(cleanOpts({ shortName: '300' }).shortName, 0);
  assert.strictEqual(cleanOpts({ shortName: '40' }).shortName, 40);
  assert.strictEqual(cleanOpts({ shortName: 'abc' }).shortName, 0);
  assert.strictEqual(cleanOpts().audioOnly, false);
  assert.strictEqual(cleanOpts({ transcribe: true }).transcribe, fs.existsSync(path.join(__dirname, '..', '..', '.venv', 'bin', 'python')));
});

test('at most 50 URLs are accepted per request', async () => {
  const urls = Array.from({ length: 80 }, (_, i) => `https://example.com/slow-many-${i}`).join(' ');
  const r = JSON.parse((await api('add', { urls })).body);
  assert.strictEqual(r.added, 50);
  for (const j of (await snapshot()).jobs) if (['bekliyor', 'çalışıyor'].includes(j.status)) await api('cancel', { id: j.id });
});
