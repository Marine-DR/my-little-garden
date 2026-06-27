from __future__ import annotations

import sqlite3
import unittest
from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "001_initial_schema.sql"
)
NOW = "2026-06-27T12:00:00.000Z"


class InitialSchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.db.execute("PRAGMA foreign_keys = ON")

    def tearDown(self) -> None:
        self.db.close()

    def insert_plant(
        self,
        plant_id: str = "00000000-0000-4000-8000-000000000001",
        name: str = "Rose",
        normalized_name: str = "rose",
        bloom_start: int = 5,
        bloom_end: int = 9,
        height_min: int | None = None,
        height_max: int | None = None,
        spacing: int | None = None,
    ) -> None:
        self.db.execute(
            """
            INSERT INTO plants (
                id,
                name,
                normalized_name,
                height_min_cm,
                height_max_cm,
                bloom_start_month,
                bloom_end_month,
                spacing_cm,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                plant_id,
                name,
                normalized_name,
                height_min,
                height_max,
                bloom_start,
                bloom_end,
                spacing,
                NOW,
                NOW,
            ),
        )

    def test_migration_creates_expected_tables(self) -> None:
        tables = {
            row[0]
            for row in self.db.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        self.assertEqual(
            tables,
            {
                "plant_types",
                "soil_types",
                "colors",
                "plants",
                "plant_soils",
                "plant_flower_colors",
                "plant_leaf_colors",
                "plant_exposures",
                "plant_planting_seasons",
                "plant_photos",
                "selections",
                "selection_plants",
            },
        )

    def test_plants_table_contains_the_complete_scalar_field_set(self) -> None:
        columns = {
            row[1] for row in self.db.execute("PRAGMA table_info(plants)").fetchall()
        }
        self.assertEqual(
            columns,
            {
                "id",
                "name",
                "normalized_name",
                "height_min_cm",
                "height_max_cm",
                "type_id",
                "plant_kind",
                "bloom_start_month",
                "bloom_end_month",
                "minimum_temperature_c",
                "foliage_persistence",
                "spacing_cm",
                "created_at",
                "updated_at",
            },
        )

    def test_normalized_plant_name_is_unique(self) -> None:
        self.insert_plant()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_plant(
                plant_id="00000000-0000-4000-8000-000000000002",
                name="Rosé",
                normalized_name="rose",
            )

    def test_normalized_vocabulary_labels_are_unique(self) -> None:
        self.db.execute(
            "INSERT INTO soil_types (label, normalized_label, created_at) "
            "VALUES (?, ?, ?)",
            ("Drainé", "draine", NOW),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO soil_types (label, normalized_label, created_at) "
                "VALUES (?, ?, ?)",
                ("DRAINE", "draine", NOW),
            )

    def test_month_height_and_spacing_constraints(self) -> None:
        invalid_values = (
            {"bloom_start": 0},
            {"bloom_end": 13},
            {"height_min": -1, "height_max": 10},
            {"height_min": 20, "height_max": 10},
            {"height_min": 20, "height_max": None},
            {"spacing": -1},
        )
        for index, values in enumerate(invalid_values, start=1):
            with self.subTest(values=values), self.assertRaises(
                sqlite3.IntegrityError
            ):
                self.insert_plant(
                    plant_id=f"00000000-0000-4000-8000-{index:012d}",
                    normalized_name=f"plant-{index}",
                    **values,
                )

    def test_closed_constants_and_duplicate_associations_are_rejected(self) -> None:
        self.insert_plant()
        plant_id = "00000000-0000-4000-8000-000000000001"

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO plant_exposures (plant_id, exposure_code) "
                "VALUES (?, ?)",
                (plant_id, "full_sun"),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO plant_planting_seasons (plant_id, season_code) "
                "VALUES (?, ?)",
                (plant_id, "monsoon"),
            )

        self.db.execute(
            "INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)",
            (plant_id, "sun"),
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO plant_exposures (plant_id, exposure_code) "
                "VALUES (?, ?)",
                (plant_id, "sun"),
            )

    def test_plant_delete_cascades_and_vocabulary_delete_is_restricted(self) -> None:
        self.db.execute(
            "INSERT INTO soil_types (label, normalized_label, created_at) "
            "VALUES (?, ?, ?)",
            ("Drainé", "draine", NOW),
        )
        soil_id = self.db.execute(
            "SELECT id FROM soil_types WHERE normalized_label = 'draine'"
        ).fetchone()[0]
        self.insert_plant()
        plant_id = "00000000-0000-4000-8000-000000000001"
        self.db.execute(
            "INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)",
            (plant_id, soil_id),
        )
        self.db.execute(
            "INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)",
            (plant_id, "sun"),
        )

        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM soil_types WHERE id = ?", (soil_id,))

        self.db.execute("DELETE FROM plants WHERE id = ?", (plant_id,))
        self.assertEqual(
            self.db.execute("SELECT count(*) FROM plant_soils").fetchone()[0],
            0,
        )
        self.assertEqual(
            self.db.execute("SELECT count(*) FROM plant_exposures").fetchone()[0],
            0,
        )

    def test_failed_graph_write_rolls_back_every_table(self) -> None:
        try:
            with self.db:
                self.db.execute(
                    "INSERT INTO soil_types "
                    "(label, normalized_label, created_at) VALUES (?, ?, ?)",
                    ("Argileux", "argileux", NOW),
                )
                self.insert_plant()
                self.db.execute(
                    "INSERT INTO plant_exposures (plant_id, exposure_code) "
                    "VALUES (?, ?)",
                    (
                        "00000000-0000-4000-8000-000000000001",
                        "unsupported",
                    ),
                )
        except sqlite3.IntegrityError:
            pass
        else:
            self.fail("Invalid exposure should have aborted the transaction")

        self.assertEqual(self.db.execute("SELECT count(*) FROM plants").fetchone()[0], 0)
        self.assertEqual(
            self.db.execute("SELECT count(*) FROM soil_types").fetchone()[0], 0
        )

    def test_catalog_has_no_application_defined_entry_limit(self) -> None:
        total = 50_000
        self.db.execute(
            "INSERT INTO soil_types (label, normalized_label, created_at) "
            "VALUES ('Drainé', 'draine', ?)",
            (NOW,),
        )
        soil_id = self.db.execute(
            "SELECT id FROM soil_types WHERE normalized_label = 'draine'"
        ).fetchone()[0]

        plants = (
            (
                f"00000000-0000-4000-8000-{index:012x}",
                f"Plant {index}",
                f"plant {index}",
                1,
                12,
                NOW,
                NOW,
            )
            for index in range(total)
        )
        self.db.executemany(
            """
            INSERT INTO plants (
                id, name, normalized_name, bloom_start_month, bloom_end_month,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            plants,
        )

        plant_ids = (
            (f"00000000-0000-4000-8000-{index:012x}", soil_id)
            for index in range(total)
        )
        self.db.executemany(
            "INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)",
            plant_ids,
        )
        exposure_ids = (
            (f"00000000-0000-4000-8000-{index:012x}", "sun")
            for index in range(total)
        )
        self.db.executemany(
            "INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)",
            exposure_ids,
        )

        self.assertEqual(
            self.db.execute("SELECT count(*) FROM plants").fetchone()[0], total
        )
        page = self.db.execute(
            "SELECT id FROM plants ORDER BY normalized_name LIMIT 25 OFFSET ?",
            (total - 25,),
        ).fetchall()
        self.assertEqual(len(page), 25)


if __name__ == "__main__":
    unittest.main()
