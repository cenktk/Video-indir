#!/usr/bin/env python3
"""Download one or more video URLs into the archive root.

Works for YouTube and anything else yt-dlp supports (Loom, Vimeo, direct mp4,
and Mux links taken from a Skool post). Each video keeps its own title and gets
the Turkish and English subtitles as .srt files when the source has them.

Usage:
    python3 download_video_url.py <url> [<url> ...] [--folder NAME] [--audio-only]

Environment:
    SKOOL_ARCHIVE_ROOT  Root output folder (default: current directory).
    VIDEO_QUALITY       720p, 1080p (default) or best.
    YTDLP               Path to yt-dlp (default: yt-dlp on PATH).
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

from skool_env import load_env, video_quality

# Mux tokens issued by Skool are bound to the Skool origin.
SKOOL_ORIGIN = "https://www.skool.com"
SKOOL_REFERER = SKOOL_ORIGIN + "/"
SUBTITLE_LANGS = "tr,en"
DEFAULT_FOLDER = "Videos"


def quality_format(quality: str) -> str:
    """yt-dlp format selector for the requested quality."""
    if quality == "best":
        return "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b"
    height = 720 if quality == "720p" else 1080
    return (
        f"bv*[height<={height}][ext=mp4]+ba[ext=m4a]"
        f"/b[height<={height}][ext=mp4]"
        f"/bv*[height<={height}]+ba/b[height<={height}]/b"
    )


def output_template(short_name: int = 0, name: str = "") -> str:
    """yt-dlp output template: title (truncated) plus the video id, or a fixed name."""
    if name:
        # Used when the source's own title is useless (e.g. a signed CDN playlist URL).
        return name.replace("%", "%%").replace("/", "-") + ".%(ext)s"
    if short_name:
        return f"%(title).{short_name}B [%(id)s].%(ext)s"
    return "%(title).150B [%(id)s].%(ext)s"


def build_command(
    url: str, out_dir: Path, audio_only: bool, embed_subs: bool, short_name: int = 0, name: str = ""
) -> list:
    cmd = [
        os.environ.get("YTDLP") or "yt-dlp",
        "--no-playlist",
        "--merge-output-format",
        "mp4",
        "-P",
        str(out_dir),
        "-o",
        output_template(short_name, name),
        # Prefer H.264 when it exists: AV1 plays badly in QuickTime and older players.
        "--format-sort",
        "vcodec:h264,res,acodec:m4a",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        SUBTITLE_LANGS,
        "--convert-subs",
        "srt",
    ]
    if embed_subs:
        # Embedding needs a text subtitle format the container accepts, and yt-dlp
        # removes the temporary .srt files once they are inside the mp4.
        cmd += ["--embed-subs"]
    if "stream.mux.com" in url:
        cmd += ["--referer", SKOOL_REFERER, "--add-header", f"Origin:{SKOOL_ORIGIN}"]
    if audio_only:
        cmd += ["-x", "--audio-format", "m4a"]
    else:
        cmd += ["-f", quality_format(video_quality())]
    cmd.append(url)
    return cmd


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download video URLs into the archive root with yt-dlp."
    )
    parser.add_argument("urls", nargs="+", help="One or more video URLs.")
    parser.add_argument(
        "--folder",
        default=DEFAULT_FOLDER,
        help=f"Sub-folder under SKOOL_ARCHIVE_ROOT (default: {DEFAULT_FOLDER}).",
    )
    parser.add_argument(
        "--audio-only",
        action="store_true",
        help="Extract the audio track to .m4a instead of downloading the video.",
    )
    parser.add_argument(
        "--embed-subs",
        action="store_true",
        help="Embed the subtitles into the mp4 as a selectable track instead of "
        "writing separate .srt files next to it.",
    )
    parser.add_argument(
        "--short-name",
        nargs="?",
        const=60,
        default=0,
        type=int,
        metavar="CHARS",
        help="Keep the title to CHARS characters (default 60) and drop the rest. "
        "The video id stays in the name, so files remain unique.",
    )
    parser.add_argument(
        "--name",
        default="",
        help="Use this file name (without extension) instead of the source title. "
        "Only for a single URL.",
    )
    args = parser.parse_args()
    if args.name and len(args.urls) != 1:
        parser.error("--name works with exactly one URL")

    load_env()
    root = Path(os.environ.get("SKOOL_ARCHIVE_ROOT") or Path.cwd())
    out_dir = root / args.folder
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] Saving to: {out_dir}")
    failed = []
    for url in args.urls:
        print(f"[DOWNLOADING] {url}")
        subs_before = set(out_dir.glob("*.srt"))
        proc = subprocess.run(
            build_command(
                url,
                out_dir,
                args.audio_only,
                args.embed_subs,
                max(args.short_name, 10) if args.short_name else 0,
                args.name,
            )
        )
        if proc.returncode == 0 and args.embed_subs:
            # yt-dlp leaves the converted .srt behind after embedding. The flag
            # promises a single file, so drop only the subtitles this run created.
            for leftover in set(out_dir.glob("*.srt")) - subs_before:
                leftover.unlink()
        if proc.returncode != 0:
            print(f"[ERROR] Download failed: {url}")
            failed.append(url)
        else:
            print(f"[OK] {url}")

    if failed:
        print(f"[DONE] {len(failed)} of {len(args.urls)} URL(s) failed:")
        for url in failed:
            print(f"  - {url}")
        return 1
    print(f"[SUCCESS] {len(args.urls)} URL(s) downloaded to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
