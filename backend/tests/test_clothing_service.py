import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from services import clothing_service


class ClothingServiceTests(unittest.TestCase):
    def test_validate_upload_fields_rejects_invalid_type(self):
        with self.assertRaises(HTTPException):
            clothing_service._validate_upload_fields("hat", None, None)

    def test_validate_upload_fields_requires_bottom_style_for_bottom(self):
        with self.assertRaises(HTTPException):
            clothing_service._validate_upload_fields("bottom", None, None)

    def test_validate_upload_fields_accepts_top_with_sleeve(self):
        clothing_type, sleeve_length, bottom_style = clothing_service._validate_upload_fields(
            "top", "short_sleeve", None
        )

        self.assertEqual(clothing_type, "top")
        self.assertEqual(sleeve_length, "short_sleeve")
        self.assertIsNone(bottom_style)

    def test_list_clothing_items_reads_from_database(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "test_clothing.db"
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE clothing (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT,
                    image_path TEXT,
                    color TEXT,
                    minor_color TEXT,
                    season TEXT,
                    occasion TEXT,
                    fit TEXT,
                    sleeve_length TEXT,
                    bottom_style TEXT
                )
                """
            )
            cursor.execute(
                """
                INSERT INTO clothing (type, image_path, color, minor_color, season, occasion, fit, sleeve_length, bottom_style)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "top",
                    "shirt.png",
                    "blue,white",
                    "gray",
                    "spring,summer",
                    "casual",
                    "Unisex",
                    "short_sleeve",
                    None,
                ),
            )
            conn.commit()
            conn.close()

            with patch.object(clothing_service, "CLOTHING_DB_PATH", db_path):
                items = clothing_service.list_clothing_items()

            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["type"], "top")
            self.assertEqual(items[0]["color"], ["blue", "white"])
            self.assertEqual(items[0]["minor_color"], ["gray"])


if __name__ == "__main__":
    unittest.main()
