// Checks that the toolchain is ready and says how to fix what is not.
// Usage: npm run doctor        (exit code 1 only when a REQUIRED check fails)
require('./load_env');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// "v24.1.0" / "Python 3.9.6" / "2026.08.19" -> compared part by part against "18" / "3.9".
function versionAtLeast(text, min) {
  const have = (String(text).match(/\d+(?:\.\d+)*/) || ['0'])[0].split('.').map(Number);
  const need = min.split('.').map(Number);
  for (let i = 0; i < need.length; i += 1) {
    const h = have[i] || 0;
    if (h !== need[i]) return h > need[i];
  }
  return true;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 10000 });
  return r.error || r.status !== 0 ? null : (r.stdout || r.stderr).trim();
}

const tool = (name, cmd, args, min, fix) => () => {
  const out = run(cmd, args);
  if (!out) return { ok: false, detail: 'not found', fix };
  if (min && !versionAtLeast(out.split('\n')[0], min)) return { ok: false, detail: `${out.split('\n')[0]} (need ${min}+)`, fix };
  return { ok: true, detail: out.split('\n')[0] };
};

async function cdp() {
  const base = process.env.SKOOL_CDP_URL || 'http://127.0.0.1:9222';
  try {
    const r = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(2000) });
    return r.ok ? { ok: true, detail: `${base} reachable` } : { ok: false, detail: `${base} answered ${r.status}`, fix: 'npm run launch:brave' };
  } catch {
    return { ok: false, detail: `${base} not reachable`, fix: 'Run "npm run launch:brave" (or start Chrome with --remote-debugging-port), then ask the user to log in to Skool/LinkedIn in that window.' };
  }
}

// level: required = nothing works without it; needed = needed for some features; optional = nice to have
const CHECKS = [
  ['required', 'Node.js 18+', tool('node', process.execPath, ['--version'], '18', 'Install Node.js 18 or newer from https://nodejs.org')],
  ['required', 'npm packages', () => fs.existsSync(path.join(ROOT, 'node_modules', 'playwright'))
    ? { ok: true, detail: 'installed' } : { ok: false, detail: 'missing', fix: 'npm install' }],
  ['required', 'Python 3.9+', tool('python3', 'python3', ['--version'], '3.9', 'Install Python 3.9 or newer')],
  ['required', 'yt-dlp', tool('yt-dlp', process.env.YTDLP || 'yt-dlp', ['--version'], '', 'brew install yt-dlp   (or: python3 -m pip install -U yt-dlp)')],
  ['required', 'ffmpeg', tool('ffmpeg', 'ffmpeg', ['-version'], '', 'brew install ffmpeg   (Debian/Ubuntu: sudo apt-get install ffmpeg)')],
  ['required', 'ffprobe', tool('ffprobe', 'ffprobe', ['-version'], '', 'It ships with ffmpeg; reinstall ffmpeg')],
  ['needed', '.env file', () => fs.existsSync(path.join(ROOT, '.env'))
    ? { ok: true, detail: 'found' } : { ok: false, detail: 'missing (defaults apply)', fix: 'cp .env.example .env and set SKOOL_ARCHIVE_ROOT to a folder outside this repo' }],
  ['needed', 'Download folder writable', () => {
    const dir = process.env.SKOOL_ARCHIVE_ROOT || process.cwd();
    try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); return { ok: true, detail: dir }; }
    catch { return { ok: false, detail: `${dir} not writable`, fix: 'Set SKOOL_ARCHIVE_ROOT in .env to a writable folder' }; }
  }],
  ['needed', 'Browser over CDP (Skool and LinkedIn only)', cdp],
  ['optional', 'Whisper transcripts', () => fs.existsSync(path.join(ROOT, '.venv', 'bin', 'python'))
    ? { ok: true, detail: '.venv found' } : { ok: false, detail: 'not installed', fix: 'python3 -m venv .venv && .venv/bin/pip install faster-whisper' }],
];

async function main() {
  let requiredFailed = false;
  for (const [level, name, check] of CHECKS) {
    const r = await check();
    const tag = r.ok ? 'OK     ' : level === 'required' ? 'MISSING' : 'WARN   ';
    console.log(`${tag} ${name}: ${r.detail}`);
    if (!r.ok && r.fix) console.log(`        fix: ${r.fix}`);
    if (!r.ok && level === 'required') requiredFailed = true;
  }
  console.log(requiredFailed
    ? '\nNot ready: fix the MISSING items above.'
    : '\nReady for URL downloads. Skool and LinkedIn also need the browser (WARN above) with the user logged in.');
  process.exit(requiredFailed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { versionAtLeast };
