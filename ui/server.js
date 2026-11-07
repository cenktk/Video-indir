// Local control panel: a queue and live log around the existing scripts. Node built-ins only.
require('../scripts/load_env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { routeUrl } = require('./routes');

const PORT = Number(process.env.UI_PORT) || 4747;
const HOST = '127.0.0.1';
const TOKEN = crypto.randomBytes(16).toString('hex');
const ROOT = process.env.SKOOL_ARCHIVE_ROOT || process.cwd();
const VENV_PY = path.join(__dirname, '..', '.venv', 'bin', 'python');
const MAX_LOG = 300;

const jobs = [];
let running = null;
const clients = new Set();
let timer = null;

function push() {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const data = JSON.stringify(await state());
    for (const res of clients) res.write(`data: ${data}\n\n`);
  }, 150);
}

async function cdpUp() {
  try {
    const r = await fetch((process.env.SKOOL_CDP_URL || 'http://127.0.0.1:9222') + '/json/version', { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

async function state() {
  return {
    root: ROOT,
    cdp: await cdpUp(),
    whisper: fs.existsSync(VENV_PY),
    jobs: jobs.map(({ id, kind, url, status, log }) => ({ id, kind, url, status, log })),
  };
}

function addLog(job, text) {
  for (const line of text.split(/\r?\n|\r/)) if (line.trim()) job.log.push(line);
  if (job.log.length > MAX_LOG) job.log.splice(0, job.log.length - MAX_LOG);
  push();
}

function runStep(job, step) {
  return new Promise(resolve => {
    // detached = own process group, so cancel can kill yt-dlp/ffmpeg grandchildren too.
    const child = spawn(step.cmd, step.args, { env: { ...process.env, ...step.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    job.child = child;
    child.stdout.on('data', d => addLog(job, d.toString()));
    child.stderr.on('data', d => addLog(job, d.toString()));
    child.on('error', e => { addLog(job, `[HATA] ${e.message}`); resolve(1); });
    child.on('close', code => { job.child = null; resolve(code); });
  });
}

async function next() {
  if (running) return;
  const job = jobs.find(j => j.status === 'bekliyor');
  if (!job) return;
  running = job;
  job.status = 'çalışıyor';
  push();
  for (const step of job.steps) {
    const code = await runStep(job, step);
    if (job.status === 'iptal') break;
    if (code !== 0) { job.status = 'hata'; break; }
  }
  if (job.status === 'çalışıyor') job.status = 'bitti';
  running = null;
  push();
  next();
}

function cleanOpts(o = {}) {
  const shortName = Number.parseInt(o.shortName, 10);
  const folder = String(o.folder || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/^[.\s]+/, '').slice(0, 60).trim();
  return {
    quality: ['720p', '1080p', 'best'].includes(o.quality) ? o.quality : undefined,
    audioOnly: !!o.audioOnly,
    embedSubs: !!o.embedSubs,
    shortName: shortName >= 10 && shortName <= 200 ? shortName : 0,
    folder: folder || undefined,
    transcribe: !!o.transcribe && fs.existsSync(VENV_PY),
    root: ROOT,
  };
}

function addJobs(urls, rawOpts) {
  const opts = cleanOpts(rawOpts);
  const added = [], rejected = [];
  for (const raw of String(urls || '').split(/\s+/).filter(Boolean).slice(0, 50)) {
    const r = routeUrl(raw, opts);
    if (!r) { rejected.push(raw); continue; }
    const job = { id: crypto.randomUUID(), kind: r.kind, url: r.url, steps: r.steps, status: 'bekliyor', log: [] };
    jobs.push(job);
    added.push(job.id);
  }
  next();
  push();
  return { added: added.length, rejected };
}

function cancel(id) {
  const job = jobs.find(j => j.id === id);
  if (!job || !['bekliyor', 'çalışıyor'].includes(job.status)) return false;
  job.status = 'iptal';
  if (job.child) { try { process.kill(-job.child.pid, 'SIGTERM'); } catch {} }
  push();
  return true;
}

function launchBrave() {
  const c = spawn('bash', [path.join(__dirname, '..', 'scripts', 'launch_brave_cdp.sh')], { stdio: 'ignore', detached: true });
  c.unref();
}

// Browsers let any website call localhost, so every request must carry the token and a local Host/Origin.
function allowed(req, url) {
  const ok = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);
  if (!ok.has(req.headers.host)) return false;
  if (req.headers.origin) {
    try { if (!ok.has(new URL(req.headers.origin).host)) return false; } catch { return false; } // Origin: null
  }
  return url.searchParams.get('t') === TOKEN;
}

function body(req) {
  return new Promise(resolve => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

  if (req.method === 'GET' && url.pathname === '/') {
    if (![`${HOST}:${PORT}`, `localhost:${PORT}`].includes(req.headers.host)) { res.writeHead(403); return res.end(); }
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace('__TOKEN__', TOKEN);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }
  if (!url.pathname.startsWith('/api/') || !allowed(req, url)) { res.writeHead(403); return res.end(); }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    res.write(`data: ${JSON.stringify(await state())}\n\n`);
    return;
  }
  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
  const b = await body(req);
  if (url.pathname === '/api/add') return json(200, addJobs(b.urls, b.opts));
  if (url.pathname === '/api/cancel') return json(200, { ok: cancel(b.id) });
  if (url.pathname === '/api/brave') { launchBrave(); return json(200, { ok: true }); }
  res.writeHead(404); res.end();
});

// Poll CDP so the status dot updates without a user action.
setInterval(() => clients.size && push(), 5000);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (running && running.child) { try { process.kill(-running.child.pid, 'SIGTERM'); } catch {} } process.exit(0); });
}

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`Arayüz: http://localhost:${PORT}  (indirilenler: ${ROOT})`));
}
module.exports = { server, cleanOpts, TOKEN, PORT };
