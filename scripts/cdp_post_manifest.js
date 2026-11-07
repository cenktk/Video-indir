require('./load_env');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const postUrl = process.argv[2];
const rootDir = process.env.SKOOL_ARCHIVE_ROOT || process.cwd();
const outPath = process.argv[3] || path.join(rootDir, 'post-manifest.json');

if (!postUrl) {
  console.error('Usage: node cdp_post_manifest.js <post-url> [out.json]');
  console.error('  or set SKOOL_ARCHIVE_ROOT so the default post-manifest.json lands next to the archive');
  process.exit(2);
}

// Same rules as the other scripts, so videos land under the usual course folder name.
function safeName(name, fallback = 'Skool Post') {
  const cleaned = String(name || fallback)
    .replace(/[/:]/g, '-')
    .replace(/[?*"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function formatDuration(ms) {
  const total = Math.floor(Number(ms || 0) / 1000);
  if (!total) return '';
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

(async () => {
  const browser = await chromium.connectOverCDP(process.env.SKOOL_CDP_URL || 'http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);

    const post = await page.evaluate(() => {
      const tree = window.__NEXT_DATA__?.props?.pageProps?.postTree;
      if (!tree) return null;
      return {
        name: tree.post?.name || '',
        title: tree.post?.metadata?.title || tree.post?.name || '',
        videos: (tree.videos || []).map(video => ({
          playbackId: video.playbackId || '',
          playbackToken: video.playbackToken || '',
          duration: video.duration || 0,
        })),
      };
    });

    if (!post) {
      throw new Error('No postTree in __NEXT_DATA__. Check the post URL and that the browser is logged in to Skool.');
    }
    if (!post.videos.length) {
      console.log('[INFO] This post has no Mux videos. Nothing to write.');
      return;
    }

    const postTitle = safeName(post.title || post.name);
    const manifest = post.videos.map((video, i) => ({
      index: i + 1,
      courseTitle: postTitle,
      section: '',
      title: `Video ${i + 1}`,
      duration: formatDuration(video.duration),
      kind: 'mux',
      playbackId: video.playbackId,
      playbackToken: video.playbackToken,
      url: `https://stream.mux.com/${video.playbackId}.m3u8?token=${video.playbackToken}`,
    }));

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
    console.log(`[INFO] Wrote ${manifest.length} video(s) for "${postTitle}" to ${outPath}`);
    console.log(`[TIP] Download with: SKOOL_MANIFEST="${outPath}" npm run download:videos`);
  } finally {
    await page.close();
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
