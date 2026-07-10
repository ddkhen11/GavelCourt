"""Matchmaking lifecycle tests: ranked pairing, cancelled/duplicate waiters,
challenge self-join, session cleanup, pending-challenge expiry.

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import asyncio
import time
import unittest

from factories import make_card

import matchmaking as mm
from constants import PENDING_CHALLENGE_TTL_SECONDS


def _reset_registries():
    mm._sessions_by_match.clear()
    mm._session_by_player.clear()
    mm._pending_challenge.clear()
    mm._ranked_waiter = None
    mm.set_tier_pools(
        {
            "S": [make_card(f"s{i}", "S", 9.5) for i in range(3)],
            "A": [make_card(f"a{i}", "A", 8.0) for i in range(6)],
            "B": [make_card(f"b{i}", "B", 6.0) for i in range(20)],
            "C": [make_card(f"c{i}", "C", 4.0) for i in range(20)],
        }
    )


class TestRankedQueue(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        _reset_registries()

    async def test_two_players_pair_into_one_session(self):
        first = asyncio.ensure_future(mm.find_ranked_match("a"))
        await asyncio.sleep(0.01)
        m2 = await mm.find_ranked_match("b")
        m1 = await first
        self.assertEqual(m1, m2)
        self.assertIs(mm.get_session_for_player("a"), mm.get_session_for_player("b"))
        self.assertTrue(mm.get_session_for_player("a").board)

    async def test_cancelled_waiter_does_not_poison_queue(self):
        first = asyncio.ensure_future(mm.find_ranked_match("a"))
        await asyncio.sleep(0.01)
        first.cancel()
        await asyncio.gather(first, return_exceptions=True)
        self.assertIsNone(mm._ranked_waiter)
        # Next two players pair cleanly, and neither is paired with "a"
        second = asyncio.ensure_future(mm.find_ranked_match("b"))
        await asyncio.sleep(0.01)
        await mm.find_ranked_match("c")
        await second
        with self.assertRaises(LookupError):
            mm.get_session_for_player("a")

    async def test_same_player_cannot_queue_twice(self):
        first = asyncio.ensure_future(mm.find_ranked_match("a"))
        await asyncio.sleep(0.01)
        with self.assertRaises(ValueError):
            await mm.find_ranked_match("a")
        first.cancel()
        await asyncio.gather(first, return_exceptions=True)


class TestChallenge(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        _reset_registries()

    async def test_creator_cannot_join_own_match(self):
        match_id, code = mm.create_challenge_match("a")
        with self.assertRaises(ValueError):
            mm.join_challenge_match(match_id, "a", code)
        # The pending entry survives for the real friend
        session = mm.join_challenge_match(match_id, "b", code)
        self.assertEqual(set(session.players), {"a", "b"})

    async def test_wrong_code_rejected(self):
        match_id, _ = mm.create_challenge_match("a")
        with self.assertRaises(ValueError):
            mm.join_challenge_match(match_id, "b", "NOPE42")

    async def test_abandoned_challenge_expires(self):
        match_id, _ = mm.create_challenge_match("a")
        mm._pending_challenge[match_id]["created_at"] = (
            time.monotonic() - PENDING_CHALLENGE_TTL_SECONDS - 1
        )
        mm.create_challenge_match("b")  # any call prunes
        self.assertNotIn(match_id, mm._pending_challenge)
        with self.assertRaises(LookupError):
            mm.get_session_by_match(match_id)
        with self.assertRaises(LookupError):
            mm.get_session_for_player("a")


class TestRemoveSession(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        _reset_registries()

    async def test_remove_clears_all_registries(self):
        first = asyncio.ensure_future(mm.find_ranked_match("a"))
        await asyncio.sleep(0.01)
        match_id = await mm.find_ranked_match("b")
        await first
        mm.remove_session(match_id)
        for pid in ("a", "b"):
            with self.assertRaises(LookupError):
                mm.get_session_for_player(pid)
        with self.assertRaises(LookupError):
            mm.get_session_by_match(match_id)
        # Idempotent
        mm.remove_session(match_id)


if __name__ == "__main__":
    unittest.main()
