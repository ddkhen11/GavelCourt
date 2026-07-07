"""Phase 5 gate tests: known lineup -> expected impact + each bonus path.

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from scoring import calculate_bonus, score_lineup
from session import PlayerSeason


def make_player(position: str, laker_score: float = 5.0, rapm_defense: float = 0.0):
    return PlayerSeason(
        player_id=f"{position}_{laker_score}",
        player_name=position,
        season="2000",
        team="TST",
        position=position,
        laker_score=laker_score,
        rapm=1.0,
        rapm_offense=1.0,
        rapm_defense=rapm_defense,
        war=2.0,
        tier="B",
    )


class TestScoring(unittest.TestCase):
    def test_known_lineup_expected_totals(self):
        # All 5 positions (+3), no duplicates (+2), one lockdown defender (+4).
        lineup = [
            make_player("PG", 9.5, rapm_defense=3.0),
            make_player("SG", 7.2),
            make_player("SF", 6.1),
            make_player("PF", 5.4),
            make_player("C", 4.8),
        ]
        impact, bonus, total = score_lineup(lineup)
        self.assertAlmostEqual(impact, 33.0)
        self.assertAlmostEqual(bonus, 9.0)
        self.assertAlmostEqual(total, 42.0)

    def test_all_positions_bonus_includes_balance(self):
        # 5 distinct positions necessarily also means no duplicates: +3 +2.
        lineup = [make_player(p) for p in ("PG", "SG", "SF", "PF", "C")]
        self.assertAlmostEqual(calculate_bonus(lineup), 5.0)

    def test_balance_bonus_alone_on_partial_lineup(self):
        # Fewer than 5 players, no duplicates: +2 balance without the +3.
        lineup = [make_player(p) for p in ("PG", "SG", "SF")]
        self.assertAlmostEqual(calculate_bonus(lineup), 2.0)

    def test_lockdown_bonus_alone(self):
        # Duplicated positions, one defender over the threshold: +4 only.
        lineup = [
            make_player("PG", rapm_defense=2.6),
            make_player("PG"),
            make_player("SG"),
            make_player("SG"),
            make_player("SF"),
        ]
        self.assertAlmostEqual(calculate_bonus(lineup), 4.0)

    def test_lockdown_threshold_is_strict(self):
        # rapm_defense must be > 2.5, not >=.
        lineup = [
            make_player("PG", rapm_defense=2.5),
            make_player("PG"),
            make_player("SG"),
            make_player("SG"),
            make_player("SF"),
        ]
        self.assertAlmostEqual(calculate_bonus(lineup), 0.0)

    def test_no_bonuses(self):
        lineup = [make_player("C") for _ in range(5)]
        impact, bonus, total = score_lineup(lineup)
        self.assertAlmostEqual(impact, 25.0)
        self.assertAlmostEqual(bonus, 0.0)
        self.assertAlmostEqual(total, 25.0)

    def test_empty_lineup_scores_zero(self):
        # Forfeited/partial lineups are scored as-is; empty must not crash
        # or trigger the balance bonus.
        impact, bonus, total = score_lineup([])
        self.assertEqual((impact, bonus, total), (0, 0.0, 0))


if __name__ == "__main__":
    unittest.main()
