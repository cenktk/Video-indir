# Skool Video Downloader & Course Archiver

> A command-line toolkit to **download and back up your own Skool videos, lessons, attached files, and community posts** for offline access — built on the Chrome DevTools Protocol (CDP), Playwright, `yt-dlp`, and `ffmpeg`.

**Keywords:** skool downloader, download skool videos, skool video downloader, skool course downloader, backup skool classroom, archive skool community, save skool lessons offline, skool export tool.

---

## About

**Skool Video Downloader** is an open-source set of scripts for creating a personal, offline backup of course material and community content on [Skool](https://www.skool.com) that **you already have legitimate access to** — for example a course you purchased or a community you are a paying member of.

It drives a real, logged-in Brave or Chrome session over the Chrome DevTools Protocol (CDP), so it uses *your own* authenticated session and never asks for or stores your password. It can:

- Read the classroom/course structure and list all courses and lessons you can access.
- Download one course or every course in a classroom with a single command.
- Download videos (Wistia, Mux, YouTube, and anything else `yt-dlp` supports, e.g. Loom or Vimeo) in the quality you choose (`720p`, `1080p`, `best`).
- Save the subtitles that ship with a Mux video as `.srt` files next to it.
- Download lesson notes/descriptions and attached files (PDFs, Google Drive links).
- Archive community feed posts you can see into clean local HTML/Markdown/JSON for offline reading.
- Re-encode large videos to a sensible size to save disk space.

Everything runs locally on your machine. Nothing is uploaded anywhere.

---

## ⚖️ Legal & responsible use — read this first

This project ships **only the tooling** (source code). It does **not** contain, host, or distribute any copyrighted course material, videos, transcripts, or other people's content.

By using these scripts you agree that:

- You will only download or archive content you have **lawful, authorized access to** — e.g. a course you paid for or a community you are a member of.
- You will use any downloaded material **for your own personal, offline use only** (a private backup).
- You will **not** redistribute, re-upload, resell, publicly share, or otherwise infringe the copyright of course creators or community members.
- You are solely responsible for complying with Skool's Terms of Service, the rights of content creators, and the laws of your jurisdiction.

A downloader is a neutral tool — much like `yt-dlp` or a browser's "Save As". How you use it is your responsibility. If you are a course creator and don't want members to keep offline copies, that is a matter between you and your members and their agreement with the platform. **The authors of this project do not endorse piracy and accept no liability for misuse.**

---

## Requirements

- **[Node.js](https://nodejs.org/) 18+** (for the `.js` archiver scripts)
- **[Python](https://www.python.org/) 3.9+** (for the `.py` download/encode helpers)
- **[Brave](https://brave.com/)** or **[Google Chrome](https://www.google.com/chrome/)** (used in remote-debugging mode)
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** on your `PATH` (or set `YTDLP`)
- **[ffmpeg](https://ffmpeg.org/) / ffprobe** (for muxing and re-encoding)

Install the toolchain:

```bash
# Node dependencies (Playwright, dotenv)
npm install

# yt-dlp (or: brew install yt-dlp)
python3 -m pip install -U yt-dlp

# ffmpeg (macOS)
brew install ffmpeg
# ffmpeg (Debian/Ubuntu)
sudo apt-get install ffmpeg
```

---

## ⚙️ Configuration (`.env`)

Copy `.env.example` to `.env` in the project root and fill in what you need. All Node and Python scripts read it automatically; variables already set in your shell take priority, and empty values fall back to the defaults. `~` and `$HOME` at the start of a path are expanded.

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
| --- | --- | --- |
| `SKOOL_ARCHIVE_ROOT` | Root folder where archives/downloads are written | current directory |
| `SKOOL_COLLECTION_NAME` | Sub-folder under the root for this community | `Skool Community` |
| `SKOOL_CLASSROOM_URL` | Classroom or course URL (used when no URL is passed on the command line) | — |
| `SKOOL_COMMUNITY_URL` | Community feed URL to archive | — |
| `VIDEO_QUALITY` | `720p`, `1080p`, or `best` (highest available). Also sets the target size for `optimize:videos` | `1080p` |
| `SKOOL_CDP_URL` | Browser CDP endpoint the scripts attach to | `http://127.0.0.1:9222` |
| `YTDLP` | Path to the `yt-dlp` binary | `yt-dlp` on `PATH` |
| `SKOOL_TEXT_ONLY` | Community archive: `1` = text only, `0` = also download media | `0` |
| `MAX_ATTACHMENT_MB` | Community archive: skip attachments bigger than this | `30` |
| `SKOOL_MANIFEST` | Video list for `download:videos` (see below) | `./manifest.json`, then the newest `course-state.json` |

Most scripts also accept the relevant URL as a command-line argument, which takes priority over `.env`.

> **Keep downloads out of the repo.** Point `SKOOL_ARCHIVE_ROOT` at a folder outside this checkout (the example uses `~/Downloads/Skool-Backup`). Downloaded lessons, notes and posts are other people's content and must never be committed or pushed; `.gitignore` covers the default locations, but a custom folder inside the repo would not be ignored. `.env` itself only holds paths and URLs (no passwords or cookies) and is git-ignored too.

---

## 🌐 Start the browser with remote debugging

The scripts attach to an already-running, logged-in browser via CDP on port `9222`. Start it with a separate profile and **log in to Skool normally** in that window.

### Brave (macOS)

```bash
npm run launch:brave
```

This runs [`scripts/launch_brave_cdp.sh`](scripts/launch_brave_cdp.sh). It takes an optional port (`bash scripts/launch_brave_cdp.sh 9223`; then set `SKOOL_CDP_URL` to match), uses `~/.skool-archive-brave` as the profile (override with `SKOOL_BRAVE_PROFILE`), and looks for Brave in `/Applications` (override with `BRAVE_PATH`).

To run it from anywhere, add an alias to `~/.zshrc` (or `~/.bashrc`):

```bash
alias brave-cdp="bash /path/to/skool-video-downloader/scripts/launch_brave_cdp.sh"
```

### Chrome

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir="$HOME/.skool-archive-chrome"

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.skool-archive-chrome"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.skool-archive-chrome"
```

Check the connection with `npm run inspect`.

---

## 🎯 Usage

### Download one course (videos + notes + attachments)

```bash
npm run download:all https://www.skool.com/<community>/classroom/<courseId>
```

This runs three steps: fetch the course structure (`course:state`), download lesson notes and attached files (`download:details`), then download the videos (`download:videos`). Without a URL it uses `SKOOL_CLASSROOM_URL`.

### Download every course in a classroom

```bash
npm run download:everything https://www.skool.com/<community>/classroom
```

Lists all courses in the classroom and runs `download:all` for each one. A course that fails is reported at the end and doesn't stop the others. Re-running skips videos that are already downloaded and verified.

### Step by step

```bash
npm run inspect                                    # 0) confirm the CDP connection
npm run course:state <course-url>                  # 1) dump the course tree to course-state.json
npm run download:details <course-url>              # 2) lesson notes + attached files
npm run download:videos                            # 3) videos, using VIDEO_QUALITY
```

`download:videos` reads, in order: the path you pass, `SKOOL_MANIFEST`, `./manifest.json`, and finally the newest `course-state.json` / `lesson-details.json` under the archive. A hand-written manifest uses the format in [`scripts/manifest.example.json`](scripts/manifest.example.json).

### Using this with an AI agent

Give the repo URL to Codex or Claude Code. They read [`AGENTS.md`](AGENTS.md) (Claude Code via `CLAUDE.md`), install the tools and run `npm run doctor` to check the setup. The one step an agent cannot do is logging in to Skool or LinkedIn in the CDP browser, so it will ask you to.

### Local web UI

```bash
npm run ui    # then open http://localhost:4747
```

Paste links (one per line) and the UI routes each one: a classroom, course, community post or feed goes to the matching Skool script; anything else goes to `yt-dlp`. It has a queue with cancel, a live log and options for quality, folder, audio only and embedded subtitles. It binds to `127.0.0.1` only and requires a per-start token.

Optional local transcripts (`.txt` and `.transcript.srt`, URL downloads only):

```bash
python3 -m venv .venv && .venv/bin/pip install faster-whisper
```

Set `WHISPER_MODEL` (default `base`) to change the model. Tests: `npm test`.

### Download a YouTube video (or any other supported URL)

```bash
npm run download:url -- https://www.youtube.com/watch?v=<id>
npm run download:url -- <url-1> <url-2> --folder "Extra Videos"
npm run download:url -- https://www.youtube.com/watch?v=<id> --audio-only
npm run download:url -- https://www.youtube.com/watch?v=<id> --embed-subs
npm run download:url -- <url> --short-name 40
```

Any URL `yt-dlp` understands works here: YouTube, Loom, Vimeo, a direct mp4, or a Mux link copied from a Skool post. Files land in `<SKOOL_ARCHIVE_ROOT>/<folder>/` and keep their own title. H.264 is preferred so the result plays in QuickTime and other players, and the Turkish and English subtitles are saved as `.srt` next to the video when the source has them.

`--embed-subs` writes one file instead: the subtitles go inside the mp4 as a selectable text track, and the separate `.srt` files are removed.

`--short-name` keeps the title to 60 characters by default, or to the number you pass (`--short-name 40`). The video id always stays in the name, so files never collide.

### Download a LinkedIn post video

```bash
node scripts/cdp_linkedin_video.js https://lnkd.in/p/<code> --folder Videos
```

`lnkd.in` short links and `linkedin.com/posts/...` links also work when pasted into the web UI.

`yt-dlp` cannot extract the video from a LinkedIn post page (it reports "Unable to extract video"), and reading the browser's cookies for it failed on macOS because the Keychain key was not available. The page does load the video as a signed HLS playlist when it plays, so the script uses that:

1. It opens the post in your CDP browser (the same one as for Skool) and plays the video muted.
2. It reads the master playlist URL (`https://dms.licdn.com/playlist/vid/dynamic/...`) from the page's resource timing.
3. It passes that URL to `download_video_url.py`, with a file name built from the post URL (`<author>_<topic> [<post id>].mp4`).

I found this method with [BrowserOS neo](https://www.browseros.com) driven by Claude Code: neo opened the post, played the video and listed the network resources, which showed that the `dynamic/` playlist is the master one. The script in this repo does the same steps through plain CDP and does not need neo. If it reports "No video found", the post is not a video post or the browser is not reachable on `SKOOL_CDP_URL`.

### Download the videos inside a community post

```bash
npm run post:manifest https://www.skool.com/<community>/<post-slug>
SKOOL_MANIFEST="$HOME/Downloads/Skool-Backup/post-manifest.json" npm run download:videos
```

Post videos are served by Mux and have no direct mp4 link. `post:manifest` reads the post and writes a manifest holding the signed Mux playback URLs. `download:videos` then:

- sends the Skool referer and origin headers the tokens are bound to,
- merges Mux's separate audio rendition into the mp4, so the file has sound,
- writes the Turkish and English subtitles as `.srt` files next to each video.

### Archive the community feed

```bash
npm run archive:community https://www.skool.com/<community>
npm run archive:post https://www.skool.com/<community>/<post-slug>
```

### Shrink downloaded videos

```bash
npm run optimize:videos
```

Re-encodes videos above the target size (1920×1080, or 1280×720 with `VIDEO_QUALITY=720p`) or with a very high bitrate. The original is kept if the re-encode isn't smaller.

### Output layout

```
<SKOOL_ARCHIVE_ROOT>/
  course-state.json, lesson-details.json      # last fetched course (working files)
  <SKOOL_COLLECTION_NAME>/
    <Course title>/
      course-state.json, lesson-details.json
      <Section>/01 - Lesson title (12:34).mp4
      resources/<Section>/01 - Lesson title - Notes.md, 01 - Attachment.pdf
```

Videos and their notes share the same lesson number.

---

## 📜 npm scripts

| Command | Action |
| --- | --- |
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
| `scripts/launch_brave_cdp.sh` | Launch Brave with remote debugging (macOS). |

---

## How it works

1. You log in to Skool in a normal Brave/Chrome window that was started with `--remote-debugging-port=9222`.
2. The scripts attach to that window over the Chrome DevTools Protocol (`http://127.0.0.1:9222`) — they reuse **your** session, so there are no credentials to store.
3. For structured data, they read the page's embedded `__NEXT_DATA__` JSON. For media, they observe network requests to find the real video/manifest URLs.
4. Downloads are performed with your session; YouTube-hosted and other embedded media is fetched with `yt-dlp` and muxed with `ffmpeg`.
5. Community posts are converted into clean, self-contained local HTML/Markdown/JSON.

---

## FAQ

**Does this need my Skool password?**
No. It attaches to a browser window where *you* are already logged in. Credentials never touch the scripts.

**Can it download content I haven't paid for?**
No. It can only reach what your logged-in account can already see. It is a convenience/backup tool, not a bypass.

**Where do files go?**
Into `SKOOL_ARCHIVE_ROOT` (or the current directory if unset). See [Output layout](#output-layout).

**Is this affiliated with Skool?**
No. This is an independent, unofficial tool. "Skool" is a trademark of its respective owner and is used here only descriptively.

---

## Contributors

Thanks to [@damian-majewski](https://github.com/damian-majewski) for `.env` support, the one-command course/classroom downloads, video quality selection, and the Brave launcher.

## License

Released under the [MIT License](LICENSE). Provided "as is", without warranty of any kind. You are responsible for how you use it.
