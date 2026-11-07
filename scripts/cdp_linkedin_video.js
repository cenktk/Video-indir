// Download the video of a LinkedIn post (or a lnkd.in short link) with your logged-in browser.
//
// LinkedIn serves post videos as signed HLS playlists that yt-dlp cannot extract from the
// page. The page itself loads the playlist when the video plays, so we play it in the
// browser (over CDP), read the playlist URL from the page's resource timing, and hand that
// URL to download_video_url.py.
//
// Usage: node cdp_linkedin_video.js <post-url> [--folder NAME]
require('./load_env');
const path = require('path');
const { spawnSync } = require('child_process');

// Master playlist of the post video; the other playlist/vid/... URLs are single quality levels or thumbnails.
const MASTER = /^https:\/\/dms\.licdn\.com\/playlist\/vid\/dynamic\//;

// "/posts/ali-aytekin-5188_yapayzeka-tasaraftm-ugcPost-7516019100247330816-mGvx/" -> "ali-aytekin-5188_yapayzeka-tasaraftm [7516019100247330816]"
function postName(url) {
  const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
  const m = slug.match(/^(.*?)-(?:ugcPost|activity|share)-(\d+)(?:-\w+)?$/);
  const base = (m ? m[1] : slug).replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 120);
  return m ? `${base} [${m[2]}]` : base || 'linkedin-video';
}

async function findPlaylist(url) {
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP(process.env.SKOOL_CDP_URL || 'http://127.0.0.1:9222');
  const page = await browser.contexts()[0].newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { const v = document.querySelector('video'); if (v) { v.muted = true; v.play().catch(() => {}); } });
    await page.waitForTimeout(4000);
    const found = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name));
    return { playlist: found.find(u => MASTER.test(u)), finalUrl: page.url() };
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args[0];
  const fi = args.indexOf('--folder');
  const folder = fi > 0 ? args[fi + 1] : 'Videos';
  if (!url) { console.error('Usage: node cdp_linkedin_video.js <post-url> [--folder NAME]'); process.exit(2); }

  const { playlist, finalUrl } = await findPlaylist(url);
  if (!playlist) {
    console.error('[ERROR] No video found on this page. Is it a video post, and is the browser reachable over CDP?');
    process.exit(1);
  }
  console.log(`[INFO] Found playlist for ${finalUrl}`);
  const run = spawnSync('python3', [path.join(__dirname, 'download_video_url.py'), playlist, '--folder', folder, '--name', postName(finalUrl)], { stdio: 'inherit' });
  process.exit(run.status === null ? 1 : run.status);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { postName, MASTER };
