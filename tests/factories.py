"""Shared test fixtures/factories for the server test suite."""

import asyncio
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, "server"), os.path.join(ROOT, "gen")):
    if p not in sys.path:
        sys.path.insert(0, p)

import duel_pb2 as pb  # noqa: E402
from session import GameSession, PlayerSeason, PlayerState  # noqa: E402


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


def make_session(board=(), pity_pool=(), pids=("p1", "p2")) -> GameSession:
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
