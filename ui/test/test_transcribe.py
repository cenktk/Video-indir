import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import transcribe  # noqa: E402


class SrtTime(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(transcribe.srt_time(0), "00:00:00,000")
        self.assertEqual(transcribe.srt_time(61.5), "00:01:01,500")
        self.assertEqual(transcribe.srt_time(3725.042), "01:02:05,042")


class Selection(unittest.TestCase):
    """The script must exit before importing the model when there is nothing to do."""

    def run_script(self, folder, *extra):
        env = {k: v for k, v in os.environ.items()}
        # If it tried to load the model it would fail here, which the assertions catch.
        return subprocess.run([sys.executable, str(HERE / "transcribe.py"), str(folder), *extra],
                              capture_output=True, text=True, env=env)

    def test_empty_folder(self):
        with tempfile.TemporaryDirectory() as d:
            r = self.run_script(d)
            self.assertEqual(r.returncode, 0)
            self.assertIn("No new media", r.stdout)

    def test_skips_already_transcribed_including_subfolders(self):
        with tempfile.TemporaryDirectory() as d:
            sub = Path(d) / "a" / "b"
            sub.mkdir(parents=True)
            (sub / "v.mp4").write_bytes(b"x")
            (sub / "v.transcript.srt").write_text("done")
            self.assertIn("No new media", self.run_script(d).stdout)

    def test_ignores_non_media_and_old_files(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "notes.txt").write_text("x")
            (Path(d) / "old.mp4").write_bytes(b"x")
            self.assertIn("No new media", self.run_script(d, "--since", str(time.time() + 100)).stdout)


if __name__ == "__main__":
    unittest.main()
