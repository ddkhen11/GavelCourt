"""Phase 4 gate test: servicer import + StreamDuel handler wiring sanity.

Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import asyncio
import inspect
import os
import sys
import types
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
sys.path.insert(0, os.path.join(ROOT, "gen"))

import duel_pb2 as pb
import duel_pb2_grpc as pb_grpc

import servicer as servicer_mod
from servicer import DuelServiceImpl
from game_loop import wrap
from session import GameSession, PlayerState


class AbortCalled(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message


class FakeContext:
    def __init__(self, metadata):
        self._metadata = metadata

    def invocation_metadata(self):
        return tuple(self._metadata.items())

    async def abort(self, code, message):
        raise AbortCalled(code, message)


async def _empty_iterator():
    return
    yield  # pragma: no cover — makes this an async generator


class TestInterface(unittest.TestCase):
    def test_subclasses_generated_servicer(self):
        self.assertTrue(issubclass(DuelServiceImpl, pb_grpc.DuelServiceServicer))

    def test_handler_shapes(self):
        impl = DuelServiceImpl()
        for name in ("RegisterPlayer", "CreateMatch", "JoinMatch", "FindRankedMatch"):
            self.assertTrue(
                inspect.iscoroutinefunction(getattr(impl, name)), name
            )
        for name in ("StreamDuel", "WatchMatch"):
            self.assertTrue(
                inspect.isasyncgenfunction(getattr(impl, name)), name
            )


class TestMatchmakingAuth(unittest.IsolatedAsyncioTestCase):
    """Matchmaking RPCs must not trust a bare request player_id."""

    def setUp(self):
        self._orig = (servicer_mod.database, servicer_mod.matchmaking)

        async def verify_token(pid, token):
            return token == "good"

        async def find_ranked_match(pid):
            return "match-1"

        servicer_mod.database = types.SimpleNamespace(verify_token=verify_token)
        servicer_mod.matchmaking = types.SimpleNamespace(
            create_challenge_match=lambda pid: ("match-1", "CODE42"),
            join_challenge_match=lambda m, p, c: (_ for _ in ()).throw(
                ValueError("unused")
            ),
            find_ranked_match=find_ranked_match,
        )

    def tearDown(self):
        servicer_mod.database, servicer_mod.matchmaking = self._orig

    async def test_missing_or_bad_token_aborts(self):
        impl = DuelServiceImpl()
        for method, md in [
            ("CreateMatch", {}),
            ("JoinMatch", {"auth-token": "bad"}),
            ("FindRankedMatch", {"player-id": "p1", "auth-token": "bad"}),
        ]:
            req = {
                "CreateMatch": pb.CreateMatchRequest(player_id="p1"),
                "JoinMatch": pb.JoinMatchRequest(player_id="p1"),
                "FindRankedMatch": pb.FindRankedMatchRequest(player_id="p1"),
            }[method]
            with self.assertRaises(AbortCalled, msg=method) as cm:
                await getattr(impl, method)(req, FakeContext(md))
            self.assertEqual(cm.exception.code.name, "UNAUTHENTICATED", method)

    async def test_valid_token_passes(self):
        impl = DuelServiceImpl()
        ctx = FakeContext({"auth-token": "good"})
        res = await impl.CreateMatch(pb.CreateMatchRequest(player_id="p1"), ctx)
        self.assertEqual(res.join_code, "CODE42")
        res = await impl.FindRankedMatch(
            pb.FindRankedMatchRequest(player_id="p1"), ctx
        )
        self.assertEqual(res.match_id, "match-1")


class TestStreamDuelWiring(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._orig = (
            servicer_mod.database,
            servicer_mod.matchmaking,
            servicer_mod.game_loop,
        )
        self.session = GameSession(match_id="m1")
        for pid in ("p1", "p2"):
            self.session.players[pid] = PlayerState(player_id=pid)

        async def verify_token(pid, token):
            return token == "good"

        def get_session_for_player(pid):
            if pid in self.session.players:
                return self.session
            raise LookupError("no session for player")

        servicer_mod.database = types.SimpleNamespace(verify_token=verify_token)
        servicer_mod.matchmaking = types.SimpleNamespace(
            get_session_for_player=get_session_for_player
        )

        self.loop_started = asyncio.Event()

        async def fake_game_loop(session):
            # Immediately end the game so the streams terminate.
            self.loop_started.set()
            for q in session.event_queues.values():
                await q.put(wrap(pb.GameEndedEvent(result=pb.GAME_RESULT_TIE)))

        servicer_mod.game_loop = fake_game_loop

    def tearDown(self):
        (
            servicer_mod.database,
            servicer_mod.matchmaking,
            servicer_mod.game_loop,
        ) = self._orig

    async def test_missing_credentials_aborts_unauthenticated(self):
        impl = DuelServiceImpl()
        stream = impl.StreamDuel(_empty_iterator(), FakeContext({}))
        with self.assertRaises(AbortCalled) as cm:
            await stream.__anext__()
        self.assertEqual(cm.exception.code.name, "UNAUTHENTICATED")

    async def test_bad_token_aborts_unauthenticated(self):
        impl = DuelServiceImpl()
        ctx = FakeContext({"player-id": "p1", "auth-token": "bad"})
        stream = impl.StreamDuel(_empty_iterator(), ctx)
        with self.assertRaises(AbortCalled) as cm:
            await stream.__anext__()
        self.assertEqual(cm.exception.code.name, "UNAUTHENTICATED")

    async def test_unknown_player_aborts_not_found(self):
        impl = DuelServiceImpl()
        ctx = FakeContext({"player-id": "stranger", "auth-token": "good"})
        stream = impl.StreamDuel(_empty_iterator(), ctx)
        with self.assertRaises(AbortCalled) as cm:
            await stream.__anext__()
        self.assertEqual(cm.exception.code.name, "NOT_FOUND")

    async def test_two_connections_wire_queues_and_start_loop_once(self):
        impl = DuelServiceImpl()

        async def run_stream(pid):
            ctx = FakeContext({"player-id": pid, "auth-token": "good"})
            return [ev async for ev in impl.StreamDuel(_empty_iterator(), ctx)]

        ev1, ev2 = await asyncio.wait_for(
            asyncio.gather(run_stream("p1"), run_stream("p2")), timeout=5
        )

        s = self.session
        # Per-player queues registered, strong task refs stored
        self.assertEqual(set(s.action_queues), {"p1", "p2"})
        self.assertEqual(set(s.event_queues), {"p1", "p2"})
        self.assertEqual(set(s.reader_tasks), {"p1", "p2"})
        # Game loop started exactly once, ref kept
        self.assertTrue(self.loop_started.is_set())
        self.assertTrue(s.game_loop_started)
        self.assertIsNotNone(s.loop_task)
        # Both streams delivered the terminal event and closed
        self.assertTrue(ev1[-1].HasField("game_ended"))
        self.assertTrue(ev2[-1].HasField("game_ended"))


if __name__ == "__main__":
    unittest.main()
