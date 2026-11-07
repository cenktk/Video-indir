# Video-indir

Download and archive videos you have legitimate access to, from one place: Skool courses and posts, LinkedIn post videos, and anything `yt-dlp` supports (YouTube, Vimeo, Loom, direct mp4). It has a local web UI, optional local transcripts and a setup check, and it is written so that an AI agent (Codex, Claude Code) can set it up and run it.

Everything runs on your machine. Nothing is uploaded.

## What it handles

| You paste | What happens |
| --- | --- |
| A YouTube, Vimeo, Loom or direct video link | `yt-dlp` downloads it (H.264, subtitles as `.srt`) |
| A LinkedIn post or `lnkd.in` link | Your logged-in browser reveals the video playlist, then `yt-dlp` downloads it |
| A Skool post | Its Mux videos are downloaded with subtitles |
| A Skool course or whole classroom | Videos, lesson notes and attached files |
| A Skool community feed | Archived as HTML, Markdown and JSON |

Add the **Transcript** option and each downloaded video also gets a `.txt` and a `.transcript.srt`, made locally with Whisper.

## Legal and responsible use

This project ships only tooling. It contains no course material. Use it only for content you have lawful access to, such as a course you bought or a community you belong to, and only for your own offline copy. Do not redistribute, re-upload or resell what you download. You are responsible for following each platform's terms and your local law. The authors do not endorse piracy and accept no liability for misuse.

## Quick start

```bash
npm install
npm run doctor     # checks the setup and prints a fix for anything missing
npm run ui         # then open http://localhost:4747
```

`npm run doctor` looks for Node 18+, Python 3.9+, `yt-dlp`, `ffmpeg`, `.env`, a writable download folder, the browser connection and Whisper. Only the first group is required for plain URL downloads.

Install what is missing:

```bash
brew install yt-dlp ffmpeg          # Debian/Ubuntu: sudo apt-get install ffmpeg, python3 -m pip install -U yt-dlp
cp .env.example .env                # then set SKOOL_ARCHIVE_ROOT to a folder outside this repo
```

