"""Phase 4 gate tests: collect_bids, resolve_auction, pity no-advance.

Stdlib-only (unittest + asyncio) — pytest is intentionally not a dependency.
Run:  .venv/bin/python -m unittest discover -s tests -v
"""

import asyncio
import types
import unittest

from factories import (
    bid_action,
    make_card,
    make_session,
    pass_action,
    pb,
    ready_action,
)

import game_loop as gl
from constants import ROSTER_SIZE, STARTING_CREDITS


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

        async def record_match(session, scores, elo_changes, winner_id):
            self.recorded.append((session.match_id, scores, elo_changes, winner_id))

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

    async def test_forced_pity_after_board_exhaustion(self):
        # SPEC: the match runs until the board PLUS pity reserves are exhausted.
        board = [make_card("b1")]
        pity = [make_card("x1", tier="S", score=9.5), make_card("x2", tier="A", score=8.0)]
        s = make_session(board, pity)
        ev1, _ = await self._play(s, {
            # windows: b1(pass) forced-pity(p1 bids 1) forced-pity(pass)
            "p1": [pass_action(), bid_action(1), pass_action()],
            "p2": [pass_action(), pass_action(), pass_action()],
        })
        flips = self._flipped_ids(ev1)
        self.assertEqual(flips[0], "b1")
        self.assertEqual(len(flips), 3)
        self.assertEqual(sorted(flips[1:]), ["x1", "x2"])
        self.assertEqual(sum(1 for e in ev1 if e.HasField("pity_triggered")), 2)
        self.assertEqual(len(s.players["p1"].lineup), 1)
        self.assertEqual(s.pity_pool, [])
        self.assertTrue(ev1[-1].HasField("game_ended"))

    async def test_card_flipped_carries_no_stats(self):
        # Blind-board invariant: CardFlippedEvent has identity only (CardInfo has no
        # stat fields at the protocol level).
        info_fields = {f.name for f in pb.CardInfo.DESCRIPTOR.fields}
        self.assertEqual(
            info_fields, {"player_id", "player_name", "season", "team", "position"}
        )


class TestPlayerState(unittest.TestCase):
    def test_full_roster_max_bid_is_zero(self):
        from session import PlayerState

        p = PlayerState(player_id="p", credits=46)
        p.lineup = [make_card(f"c{i}") for i in range(ROSTER_SIZE)]
        self.assertEqual(p.max_bid(), 0)


class TestLifecycle(unittest.IsolatedAsyncioTestCase):
    """Disconnect/forfeit paths: mid-match, pre-ready, and double-disconnect."""

    def setUp(self):
        self._real_db = gl.database
        gl.database = _DbStub()
        self._real_window = gl.BID_WINDOW_SECONDS
        gl.BID_WINDOW_SECONDS = 0.3  # keep timeout-driven paths fast

    def tearDown(self):
        gl.database = self._real_db
        gl.BID_WINDOW_SECONDS = self._real_window

    @staticmethod
    async def _read_until_end(session, pid, on_window=None):
        events = []
        while True:
            ev = await session.event_queues[pid].get()
            events.append(ev)
            if ev.HasField("bid_window_open") and on_window is not None:
                await on_window(len([e for e in events if e.HasField("bid_window_open")]))
            if ev.HasField("game_ended"):
                return events

    async def test_mid_match_disconnect_forfeits_to_opponent(self):
        s = make_session([make_card("b1"), make_card("b2"), make_card("b3")], [])
        for pid in s.players:
            await s.action_queues[pid].put(ready_action())

        async def p1_windows(n):
            if n == 1:
                await s.action_queues["p1"].put(bid_action(2))

        async def p2_windows(n):
            s.players["p2"].disconnected = True  # tab closed; never bids again

        _, ev1, ev2 = await asyncio.wait_for(
            asyncio.gather(
                gl.game_loop(s),
                self._read_until_end(s, "p1", p1_windows),
                self._read_until_end(s, "p2", p2_windows),
            ),
            timeout=5,
        )
        end1, end2 = ev1[-1].game_ended, ev2[-1].game_ended
        self.assertTrue(end1.by_forfeit)
        self.assertEqual(end1.result, pb.GAME_RESULT_WIN)
        self.assertEqual(end2.result, pb.GAME_RESULT_LOSS)
        # p1's uncontested bid on card 1 still counted before the forfeit
        self.assertEqual([c.player_id for c in s.players["p1"].lineup], ["b1"])
        self.assertEqual(gl.database.recorded[-1][3], "p1")  # winner_id persisted

    async def test_double_disconnect_is_a_tie(self):
        s = make_session([make_card("b1"), make_card("b2")], [])
        for pid in s.players:
            await s.action_queues[pid].put(ready_action())

        def drop(pid):
            async def on_window(n):
                s.players[pid].disconnected = True

            return on_window

        _, ev1, ev2 = await asyncio.wait_for(
            asyncio.gather(
                gl.game_loop(s),
                self._read_until_end(s, "p1", drop("p1")),
                self._read_until_end(s, "p2", drop("p2")),
            ),
            timeout=5,
        )
        self.assertEqual(ev1[-1].game_ended.result, pb.GAME_RESULT_TIE)
        self.assertEqual(ev2[-1].game_ended.result, pb.GAME_RESULT_TIE)
        self.assertTrue(ev1[-1].game_ended.by_forfeit)
        self.assertIsNone(gl.database.recorded[-1][3])  # winner_id None

    async def test_leaving_before_ready_forfeits(self):
        s = make_session([make_card("b1")], [])
        await s.action_queues["p1"].put(ready_action())  # p2 never readies

        async def abandon():
            await asyncio.sleep(0.1)
            s.players["p2"].disconnected = True

        _, ev1, _ = await asyncio.wait_for(
            asyncio.gather(
                gl.game_loop(s),
                self._read_until_end(s, "p1"),
                abandon(),
            ),
            timeout=5,
        )
        self.assertTrue(ev1[-1].HasField("game_ended"))
        end = ev1[-1].game_ended
        self.assertTrue(end.by_forfeit)
        self.assertEqual(end.result, pb.GAME_RESULT_WIN)
        # No cards were ever flipped
        self.assertEqual(
            sum(1 for e in ev1 if e.HasField("card_flipped")), 0
        )


if __name__ == "__main__":
    unittest.main()
