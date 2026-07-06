"""Phase 4 gate tests: collect_bids, resolve_auction, pity no-advance.

Stdlib-only (unittest + asyncio) — pytest is intentionally not a dependency.
Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import asyncio
import os
import sys
import types
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
sys.path.insert(0, os.path.join(ROOT, "gen"))

import duel_pb2 as pb

import game_loop as gl
from session import GameSession, PlayerSeason, PlayerState
from constants import ROSTER_SIZE, STARTING_CREDITS


def make_card(pid: str, tier: str = "B", score: float = 5.0) -> PlayerSeason:
    return PlayerSeason(
        player_id=pid,
        player_name=pid,
        season="1999",
        team="TST",
        position="PG",
        laker_score=score,
        rapm=1.0,
        rapm_offense=0.5,
        rapm_defense=0.5,
        war=2.0,
        tier=tier,
    )


def make_session(board, pity_pool, pids=("p1", "p2")) -> GameSession:
    s = GameSession(match_id="m1", board=list(board), pity_pool=list(pity_pool))
    for pid in pids:
        s.players[pid] = PlayerState(player_id=pid)
        s.action_queues[pid] = asyncio.Queue()
        s.event_queues[pid] = asyncio.Queue()
    return s


def bid_action(amount: int) -> pb.PlayerAction:
    return pb.PlayerAction(bid=pb.BidAction(amount=amount))


def pass_action() -> pb.PlayerAction:
    return pb.PlayerAction(**{"pass": pb.PassAction()})


def ready_action() -> pb.PlayerAction:
    return pb.PlayerAction(ready=pb.ReadyAction())


class TestResolveAuction(unittest.TestCase):
    def test_higher_bid_wins(self):
        self.assertEqual(gl.resolve_auction({"p1": 10, "p2": 3}), ("p1", 10))
        self.assertEqual(gl.resolve_auction({"p1": 2, "p2": 7}), ("p2", 7))

    def test_uncontested_bid_beats_pass(self):
        self.assertEqual(gl.resolve_auction({"p1": 0, "p2": 1}), ("p2", 1))

    def test_tie_is_coin_flip(self):
        winners = {gl.resolve_auction({"p1": 5, "p2": 5})[0] for _ in range(200)}
        self.assertEqual(winners, {"p1", "p2"})
        # winning amount is always the tied bid
        self.assertEqual(gl.resolve_auction({"p1": 5, "p2": 5})[1], 5)


class TestCollectBids(unittest.IsolatedAsyncioTestCase):
    async def _collect(self, session, timeout, puts):
        """Start collect_bids, then enqueue actions once the window is open.

        collect_bids drains the queues when it starts (stale-action guard), so
        actions must arrive after it is running — as they do in production.
        """
        task = asyncio.create_task(gl.collect_bids(session, timeout=timeout))
        await asyncio.sleep(0.01)
        for pid, action in puts:
            await session.action_queues[pid].put(action)
        return await task

    async def test_both_bids_collected(self):
        s = make_session([], [])
        bids = await self._collect(
            s, 1, [("p1", bid_action(10)), ("p2", bid_action(4))]
        )
        self.assertEqual(bids, {"p1": 10, "p2": 4})

    async def test_pass_and_zero_bid_are_pass(self):
        s = make_session([], [])
        bids = await self._collect(
            s, 1, [("p1", pass_action()), ("p2", bid_action(0))]
        )
        self.assertEqual(bids, {"p1": 0, "p2": 0})

    async def test_timeout_means_pass(self):
        s = make_session([], [])
        bids = await self._collect(s, 0.1, [("p1", bid_action(3))])
        self.assertEqual(bids, {"p1": 3, "p2": 0})

    async def test_reserve_rule_rejects_overbid_then_accepts_valid(self):
        s = make_session([], [])
        p1 = s.players["p1"]
        # 0 drafted -> max_bid = 100 - 4 = 96
        self.assertEqual(p1.max_bid(), STARTING_CREDITS - (ROSTER_SIZE - 1))
        bids = await self._collect(
            s,
            1,
            [
                ("p1", bid_action(97)),  # over max -> ErrorEvent, keeps waiting
                ("p1", bid_action(96)),  # at max -> accepted
                ("p2", pass_action()),
            ],
        )
        self.assertEqual(bids["p1"], 96)
        err = s.event_queues["p1"].get_nowait()
        self.assertTrue(err.HasField("error"))
        self.assertEqual(err.error.code, "BID_EXCEEDS_MAX")

    async def test_last_slot_allows_all_in(self):
        s = make_session([], [])
        p1 = s.players["p1"]
        p1.lineup = [make_card(f"c{i}") for i in range(ROSTER_SIZE - 1)]
        p1.credits = 42
        self.assertEqual(p1.max_bid(), 42)
        bids = await self._collect(
            s, 1, [("p1", bid_action(42)), ("p2", pass_action())]
        )
        self.assertEqual(bids["p1"], 42)

    async def test_full_player_auto_passes(self):
        s = make_session([], [])
        s.players["p1"].lineup = [make_card(f"c{i}") for i in range(ROSTER_SIZE)]
        # p1's queue is never consumed; only p2's bid matters
        bids = await self._collect(s, 1, [("p2", bid_action(7))])
        self.assertEqual(bids, {"p1": 0, "p2": 7})

    async def test_stale_actions_drained_before_window(self):
        s = make_session([], [])
        # Stale bid queued before the window opens must NOT count as this card's bid.
        await s.action_queues["p1"].put(bid_action(50))
        bids = await self._collect(
            s, 1, [("p1", bid_action(2)), ("p2", bid_action(3))]
        )
        self.assertEqual(bids, {"p1": 2, "p2": 3})


class _DbStub(types.SimpleNamespace):
    def __init__(self):
        self.recorded = []

        async def get_player_elo(pid):
            return 1000

        async def record_match(session, scores, elo_changes):
            self.recorded.append((session.match_id, scores, elo_changes))

        super().__init__(get_player_elo=get_player_elo, record_match=record_match)


async def _driver(session, pid, script):
    """Reads this player's event stream; answers each bid window from `script`."""
    events = []
    i = 0
    while True:
        ev = await session.event_queues[pid].get()
        events.append(ev)
        if ev.HasField("bid_window_open"):
            await session.action_queues[pid].put(script[i])
            i += 1
        if ev.HasField("game_ended"):
            return events


