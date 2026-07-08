"""Phase 5 gate tests: record_match persistence (elo, win/loss counters, matches row).

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

import db as database
from session import GameSession, PlayerState


def make_session(match_id="m1", pids=("pa", "pb")):
    s = GameSession(match_id=match_id)
    for pid in pids:
        s.players[pid] = PlayerState(player_id=pid)
    return s


class TestRecordMatch(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._saved_db = database._db
        await database.init_db(":memory:")
        await database.register_player("pa", "alice", "tok-a")
        await database.register_player("pb", "bob", "tok-b")

    async def asyncTearDown(self):
        await database.get_db().close()
        database._db = self._saved_db

    async def _player_row(self, pid):
        async with database.get_db().execute(
            "SELECT elo, wins, losses FROM players WHERE player_id=?", (pid,)
        ) as cur:
            return dict(await cur.fetchone())

    async def _match_row(self, match_id):
        async with database.get_db().execute(
            "SELECT * FROM matches WHERE match_id=?", (match_id,)
        ) as cur:
            return dict(await cur.fetchone())

    async def test_win_updates_counters_and_matches_row(self):
        s = make_session()
        await database.record_match(
            s, {"pa": 50.0, "pb": 40.0}, {"pa": 16, "pb": -16}, winner_id="pa"
        )
        self.assertEqual(await self._player_row("pa"), {"elo": 1016, "wins": 1, "losses": 0})
        self.assertEqual(await self._player_row("pb"), {"elo": 984, "wins": 0, "losses": 1})
        m = await self._match_row("m1")
        self.assertEqual(m["winner_id"], "pa")
        self.assertEqual((m["player_a_score"], m["player_b_score"]), (50.0, 40.0))
        self.assertEqual((m["player_a_elo_change"], m["player_b_elo_change"]), (16, -16))
        self.assertIsNotNone(m["completed_at"])

    async def test_tie_updates_elo_but_not_counters(self):
        s = make_session()
        await database.record_match(
            s, {"pa": 42.0, "pb": 42.0}, {"pa": 3, "pb": -3}, winner_id=None
        )
        self.assertEqual(await self._player_row("pa"), {"elo": 1003, "wins": 0, "losses": 0})
        self.assertEqual(await self._player_row("pb"), {"elo": 997, "wins": 0, "losses": 0})
        self.assertIsNone((await self._match_row("m1"))["winner_id"])

    async def test_leaderboard_ranked_by_elo(self):
        await database.register_player("pc", "carol", "tok-c")
        for pid, delta in (("pa", 40), ("pb", -10)):  # pa 1040, pb 990, pc 1000
            await database.get_db().execute(
                "UPDATE players SET elo=elo+? WHERE player_id=?", (delta, pid)
            )
        rows = await database.get_leaderboard(limit=10)
        self.assertEqual(
            [(r["username"], r["elo"]) for r in rows],
            [("alice", 1040), ("carol", 1000), ("bob", 990)],
        )
        top = await database.get_leaderboard(limit=2)
        self.assertEqual(len(top), 2)
        self.assertEqual(top[0]["username"], "alice")

    async def test_forfeit_winner_can_have_lower_score(self):
        # Disconnect = forfeit: the winner is decided by finalize_game, not by
        # comparing scores — here pb forfeited while ahead on points.
        s = make_session()
        await database.record_match(
            s, {"pa": 30.0, "pb": 55.0}, {"pa": 16, "pb": -16}, winner_id="pa"
        )
        self.assertEqual(await self._player_row("pa"), {"elo": 1016, "wins": 1, "losses": 0})
        self.assertEqual(await self._player_row("pb"), {"elo": 984, "wins": 0, "losses": 1})
        self.assertEqual((await self._match_row("m1"))["winner_id"], "pa")


if __name__ == "__main__":
    unittest.main()
