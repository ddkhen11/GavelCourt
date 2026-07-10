"""SPEC-mandated BoardBuilder tests: build 20 boards, assert both shuffle
constraints hold and the pity pool excludes board cards.

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import unittest

from factories import make_card

from board import BoardBuilder
from constants import BOARD_SIZE


def make_pools(ns=4, na=8, nb=30, nc=30):
    return {
        "S": [make_card(f"s{i}", "S", 9.5) for i in range(ns)],
        "A": [make_card(f"a{i}", "A", 8.0) for i in range(na)],
        "B": [make_card(f"b{i}", "B", 6.0) for i in range(nb)],
        "C": [make_card(f"c{i}", "C", 4.0) for i in range(nc)],
    }


def max_consecutive_c(board):
    run = best = 0
    for card in board:
        run = run + 1 if card.tier == "C" else 0
        best = max(best, run)
    return best


class TestBoardBuilder(unittest.TestCase):
    def test_twenty_boards_hold_constraints(self):
        for _ in range(20):
            pools = make_pools()
            board, pity = BoardBuilder().build(pools)
            self.assertEqual(len(board), BOARD_SIZE)
            self.assertLessEqual(max_consecutive_c(board), 2)
            self.assertTrue(any(c.tier in ("S", "A") for c in board[:5]))
            # No duplicate cards on the board
            self.assertEqual(len({c.player_id for c in board}), len(board))
            # Pity pool: exactly the S/A cards NOT on the board
            board_ids = {c.player_id for c in board}
            pity_ids = {c.player_id for c in pity}
            self.assertFalse(pity_ids & board_ids)
            self.assertTrue(all(c.tier in ("S", "A") for c in pity))
            all_sa = {c.player_id for c in pools["S"] + pools["A"]}
            self.assertEqual(pity_ids, all_sa - board_ids)

    def test_small_pools_cap_board_size(self):
        pools = make_pools(ns=1, na=2, nb=3, nc=3)
        board, _ = BoardBuilder().build(pools)
        self.assertEqual(len(board), 9)  # min(BOARD_SIZE, total available)


if __name__ == "__main__":
    unittest.main()
