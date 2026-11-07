import os
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(HERE / "scripts"))

# The module reads the archive root when it is imported.
TMP = tempfile.mkdtemp()
os.environ["SKOOL_ARCHIVE_ROOT"] = TMP
os.environ["SKOOL_COLLECTION_NAME"] = "Coll"

import download_accessible_videos as dav  # noqa: E402

ROOT = (Path(TMP) / "Coll").resolve()


def inside(p: Path) -> bool:
    return ROOT in p.resolve().parents


class SafeName(unittest.TestCase):
    EVIL = ["..", ".", "...", "../..", "../../etc/passwd", "..\\..\\x", "/etc/passwd", " .. ", "./.."]

    def test_safe_name_never_returns_a_separator_or_dot_component(self):
        for e in self.EVIL:
            n = dav.safe_name(e)
            self.assertNotIn("/", n, e)
            self.assertNotIn("\\", n, e)
            self.assertNotIn(n, (".", ".."), e)

    def test_course_dir_name_falls_back(self):
        self.assertEqual(dav.course_dir_name(".."), "Course Material")
        self.assertEqual(dav.course_dir_name(""), "Course Material")
        self.assertEqual(dav.course_dir_name("a/b\\c"), "a-b-c")

    def test_normal_names_unchanged(self):
        self.assertEqual(dav.course_dir_name("Masterclass 5 - GEO"), "Masterclass 5 - GEO")
        self.assertEqual(dav.safe_name("Video 1"), "Video 1")

    def test_target_path_stays_inside_archive(self):
        for e in self.EVIL:
            for item in (
                {"index": 1, "title": e, "section": e, "courseTitle": ""},
                {"index": 1, "title": e, "section": e, "courseTitle": e},
                {"index": 1, "title": "t", "section": e, "courseTitle": "Course"},
                {"index": 1, "title": "t", "section": "S", "courseTitle": e, "duration": "1:00"},
            ):
                p = dav.target_path(item)
                self.assertTrue(inside(p), f"{item} -> {p}")


if __name__ == "__main__":
    unittest.main()
