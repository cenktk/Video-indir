const test = require('node:test');
const assert = require('node:assert');
const { routeUrl } = require('../routes');

const R = '/root';
const route = (u, o = {}) => routeUrl(u, { root: R, ...o });
const base = f => f.split('/').pop();

test('Skool URLs go to the matching script', () => {
  const cases = [
    ['https://www.skool.com/c/classroom', 'Tüm sınıf', 'download_everything.js'],
    ['https://www.skool.com/c/classroom/abc?md=1', 'Kurs', 'download_all.js'],
    ['https://www.skool.com/c', 'Topluluk akışı', 'cdp_archive_skool_community.js'],
    ['https://www.skool.com/c/my-post?p=1', 'Gönderi videoları', 'cdp_post_manifest.js'],
  ];
  for (const [url, kind, script] of cases) {
    const r = route(url);
    assert.strictEqual(r.kind, kind, url);
    assert.strictEqual(base(r.steps[0].args[0]), script, url);
  }
});

test('post route runs manifest then download with SKOOL_MANIFEST', () => {
  const r = route('https://www.skool.com/c/my-post');
  assert.strictEqual(r.steps.length, 2);
  assert.strictEqual(base(r.steps[1].args[0]), 'download_accessible_videos.py');
  assert.strictEqual(r.steps[1].env.SKOOL_MANIFEST, `${R}/post-manifest.json`);
});

test('reserved Skool pages are not treated as posts', () => {
  for (const p of ['about', 'calendar', 'members', 'map', 'leaderboards', 'plans']) {
    assert.strictEqual(route(`https://www.skool.com/c/${p}`).kind, 'Video', p);
  }
});

test('lookalike hosts are not treated as Skool', () => {
  for (const h of ['evilskool.com', 'skool.com.evil.com', 'notskool.com']) {
    assert.strictEqual(route(`https://${h}/c/classroom`).kind, 'Video', h);
  }
  assert.strictEqual(route('https://skool.com/c/classroom').kind, 'Tüm sınıf');
});

test('non-http(s) and malformed input is rejected', () => {
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'ftp://x.com/a', 'not a url', '', undefined, null]) {
    assert.strictEqual(route(bad), null, String(bad));
  }
});

test('generic URL maps options to download_video_url.py flags', () => {
  const r = route('https://youtu.be/x', { folder: 'F', audioOnly: true, embedSubs: true, shortName: 40, quality: '720p' });
  assert.strictEqual(r.kind, 'Video');
  const a = r.steps[0].args;
  assert.strictEqual(base(a[0]), 'download_video_url.py');
  assert.deepStrictEqual(a.slice(1), ['https://youtu.be/x', '--folder', 'F', '--audio-only', '--embed-subs', '--short-name', '40']);
  assert.strictEqual(r.steps[0].env.VIDEO_QUALITY, '720p');
});

test('no options adds no extra flags', () => {
  assert.strictEqual(route('https://youtu.be/x').steps[0].args.length, 2);
});

test('URL is normalised and never lands in a shell string', () => {
  const r = route('https://youtu.be/x; rm -rf ~');
  // URL parser percent-encodes the space, so the payload cannot split into extra words.
  assert.strictEqual(r.url, 'https://youtu.be/x;%20rm%20-rf%20~');
  assert.strictEqual(r.steps[0].args[1], r.url);
  assert.ok(r.steps[0].args.every(a => !/\s/.test(a)));
  assert.strictEqual(r.steps[0].cmd, 'python3'); // spawned with an args array, no shell
});

test('transcribe adds one step for generic URLs, pointed at the folder', () => {
  const r = route('https://youtu.be/x', { transcribe: true, folder: 'F' });
  assert.strictEqual(r.steps.length, 2);
  const a = r.steps[1].args;
  assert.strictEqual(base(a[0]), 'transcribe.py');
  assert.strictEqual(a[1], `${R}/F`);
  assert.strictEqual(a[2], '--since');
  assert.ok(Number(a[3]) > 0);
});

test('transcribe defaults to the Videos folder for generic URLs', () => {
  assert.strictEqual(route('https://youtu.be/x', { transcribe: true }).steps[1].args[1], `${R}/Videos`);
});

test('transcribe is added to every Skool route', () => {
  for (const url of ['https://www.skool.com/c/classroom', 'https://www.skool.com/c/classroom/a', 'https://www.skool.com/c/post']) {
    const r = route(url, { transcribe: true });
    const last = r.steps[r.steps.length - 1];
    assert.strictEqual(base(last.args[0]), 'transcribe.py', url);
    assert.strictEqual(last.args[1], `${R}/Skool Community`);
  }
});

test('folder field sets the Skool collection name and transcribe path', () => {
  const r = route('https://www.skool.com/c/post', { folder: 'master clas claude', transcribe: true });
  assert.strictEqual(r.steps.length, 3);
  assert.strictEqual(r.steps[0].env, undefined); // manifest step ignores the collection name
  assert.strictEqual(r.steps[1].env.SKOOL_COLLECTION_NAME, 'master clas claude');
  assert.strictEqual(r.steps[2].args[1], `${R}/master clas claude`);
});

test('no transcribe step unless requested', () => {
  assert.strictEqual(route('https://www.skool.com/c/post').steps.length, 2);
  assert.strictEqual(route('https://youtu.be/x').steps.length, 1);
});

test('LinkedIn and lnkd.in links use the browser-based LinkedIn script', () => {
  for (const url of ['https://lnkd.in/p/dpAw9ZDb', 'https://www.linkedin.com/posts/a-b-ugcPost-1-x/', 'https://linkedin.com/posts/a']) {
    const r = route(url, { folder: 'F' });
    assert.strictEqual(r.kind, 'LinkedIn videosu', url);
    assert.strictEqual(r.steps.length, 1);
    assert.deepStrictEqual(r.steps[0].args.slice(1), [r.url, '--folder', 'F']);
    assert.strictEqual(base(r.steps[0].args[0]), 'cdp_linkedin_video.js');
  }
});

test('LinkedIn route defaults to Videos and can transcribe', () => {
  const r = route('https://lnkd.in/p/x', { transcribe: true });
  assert.strictEqual(r.steps[0].args[2], '--folder');
  assert.strictEqual(r.steps[0].args[3], 'Videos');
  assert.strictEqual(r.steps[1].args[1], `${R}/Videos`);
});

test('lookalike LinkedIn hosts are plain videos', () => {
  for (const h of ['evillinkedin.com', 'linkedin.com.evil.com', 'lnkd.in.evil.com']) {
    assert.strictEqual(route(`https://${h}/x`).kind, 'Video', h);
  }
});
