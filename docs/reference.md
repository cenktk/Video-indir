# Reference

Details behind the [README](../README.md).

## npm scripts

| Command | Action |
| --- | --- |
| `npm run ui` | Start the local web UI on `http://localhost:4747` |
| `npm run doctor` | Check the toolchain, `.env`, browser connection and Whisper |
| `npm test` | Run all Node and Python tests |
| `npm run launch:brave` | Launch Brave (macOS) with CDP on port 9222 |
| `npm run inspect` | List the tabs in the connected browser session |
| `npm run download:all` | **All-in-one:** videos, notes, and attachments for **one course** |
| `npm run download:everything` | **All-in-one:** the same for **every course** in the classroom |
| `npm run course:state` | Dump the course/lesson structure to `course-state.json` (`course-state` also works) |
| `npm run download:details` | Download lesson descriptions/notes and attached files |
| `npm run download:pdf` | Download only the PDF attachments |
| `npm run download:videos` | Download videos in `VIDEO_QUALITY` |
| `npm run post:manifest` | Write a video manifest for a community post (Mux videos) |
| `npm run download:url` | Download one or more video URLs (YouTube, Loom, Mux, ...) into the archive |
| `npm run archive:community` | Archive the community feed into HTML/Markdown/JSON |
| `npm run archive:post` | Archive a single community post |
| `npm run optimize:videos` | Re-encode oversized videos |

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/cdp_inspect.js` | List the pages/tabs open in the attached browser session (sanity check that CDP is connected). |
| `scripts/cdp_course_state.js` | Read the classroom's `__NEXT_DATA__` and dump the course tree — courses, sections, modules, access flags, video links, durations. |
| `scripts/download_all.js` | Run course state → lesson details → videos for one course. |
| `scripts/download_everything.js` | Run `download_all.js` for every course in a classroom. |
| `scripts/cdp_capture_media.js` | Open a lesson, play it, and capture the underlying media/manifest URLs from network traffic. |
| `scripts/cdp_download_lesson_details.js` | Walk lessons you can access and save their notes and attached files using your session. |
| `scripts/cdp_download_pdf_resources.js` | Download PDF resources attached to lessons. |
| `scripts/cdp_download_url.js` | Fetch a single URL through the browser session and save the response body. |
| `scripts/cdp_archive_skool_community.js` | Archive a community feed into local HTML/Markdown/JSON. |
| `scripts/cdp_archive_skool_post.js` | Archive a single community post (with formatting, links and mentions preserved). |
| `scripts/capture_skool_feed_from_chrome_clipboard.js` | Capture the currently-loaded feed straight from the browser via the clipboard. |
| `scripts/archive_new_posts_from_source_check.js` | Incrementally archive only posts that are new since your last run. |
| `scripts/update_community_from_incremental_check.js` | Update an existing local community archive with new/changed posts. |
| `scripts/cdp_post_manifest.js` | Read a community post and write a manifest of its Mux videos, ready for `download:videos`. |
| `scripts/download_accessible_videos.py` | Batch-download the videos from a manifest or `course-state.json` (Wistia, Mux and anything `yt-dlp` handles). |
| `scripts/download_video_url.py` | Download one or more video URLs into the archive root, with subtitles (YouTube and anything else `yt-dlp` supports). |
| `scripts/download_youtube_alt_host.py` | Robustly download a YouTube-backed video, trying alternate CDN hosts, and mux with `ffmpeg`. |
| `scripts/optimize_videos_1080p.py` | Re-encode oversized videos to reclaim disk space. |
| `scripts/cdp_linkedin_video.js` | Download the video of a LinkedIn post or `lnkd.in` link through the logged-in browser. |
| `scripts/doctor.js` | Setup check behind `npm run doctor`. |
| `ui/server.js`, `ui/routes.js` | Local web UI: queue, live log, and the URL-to-script routing. |
| `ui/transcribe.py` | Local Whisper transcripts (`.txt`, `.transcript.srt`) for media in a folder. |
| `scripts/launch_brave_cdp.sh` | Launch Brave with remote debugging (macOS). |


## How it works

1. You log in to Skool or LinkedIn in a normal Brave/Chrome window that was started with `--remote-debugging-port=9222`.
2. The scripts attach to that window over the Chrome DevTools Protocol (`http://127.0.0.1:9222`) — they reuse **your** session, so there are no credentials to store.
3. For structured data, they read the page's embedded `__NEXT_DATA__` JSON. For media, they observe network requests to find the real video/manifest URLs.
4. Downloads are performed with your session; YouTube-hosted and other embedded media is fetched with `yt-dlp` and muxed with `ffmpeg`.
5. Community posts are converted into clean, self-contained local HTML/Markdown/JSON.


## FAQ

**Does this need my Skool password?**
No. It attaches to a browser window where *you* are already logged in. Credentials never touch the scripts.

**Can it download content I haven't paid for?**
No. It can only reach what your logged-in account can already see. It is a convenience/backup tool, not a bypass.

**Where do files go?**
Into `SKOOL_ARCHIVE_ROOT` (or the current directory if unset). See [Output layout](#output-layout).

**Is this affiliated with Skool?**
No. This is an independent, unofficial tool. "Skool" is a trademark of its respective owner and is used here only descriptively.