Skool and LinkedIn also need a browser that you are logged in to (see [Browser login](#browser-login)). Plain public URLs do not.

Optional transcripts:

```bash
python3 -m venv .venv && .venv/bin/pip install faster-whisper
```

Set `WHISPER_MODEL` (default `base`) to change the model. The first run downloads it.

## Web UI

`npm run ui` starts a local page at `http://localhost:4747` (`UI_PORT` changes the port).

- Paste links, one per line. Each link is routed to the right script by itself.
- Options: quality, folder, audio only, subtitles embedded in the video, transcript.
- A queue runs one job at a time, with a live log and a cancel button. Cancel stops the whole process tree, including `yt-dlp` and `ffmpeg`.
- Skool downloads go to `<SKOOL_ARCHIVE_ROOT>/<folder>/...`. The Folder field sets that folder name.

The server listens on `127.0.0.1` only. Every request needs a token that is generated at start-up and embedded in the page, and the Host and Origin headers must be local. A website you visit cannot start downloads.

## macOS app

```bash
npm run app        # builds Video-indir.app in this folder
```

Double-click `Video-indir.app` to start the UI and open it in your browser. Double-click it again while it runs to open the page or stop the server. The server log is `~/Library/Logs/Video-indir.log`.

This is a small launcher, not a self-contained app. It needs Node, Python, `yt-dlp` and `ffmpeg` on this Mac (`npm run doctor` checks them), and it points at this checkout, so rebuild it if you move the folder. It is unsigned, which is fine for an app you built yourself. The first time, macOS may ask you to allow it in Privacy & Security.

## Using it with an AI agent

Give the repo URL to Codex or Claude Code. They read [`AGENTS.md`](AGENTS.md) (Claude Code through `CLAUDE.md`), install the tools and run `npm run doctor`. The one step an agent cannot do is logging in to Skool or LinkedIn in the browser window, so it will ask you.

## Browser login

Skool and LinkedIn scripts attach to a browser you have already logged in to, over the Chrome DevTools Protocol (CDP). They reuse your session and never see your password.

```bash
npm run launch:brave        # macOS, starts Brave with CDP on port 9222
```

Or start Chrome yourself:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.skool-archive-chrome"
```

Log in to Skool or LinkedIn in that window. If your browser uses another port, set `SKOOL_CDP_URL` in `.env`. `npm run inspect` lists the tabs, which shows that the connection works.

## Command line

```bash
npm run download:url -- <url> [--folder NAME] [--audio-only] [--embed-subs] [--short-name 40]
node scripts/cdp_linkedin_video.js <post-or-lnkd.in-url> --folder Videos
npm run download:all <course-url>
npm run download:everything <classroom-url>
npm run post:manifest <post-url>     # then: SKOOL_MANIFEST=<root>/post-manifest.json npm run download:videos
npm run archive:community <community-url>
npm run optimize:videos
```

Every script and npm command is listed in [docs/reference.md](docs/reference.md).

### Skool posts

Post videos are served by Mux and have no direct mp4 link. `post:manifest` reads the post and writes a manifest with signed playback URLs. `download:videos` then sends the referer and origin headers the tokens are bound to, merges Mux's separate audio into the mp4 and saves the Turkish and English subtitles as `.srt`. The tokens expire after about a day, so regenerate the manifest before each run.

### LinkedIn videos

`yt-dlp` cannot extract the video from a LinkedIn post page, and reading the browser's cookies for it failed on macOS because the Keychain key was not available. The page itself loads the video as a signed HLS playlist when it plays, so the script:

1. Opens the post in your CDP browser and plays the video muted.
2. Reads the master playlist URL (`https://dms.licdn.com/playlist/vid/dynamic/...`) from the page's resource timing.
3. Passes it to `download_video_url.py` with a file name built from the post URL (`<author>_<topic> [<post id>].mp4`).

I found this method with [BrowserOS neo](https://www.browseros.com) driven by Claude Code. Neo opened the post, played the video and listed the network resources, which showed that the `dynamic/` playlist is the master one. The script in this repo repeats those steps through plain CDP and does not need neo. If it prints "No video found", the post is not a video post or the browser is not reachable on `SKOOL_CDP_URL`.

## Configuration (`.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `SKOOL_ARCHIVE_ROOT` | Root folder for all downloads | current directory |
| `SKOOL_COLLECTION_NAME` | Sub-folder for Skool downloads | `Skool Community` |
| `VIDEO_QUALITY` | `720p`, `1080p` or `best` | `1080p` |
| `SKOOL_CDP_URL` | Browser CDP endpoint | `http://127.0.0.1:9222` |
| `YTDLP` | Path to `yt-dlp` | `yt-dlp` on `PATH` |
| `WHISPER_MODEL` | Whisper model for transcripts | `base` |
| `UI_PORT` | Port of the web UI | `4747` |
| `SKOOL_CLASSROOM_URL`, `SKOOL_COMMUNITY_URL` | Default URLs when none is given on the command line | none |
| `SKOOL_TEXT_ONLY`, `MAX_ATTACHMENT_MB` | Community archive: text only, attachment size limit | `0`, `30` |
| `SKOOL_MANIFEST` | Video list for `download:videos` | `./manifest.json`, then the newest `course-state.json` |

Values already set in your shell win over `.env`.

Keep downloads out of the repo. Lessons, notes and videos are other people's content and must never be committed. `.env` holds only paths and URLs, and it is git-ignored together with `out/`.

## Output layout

```
<SKOOL_ARCHIVE_ROOT>/
  Videos/                        # URL and LinkedIn downloads (+ .srt, .txt, .transcript.srt)
  <SKOOL_COLLECTION_NAME>/
    <Course or post title>/
      <Section>/01 - Lesson title (12:34).mp4
      resources/<Section>/01 - Lesson title - Notes.md, 01 - Attachment.pdf
```

## Tests

```bash
npm test
```

The suite has Node tests (URL routing, option handling, server security, queue and cancel with a fake `yt-dlp`, the LinkedIn helper, the doctor) and Python tests (transcript file selection, `yt-dlp` command building). It uses no network and no real archive folder. It does not test real Skool or LinkedIn pages.

## Credits and license

This is a hybrid built on [Lemelson/skool-video-downloader](https://github.com/Lemelson/skool-video-downloader), which includes contributions from [@damian-majewski](https://github.com/damian-majewski) (`.env` support, one-command course downloads, quality selection, Brave launcher). The web UI, LinkedIn support, transcripts, doctor and tests were added on top. Ideas such as a download queue and local transcripts were inspired by the closed-source app ID4, but no ID4 code or files are used.

Released under the [MIT License](LICENSE). Provided "as is", without warranty. This is an independent tool and is not affiliated with Skool or LinkedIn.
