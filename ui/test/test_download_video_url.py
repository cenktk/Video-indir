import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from download_video_url import build_command, output_template, quality_format  # noqa: E402

OUT = Path("/tmp/out")
MUX = "https://stream.mux.com/abc.m3u8"
YT = "https://youtu.be/x"


def cmd(url=YT, audio=False, subs=False, short=0, quality=None):
    env = {"VIDEO_QUALITY": quality} if quality else {}
    with mock.patch.dict(os.environ, env):
        if not quality:
            os.environ.pop("VIDEO_QUALITY", None)
        return build_command(url, OUT, audio, subs, short)


class QualityAndTemplate(unittest.TestCase):
    def test_quality_format(self):
        self.assertIn("height<=720", quality_format("720p"))
        self.assertNotIn("height<=1080", quality_format("720p"))
        self.assertIn("height<=1080", quality_format("1080p"))
        self.assertNotIn("height<=", quality_format("best"))
        self.assertTrue(quality_format("best").startswith("bv*"))

    def test_output_template(self):
        self.assertEqual(output_template(), "%(title).150B [%(id)s].%(ext)s")
        self.assertEqual(output_template(0), output_template())
        self.assertEqual(output_template(40), "%(title).40B [%(id)s].%(ext)s")


class BuildCommand(unittest.TestCase):
    def test_mux_gets_referer_and_origin_only_for_mux(self):
        c = cmd(MUX)
        self.assertIn("--referer", c)
        self.assertTrue(any(a.startswith("Origin:") for a in c))
        c = cmd(YT)
        self.assertNotIn("--referer", c)
        self.assertFalse(any(a.startswith("Origin:") for a in c))

    def test_embed_subs_only_when_asked(self):
        self.assertIn("--embed-subs", cmd(subs=True))
        self.assertNotIn("--embed-subs", cmd())

    def test_audio_vs_video(self):
        a = cmd(audio=True)
        self.assertEqual(a[a.index("--audio-format") + 1], "m4a")
        self.assertIn("-x", a)
        self.assertNotIn("-f", a)
        v = cmd(quality="720p")
        self.assertEqual(v[v.index("-f") + 1], quality_format("720p"))
        self.assertNotIn("-x", v)

    def test_always_no_playlist_and_url_last(self):
        for kw in ({}, {"audio": True}, {"url": MUX, "subs": True}):
            c = cmd(**kw)
            self.assertIn("--no-playlist", c)
            self.assertEqual(c[-1], kw.get("url", YT))

    def test_fixed_name_replaces_title_and_is_escaped(self):
        self.assertEqual(output_template(0, "my video [1]"), "my video [1].%(ext)s")
        self.assertEqual(output_template(40, "a"), "a.%(ext)s")  # name wins over short-name
        self.assertEqual(output_template(0, "100% a/b"), "100%% a-b.%(ext)s")

    def test_name_reaches_command(self):
        c = build_command("https://x/y", OUT, False, False, 0, "my video")
        self.assertEqual(c[c.index("-o") + 1], "my video.%(ext)s")

    def test_short_name_reaches_output_template(self):
        c = cmd(short=40)
        self.assertEqual(c[c.index("-o") + 1], output_template(40))


if __name__ == "__main__":
    unittest.main()
