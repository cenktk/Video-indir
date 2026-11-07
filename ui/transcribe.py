#!/usr/bin/env python3
"""Transcribe media files in a folder with faster-whisper (local, no upload).

Usage: transcribe.py <folder> [--since EPOCH] [--model base]
Searches subfolders too. Writes <name>.txt and <name>.transcript.srt next to each media file modified since EPOCH.
"""
import argparse
import os
import sys
from pathlib import Path

MEDIA = {".mp4", ".m4a", ".mkv", ".webm", ".mov", ".mp3"}


def srt_time(t: float) -> str:
    ms = int(t * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--since", type=float, default=0)
    ap.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base"))
    a = ap.parse_args()
    files = [p for p in Path(a.folder).rglob("*") if p.suffix.lower() in MEDIA and p.stat().st_mtime >= a.since
             and not p.with_suffix(".transcript.srt").exists()]
    if not files:
        print("[INFO] No new media to transcribe.")
        return 0
    from faster_whisper import WhisperModel  # imported late: the model download is slow

    model = WhisperModel(a.model, compute_type="int8")
    for f in files:
        print(f"[TRANSCRIBING] {f.name}", flush=True)
        # vad_filter drops silence; segments stream, so long videos do not pile up in memory.
        segments, info = model.transcribe(str(f), vad_filter=True)
        txt, srt = [], []
        for i, s in enumerate(segments, 1):
            txt.append(s.text.strip())
            srt.append(f"{i}\n{srt_time(s.start)} --> {srt_time(s.end)}\n{s.text.strip()}\n")
        f.with_suffix(".txt").write_text("\n".join(txt), encoding="utf-8")
        f.with_suffix(".transcript.srt").write_text("\n".join(srt), encoding="utf-8")
        print(f"[OK] {f.name} ({info.language})", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
