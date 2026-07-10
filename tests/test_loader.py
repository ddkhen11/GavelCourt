"""Loader tests: RS-only filter, deterministic trade dedup, position parsing.

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import os
import sqlite3
import unittest

import factories  # noqa: F401  (sys.path bootstrap)

import db as database
import loader

RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "server", "data", "nba_stats.db")


class TestNormalizePosition(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(loader._normalize_position("PG"), "PG")
        self.assertEqual(loader._normalize_position("PG/SG"), "PG")
        self.assertEqual(loader._normalize_position("C-F"), "C")
        self.assertEqual(loader._normalize_position("F"), "SF")
        self.assertEqual(loader._normalize_position("G"), "SG")
        self.assertEqual(loader._normalize_position(" sf "), "SF")

    def test_unknown_or_missing_fails_loudly(self):
        for bad in (None, "", "nan", "X", "QB"):
            with self.assertRaises(ValueError):
                loader._normalize_position(bad)


@unittest.skipUnless(os.path.exists(RAW), "raw stats db not present")
class TestLoadPlayerSeasons(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._saved_db = database._db
        self.db = await database.init_db(":memory:")

    async def asyncTearDown(self):
        await self.db.close()
        database._db = self._saved_db

    async def test_rs_only_deterministic_load(self):
        count = await loader.load_player_seasons(self.db)

        raw = sqlite3.connect(RAW)
        expected_ids = raw.execute(
            "SELECT COUNT(DISTINCT lower(replace(player_name,' ','_'))||'_'||season)"
            " FROM raw_stats WHERE type='RS' AND rapm_total >= 3.5"
        ).fetchone()[0]
        # A playoff-only qualifier (PO >= floor, no RS row >= floor) must not load
        po_only = raw.execute(
            "SELECT player_name, season FROM raw_stats r WHERE type='PO' AND rapm_total >= 3.5"
            " AND NOT EXISTS (SELECT 1 FROM raw_stats r2 WHERE r2.type='RS'"
            "   AND r2.player_name=r.player_name AND r2.season=r.season AND r2.rapm_total >= 3.5)"
            " LIMIT 1"
        ).fetchone()
        raw.close()

        self.assertEqual(count, expected_ids)
        rows = await self.db.execute_fetchall("SELECT COUNT(*) FROM player_seasons")
        self.assertEqual(rows[0][0], count)

        if po_only is not None:
            pid = loader._make_player_id(po_only[0], po_only[1])
            missing = await self.db.execute_fetchall(
                "SELECT 1 FROM player_seasons WHERE player_id=?", (pid,)
            )
            self.assertEqual(missing, [])

        # Traded player-season keeps the strongest line, deterministically
        knight = await self.db.execute_fetchall(
            "SELECT team, laker_score FROM player_seasons WHERE player_id='brevin_knight_2004'"
        )
        self.assertEqual([tuple(r) for r in knight], [("PHO", 5.2)])

        # Reload produces the identical table (determinism)
        before = await self.db.execute_fetchall(
            "SELECT player_id, team, laker_score, tier FROM player_seasons ORDER BY player_id"
        )
        await loader.load_player_seasons(self.db)
        after = await self.db.execute_fetchall(
            "SELECT player_id, team, laker_score, tier FROM player_seasons ORDER BY player_id"
        )
        self.assertEqual([tuple(r) for r in before], [tuple(r) for r in after])


if __name__ == "__main__":
    unittest.main()