class TestPityNoAdvance(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._real_db = gl.database
        gl.database = _DbStub()

    def tearDown(self):
        gl.database = self._real_db

    async def _play(self, session, scripts):
        for pid in session.players:
            await session.action_queues[pid].put(ready_action())
        results = await asyncio.wait_for(
            asyncio.gather(
                gl.game_loop(session),
                _driver(session, "p1", scripts["p1"]),
                _driver(session, "p2", scripts["p2"]),
            ),
            timeout=5,
        )
        return results[1], results[2]  # p1 events, p2 events

    @staticmethod
    def _flipped_ids(events):
        return [e.card_flipped.card.player_id for e in events if e.HasField("card_flipped")]

    async def test_pity_card_won_does_not_advance_board(self):
        board = [make_card("b1"), make_card("b2"), make_card("b3")]
        pity = [make_card("pity1", tier="S", score=9.5)]
        s = make_session(board, pity)
        ev1, _ = await self._play(s, {
            # windows: b1(pass) b2(pass) pity(p1 bids) b3(pass)
            "p1": [pass_action(), pass_action(), bid_action(5), pass_action()],
            "p2": [pass_action(), pass_action(), pass_action(), pass_action()],
        })
        self.assertEqual(self._flipped_ids(ev1), ["b1", "b2", "pity1", "b3"])
        self.assertEqual(sum(1 for e in ev1 if e.HasField("pity_triggered")), 1)
        # pity card won by p1; board card b3 still got its turn afterwards
        self.assertEqual([c.player_id for c in s.players["p1"].lineup], ["pity1"])
        self.assertEqual(s.board_index, 3)  # pity never consumed a board slot
        self.assertEqual(s.pity_pool, [])
        self.assertTrue(ev1[-1].HasField("game_ended"))

    async def test_pity_card_passed_does_not_advance_board(self):
        board = [make_card("b1"), make_card("b2"), make_card("b3")]
        pity = [make_card("pity1", tier="A", score=8.0)]
        s = make_session(board, pity)
        ev1, _ = await self._play(s, {
            # windows: b1(pass) b2(pass) pity(pass) b3(p1 bids)
            "p1": [pass_action(), pass_action(), pass_action(), bid_action(1)],
            "p2": [pass_action(), pass_action(), pass_action(), pass_action()],
        })
        self.assertEqual(self._flipped_ids(ev1), ["b1", "b2", "pity1", "b3"])
        # passed pity card: board_index untouched, so b3 (board[2]) was still flipped
        self.assertEqual([c.player_id for c in s.players["p1"].lineup], ["b3"])
        self.assertEqual(s.board_index, 3)
        self.assertTrue(ev1[-1].HasField("game_ended"))

    async def test_empty_pity_pool_never_fires(self):
        board = [make_card("b1"), make_card("b2"), make_card("b3")]
        s = make_session(board, [])
        ev1, _ = await self._play(s, {
            "p1": [pass_action()] * 3,
            "p2": [pass_action()] * 3,
        })
        self.assertEqual(self._flipped_ids(ev1), ["b1", "b2", "b3"])
        self.assertEqual(sum(1 for e in ev1 if e.HasField("pity_triggered")), 0)

    async def test_card_flipped_carries_no_stats(self):
        # Blind-board invariant: CardFlippedEvent has identity only (CardInfo has no
        # stat fields at the protocol level).
        info_fields = {f.name for f in pb.CardInfo.DESCRIPTOR.fields}
        self.assertEqual(
            info_fields, {"player_id", "player_name", "season", "team", "position"}
        )


if __name__ == "__main__":
    unittest.main()
