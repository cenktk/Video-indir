# Handoff: Video-indir (hybrid)

Last updated: 2026-11-07
Repo: https://github.com/cenktk/Video-indir (public, branch `main`)
Upstream: https://github.com/Lemelson/skool-video-downloader (MIT, with contributions from damian-majewski)

## What this is

The Skool downloader scripts plus a local web UI, LinkedIn video support, optional Whisper transcripts, a setup check (`npm run doctor`), agent instructions (`AGENTS.md`) and tests. `README.md` explains usage; `AGENTS.md` is the fast path for an agent.

It was split out of a working copy of the upstream fork. The original folder was restored to its last upstream-based commit. The hybrid work also exists on the branch `backup/hybrid-work` of that original clone.

## State

- `npm test` passes: 43 Node tests and 17 Python tests, no network, no real archive folder.
- `npm run doctor` passes on the author's machine.
- The first commit is `5699862`. Everything after it is described in git history.

## How the pieces fit

- `mac/build-app.sh` (`npm run app`) builds `Video-indir.app`, a bash launcher: starts `ui/server.js` through a login shell, logs to `~/Library/Logs/Video-indir.log`, opens the page. Opening it again offers Open or Stop. It is not self-contained and not signed.
- `ui/routes.js` maps a pasted URL to a list of steps (child processes). `ui/server.js` runs them one job at a time and streams the log over SSE. Cancel kills the whole process group.
- Skool and LinkedIn scripts attach to a logged-in browser over CDP (`SKOOL_CDP_URL`). Plain URLs go to `scripts/download_video_url.py` (`yt-dlp`).
- `scripts/cdp_linkedin_video.js` plays the post video in the CDP browser, reads the master HLS playlist URL (`dms.licdn.com/playlist/vid/dynamic/...`) from resource timing, then calls `download_video_url.py --name <post name>`. The method was found with BrowserOS neo driven by Claude Code; the script uses plain CDP.
- `ui/transcribe.py` runs `faster-whisper` from `.venv`, searches subfolders and skips files that already have a `.transcript.srt`.

## Verified

| Check | Result |
| --- | --- |
| Plain URL download through the UI | works (short public YouTube video) |
| Skool post through the UI with transcript | works: mp4, Skool `.tr.srt`, `.txt`, `.transcript.srt` in the chosen folder |
| LinkedIn `lnkd.in` link through the UI | works: 720p mp4 with audio, readable file name |
| Cancel during a download | the process group dies, no `yt-dlp` left behind |
| Whisper | works with the `tiny` model only |

## Not verified

- Whisper with the default `base` model, and transcript quality. `tiny` makes visible spelling errors.
- Skool courses and whole classrooms through the UI. Only a single post was run end to end.
- LinkedIn: only one video post. Posts without video, deleted posts and posts that need login are untested.
- The UI on a phone-width screen.
- A fresh machine: doctor and `AGENTS.md` were never run by another person or by Codex.
- The launcher from Finder (double-click). It was tested only by running the launcher with a minimal environment, not through LaunchServices.
- Windows and Linux. `launch_brave_cdp.sh` only knows the macOS Brave path.

## Known issues

Fixed: path traversal through `..` in lesson, section and course names. All Node scripts now share `scripts/safe_name.js` (a test fails if a script defines its own copy), and `download_accessible_videos.py` strips leading dots and backslashes the same way. File extensions are not affected, because `path.extname` only reads the last path segment.

- Mux playback tokens expire in about a day. Regenerate the manifest before each run.
- `is_valid_video()` in `scripts/download_accessible_videos.py` treats a video shorter than 10 seconds or smaller than 1 MB as corrupt, so a genuinely short video is deleted and downloaded again on every run.
- The UI folder name is sanitised, but the Skool scripts read `SKOOL_COLLECTION_NAME` from the environment as given.
- `--short-name` is supported by the CLI and the server but has no input in the UI.
- With Python 3.9, `faster-whisper` prints numpy overflow warnings. They did not affect the output in tests.
- The UI shows a Brave launch button only when CDP is unreachable. It cannot tell whether the browser is logged in to Skool or LinkedIn. `doctor` cannot either.
- `package-lock.json` is git-ignored (inherited from the fork), so installs are not pinned.

## Next steps

1. Run `npm run doctor` and `npm test` on a second machine, ideally through Codex or Claude Code starting from `AGENTS.md`.
2. Try a whole Skool course through the UI with transcripts on.
3. Decide on `package-lock.json` and on the LICENSE copyright line (currently the upstream author only).
4. Add the `--short-name` input to the UI if wanted.

## Rules to keep

- The web server stays on `127.0.0.1` with the per-start token and the Host/Origin checks.
- Child processes are started with argument arrays, never through a shell string.
- Network calls need timeouts. Do not add retries to non-idempotent writes.
- Never commit `.env`, `out/`, `.venv/` or downloaded media.
- Chat in the user's language. Write files, comments and commits in English.
