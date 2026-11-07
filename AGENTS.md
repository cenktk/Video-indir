# Agent guide

Local toolkit that downloads and archives video and course content the user already has legitimate access to: Skool courses and posts, LinkedIn post videos, and anything `yt-dlp` supports. It also has a local web UI and optional Whisper transcripts. Read `README.md` for details; this file is the fast path for an agent.

## Set up (do this yourself)

1. `npm install`
2. `npm run doctor` and fix every `MISSING` line. Each line prints its fix. Typical fixes: `brew install yt-dlp ffmpeg`, `cp .env.example .env`.
3. In `.env`, set `SKOOL_ARCHIVE_ROOT` to a folder outside this repo. Downloads are other people's content and must never be committed.
4. Optional transcripts: `python3 -m venv .venv && .venv/bin/pip install faster-whisper`
5. `npm test` must pass before you change code.

## What needs the user

- **Login.** Skool and LinkedIn downloads use a real logged-in browser over CDP. Run `npm run launch:brave` (macOS) or start Chrome with `--remote-debugging-port=9222 --user-data-dir=...`, then ask the user to log in in that window and wait for them to confirm. Never ask for or type a password.
- **Authorisation.** Only download content the user can legitimately access, for their own offline use. If it is unclear, ask.

Plain public URLs (YouTube, Vimeo, Loom, direct mp4) need no browser and no login.

## Run

| Goal | Command |
| --- | --- |
| Web UI (paste links, queue, live log) | `npm run ui`, then open http://localhost:4747 |
| Any `yt-dlp` URL | `npm run download:url -- <url> [--folder NAME] [--audio-only]` |
| LinkedIn post or `lnkd.in` link | `node scripts/cdp_linkedin_video.js <url> --folder Videos` |
| One Skool course | `npm run download:all <course-url>` |
| Whole Skool classroom | `npm run download:everything <classroom-url>` |
| Videos in one Skool post | `npm run post:manifest <post-url>` then `SKOOL_MANIFEST=<root>/post-manifest.json npm run download:videos` |
| Transcripts for a folder | `.venv/bin/python ui/transcribe.py <folder>` |

The web UI routes a pasted URL to the right script by itself (`ui/routes.js`). Output goes to `SKOOL_ARCHIVE_ROOT`.

## Layout

- `scripts/`: the download and archive scripts (Node over CDP with Playwright, Python with `yt-dlp` and `ffmpeg`).
- `ui/`: local web UI. `server.js` (queue, SSE log), `routes.js` (URL to script), `transcribe.py`, `index.html`.
- `ui/test/`: all tests. Node tests use `node:test`, Python tests use `unittest`.

## Rules for changing code

- Keep the web server bound to `127.0.0.1` with the per-start token and Host/Origin checks. Spawn scripts with an argument array, never through a shell string.
- Network calls need a timeout. Do not add retries to writes that are not idempotent.
- Add or update a test next to any new route, option or script. `npm test` must pass.
- Chat with the user in their language; write files, comments and commit messages in English.
- Do not commit unless asked. Never commit `.env`, `out/`, `.venv/` or downloaded media.
