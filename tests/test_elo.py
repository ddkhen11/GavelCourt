"""Phase 5 gate tests: elo symmetric deltas + tie path.

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from constants import ELO_K
from elo import elo_change, elo_change_tie, expected_score


class TestExpectedScore(unittest.TestCase):
    def test_equal_ratings_half(self):
        self.assertAlmostEqual(expected_score(1000, 1000), 0.5)

    def test_symmetry_sums_to_one(self):
        for ra, rb in ((1000, 1200), (1500, 900), (1000, 1000)):
            self.assertAlmostEqual(expected_score(ra, rb) + expected_score(rb, ra), 1.0)


class TestEloChange(unittest.TestCase):
    def test_equal_ratings_symmetric_deltas(self):
        dw, dl = elo_change(1000, 1000)
        self.assertEqual(dw, ELO_K // 2)  # +16
        self.assertEqual(dl, -ELO_K // 2)  # -16
        self.assertEqual(dw + dl, 0)

    def test_signs_and_bounds(self):
        for wr, lr in ((1000, 1000), (1200, 1000), (1000, 1400)):
            dw, dl = elo_change(wr, lr)
            self.assertGreaterEqual(dw, 0)
            self.assertLessEqual(dl, 0)
            self.assertLessEqual(dw, ELO_K)
            self.assertGreaterEqual(-dl, 0)
            self.assertLessEqual(-dl, ELO_K)

    def test_underdog_win_pays_more(self):
        underdog_dw, _ = elo_change(1000, 1400)
        favorite_dw, _ = elo_change(1400, 1000)
        self.assertGreater(underdog_dw, ELO_K // 2)
        self.assertLess(favorite_dw, ELO_K // 2)
        self.assertGreater(underdog_dw, favorite_dw)


class TestEloTie(unittest.TestCase):
    def test_equal_ratings_tie_is_zero(self):
        self.assertEqual(elo_change_tie(1000, 1000), (0, 0))

    def test_tie_transfers_toward_lower_rated(self):
        da, db = elo_change_tie(1000, 1400)  # a is the underdog
        self.assertGreater(da, 0)
        self.assertLess(db, 0)
        self.assertEqual(da, -db)  # zero-sum tie

    def test_tie_is_order_independent(self):
        da, db = elo_change_tie(1000, 1400)
        db2, da2 = elo_change_tie(1400, 1000)
        self.assertEqual((da, db), (da2, db2))


if __name__ == "__main__":
    unittest.main()
