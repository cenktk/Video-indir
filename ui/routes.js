// Turns a pasted URL plus UI options into a list of steps (each step is one child process).
const path = require('path');

const SCRIPTS = path.join(__dirname, '..', 'scripts');
const VENV_PY = path.join(__dirname, '..', '.venv', 'bin', 'python');
const node = (file, ...args) => ({ cmd: process.execPath, args: [path.join(SCRIPTS, file), ...args] });
const py = (file, ...args) => ({ cmd: 'python3', args: [path.join(SCRIPTS, file), ...args] });
// Not Skool pages: /classroom, /about etc. are never a post slug.
const NOT_POST = new Set(['classroom', 'about', 'calendar', 'members', 'map', 'leaderboards', 'plans']);

function parseUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
}

// opts: { quality, audioOnly, embedSubs, shortName, folder, transcribe, root }
function routeUrl(raw, opts = {}) {
  const u = parseUrl(raw);
  if (!u) return null;
  const url = u.href;
  const isSkool = /(^|\.)skool\.com$/.test(u.hostname);
  const parts = u.pathname.split('/').filter(Boolean);
  const env = opts.quality ? { VIDEO_QUALITY: opts.quality } : {};
  const since = Math.floor(Date.now() / 1000) - 5;
  const transcribeStep = dir => ({ cmd: VENV_PY, args: [path.join(__dirname, 'transcribe.py'), dir, '--since', String(since)] });

  if (isSkool && parts.length >= 1) {
    // Skool scripts save under <root>/<SKOOL_COLLECTION_NAME>/...; the UI folder field sets that name.
    if (opts.folder) env.SKOOL_COLLECTION_NAME = opts.folder;
    const collection = opts.folder || process.env.SKOOL_COLLECTION_NAME || 'Skool Community';
    const tail = opts.transcribe ? [transcribeStep(path.join(opts.root || process.cwd(), collection))] : [];
    if (parts[1] === 'classroom' && parts.length === 2) return { kind: 'Tüm sınıf', url, steps: [{ ...node('download_everything.js', url), env }, ...tail] };
    if (parts[1] === 'classroom') return { kind: 'Kurs', url, steps: [{ ...node('download_all.js', url), env }, ...tail] };
    if (parts.length === 1) return { kind: 'Topluluk akışı', url, steps: [node('cdp_archive_skool_community.js', url)] };
    if (parts.length === 2 && !NOT_POST.has(parts[1])) {
      const manifest = path.join(opts.root || process.cwd(), 'post-manifest.json');
      return { kind: 'Gönderi videoları', url, steps: [node('cdp_post_manifest.js', url), { ...py('download_accessible_videos.py'), env: { ...env, SKOOL_MANIFEST: manifest } }, ...tail] };
    }
  }

  // LinkedIn post videos need the logged-in browser to reveal their playlist (see scripts/cdp_linkedin_video.js).
  if (/(^|\.)linkedin\.com$/.test(u.hostname) || u.hostname === 'lnkd.in') {
    const folder = opts.folder || 'Videos';
    const steps = [node('cdp_linkedin_video.js', url, '--folder', folder)];
    if (opts.transcribe) steps.push(transcribeStep(path.join(opts.root || process.cwd(), folder)));
    return { kind: 'LinkedIn videosu', url, steps };
  }

  const args = [url];
  if (opts.folder) args.push('--folder', opts.folder);
  if (opts.audioOnly) args.push('--audio-only');
  if (opts.embedSubs) args.push('--embed-subs');
  if (opts.shortName) args.push('--short-name', String(opts.shortName));
  const steps = [{ ...py('download_video_url.py', ...args), env }];
  if (opts.transcribe) {
    const dir = path.join(opts.root || process.cwd(), opts.folder || 'Videos');
    steps.push(transcribeStep(dir));
  }
  return { kind: 'Video', url, steps };
}

module.exports = { routeUrl, parseUrl };
