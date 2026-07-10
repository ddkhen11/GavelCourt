import asyncio
import random
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gen"))
import duel_pb2 as pb

from session import GameSession, Phase, PlayerSeason
from constants import BID_WINDOW_SECONDS, PITY_THRESHOLD, STARTING_CREDITS, ROSTER_SIZE
import db as database
import matchmaking
from scoring import score_lineup
from elo import elo_change, elo_change_tie

# ── Proto helpers ──────────────────────────────────────────────────────────

_TIER_ENUM = {
    "S": pb.CARD_TIER_S,
    "A": pb.CARD_TIER_A,
    "B": pb.CARD_TIER_B,
    "C": pb.CARD_TIER_C,
}


def wrap(event) -> pb.GameEvent:
    e = pb.GameEvent()
    if isinstance(event, pb.GameStartedEvent):
        e.game_started.CopyFrom(event)
    elif isinstance(event, pb.CardFlippedEvent):
        e.card_flipped.CopyFrom(event)
    elif isinstance(event, pb.BidWindowOpenEvent):
        e.bid_window_open.CopyFrom(event)
    elif isinstance(event, pb.BidResolvedEvent):
        e.bid_resolved.CopyFrom(event)
    elif isinstance(event, pb.CardPassedEvent):
        e.card_passed.CopyFrom(event)
    elif isinstance(event, pb.PityTriggeredEvent):
        e.pity_triggered.CopyFrom(event)
    elif isinstance(event, pb.GameEndedEvent):
        e.game_ended.CopyFrom(event)
    elif isinstance(event, pb.ErrorEvent):
        e.error.CopyFrom(event)
    return e


async def send(session: GameSession, pid: str, event) -> None:
    await session.event_queues[pid].put(wrap(event))


async def broadcast_all(session: GameSession, event) -> None:
    wrapped = wrap(event)
    for q in session.event_queues.values():
        await q.put(wrapped)
    for q in session.spectator_queues.values():
        await q.put(wrapped)


def to_card_info(card: PlayerSeason) -> pb.CardInfo:
    return pb.CardInfo(
        player_id=card.player_id,
        player_name=card.player_name,
        season=card.season,
        team=card.team,
        position=card.position,
    )


def to_card_stats(card: PlayerSeason) -> pb.CardStats:
    return pb.CardStats(
        player_id=card.player_id,
        player_name=card.player_name,
        season=card.season,
        team=card.team,
        position=card.position,
        laker_score=card.laker_score,
        rapm=card.rapm,
        rapm_offense=card.rapm_offense,
        rapm_defense=card.rapm_defense,
        war=card.war,
    )


def resolve_auction(bids: dict) -> tuple[str, int]:
    items = list(bids.items())
    (a, av), (b, bv) = items[0], items[1]
    winner = random.choice([a, b]) if av == bv else (a if av > bv else b)
    return winner, bids[winner]


def _bid_resolved_event(
    session: GameSession,
    card: PlayerSeason,
    bids: dict,
    winner_id: str,
    loser_id: str,
    viewer_id: str | None = None,
) -> pb.BidResolvedEvent:
    """Perspective resolve for viewer_id, or the neutral spectator copy when
    None (winner's numbers first, you_won always false)."""
    me = viewer_id if viewer_id is not None else winner_id
    opp = loser_id if me == winner_id else winner_id
    return pb.BidResolvedEvent(
        you_won=viewer_id == winner_id,
        winning_bid=bids[winner_id],
        your_bid=bids[me],
        opponent_bid=bids[opp],
        revealed_stats=to_card_stats(card),
        your_credits_remaining=session.players[me].credits,
        opponent_credits_remaining=session.players[opp].credits,
        your_players_drafted=len(session.players[me].lineup),
        opponent_players_drafted=len(session.players[opp].lineup),
    )


# ── Ready barrier ──────────────────────────────────────────────────────────


async def wait_for_ready(session: GameSession) -> bool:
    """Returns True once both players sent Ready, False if someone
    disconnected while waiting (closed the tab before clicking Ready)."""

    async def one(pid):
        while True:
            # Re-read the queue each poll: a pre-start reconnect swaps it.
            q = session.action_queues[pid]
            try:
                action = await asyncio.wait_for(q.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            if action.HasField("ready"):
                return

    async def watch_disconnect():
        while not any(p.disconnected for p in session.players.values()):
            await asyncio.sleep(0.2)

    ready_task = asyncio.ensure_future(
        asyncio.gather(*[one(pid) for pid in session.players])
    )
    watch_task = asyncio.ensure_future(watch_disconnect())
    try:
        done, _ = await asyncio.wait(
            {ready_task, watch_task}, return_when=asyncio.FIRST_COMPLETED
        )
        return (
            ready_task in done
            and not ready_task.cancelled()
            and ready_task.exception() is None
        )
    finally:
        for t in (ready_task, watch_task):
            t.cancel()
        await asyncio.gather(ready_task, watch_task, return_exceptions=True)


# ── Bid collection ─────────────────────────────────────────────────────────


async def collect_bids(session: GameSession, timeout: float) -> dict:
    bids = {pid: 0 for pid in session.players}

    async def wait_for_one_bid(player_id):
        p = session.players[player_id]
        if p.is_full():
            return  # auto-pass
        q = session.action_queues[player_id]
        while True:
            action = await q.get()
            if action.HasField("bid"):
                amount = action.bid.amount
                if amount > p.max_bid():
                    await send(
                        session,
                        player_id,
                        pb.ErrorEvent(
                            code="BID_EXCEEDS_MAX",
                            message=f"Max bid is {p.max_bid()} (keep 1 credit per remaining slot)",
                        ),
                    )
                    continue
                bids[player_id] = amount
                return
            elif action.HasField("pass"):
                bids[player_id] = 0
                return

    # Drain stale actions before opening the window (belt-and-suspenders with the phase gate)
    for q in session.action_queues.values():
        while not q.empty():
            q.get_nowait()

    try:
        await asyncio.wait_for(
            asyncio.gather(*[wait_for_one_bid(pid) for pid in session.players]),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        pass  # missing bids stay 0 (treated as pass)

    return bids


# ── Elo helpers ────────────────────────────────────────────────────────────


async def _apply_elo(session: GameSession, winner_id: str | None) -> dict[str, int]:
    pids = list(session.players.keys())
    a_id, b_id = pids[0], pids[1]
    ra = await database.get_player_elo(a_id)
    rb = await database.get_player_elo(b_id)

    if winner_id is None:
        da, db_ = elo_change_tie(ra, rb)
    elif winner_id == a_id:
        da, db_ = elo_change(ra, rb)
    else:
        db_, da = elo_change(rb, ra)

    return {a_id: da, b_id: db_}


# ── Finalization ───────────────────────────────────────────────────────────


async def finalize_game(session: GameSession, forfeit: bool) -> None:
    session.phase = Phase.GAME_OVER
    pids = list(session.players.keys())
    a, b = session.players[pids[0]], session.players[pids[1]]

    ia, ba_, ta = score_lineup(a.lineup)
    ib, bb_, tb = score_lineup(b.lineup)

    if forfeit and a.disconnected and b.disconnected:
        # Both gone (shared outage, proxy restart): nobody deserves the win.
        winner_id: str | None = None
        results = {a.player_id: pb.GAME_RESULT_TIE, b.player_id: pb.GAME_RESULT_TIE}
    elif forfeit:
        loser = next(p for p in (a, b) if p.disconnected)
        winner = a if loser is b else b
        winner_id = winner.player_id
        results = {
            winner.player_id: pb.GAME_RESULT_WIN,
            loser.player_id: pb.GAME_RESULT_LOSS,
        }
    else:
        if ta == tb:
            winner_id = None
            results = {a.player_id: pb.GAME_RESULT_TIE, b.player_id: pb.GAME_RESULT_TIE}
        elif ta > tb:
            winner_id = a.player_id
            results = {
                a.player_id: pb.GAME_RESULT_WIN,
                b.player_id: pb.GAME_RESULT_LOSS,
            }
        else:
            winner_id = b.player_id
            results = {
                a.player_id: pb.GAME_RESULT_LOSS,
                b.player_id: pb.GAME_RESULT_WIN,
            }

    elo_changes = await _apply_elo(session, winner_id)
    flat_scores = {a.player_id: ta, b.player_id: tb}
    await database.record_match(session, flat_scores, elo_changes, winner_id)

    lineups = {
        a.player_id: pb.Lineup(
            players=[to_card_stats(p) for p in a.lineup],
            impact_score=ia,
            bonus=ba_,
            total_score=ta,
        ),
        b.player_id: pb.Lineup(
            players=[to_card_stats(p) for p in b.lineup],
            impact_score=ib,
            bonus=bb_,
            total_score=tb,
        ),
    }

    for pid in (a.player_id, b.player_id):
        opp = b.player_id if pid == a.player_id else a.player_id
        await send(
            session,
            pid,
            pb.GameEndedEvent(
                result=results[pid],
                your_lineup=lineups[pid],
                opponent_lineup=lineups[opp],
                your_score=flat_scores[pid],
                opponent_score=flat_scores[opp],
                elo_change=elo_changes[pid],
                by_forfeit=forfeit,
            ),
        )

    for q in session.spectator_queues.values():
        await q.put(
            wrap(
                pb.GameEndedEvent(
                    result=pb.GAME_RESULT_UNSPECIFIED,
                    your_lineup=lineups[a.player_id],
                    opponent_lineup=lineups[b.player_id],
                    your_score=ta,
                    opponent_score=tb,
                    by_forfeit=forfeit,
                )
            )
        )

    # Finished sessions must leave the registries or they leak forever.
    matchmaking.remove_session(session.match_id)


# ── Main game loop ─────────────────────────────────────────────────────────


async def game_loop(session: GameSession) -> None:
    """Single coroutine driving the entire match. Only this fn mutates GameSession."""

    if not await wait_for_ready(session):
        # A player left before the match started: forfeit, don't strand the other.
        return await finalize_game(session, forfeit=True)

    started = pb.GameStartedEvent(
        match_id=session.match_id,
        board_size=len(session.board),
        your_credits=STARTING_CREDITS,
        roster_size=ROSTER_SIZE,
    )
    for pid in session.players:
        await send(session, pid, started)
    for q in session.spectator_queues.values():
        await q.put(wrap(started))

    cards_shown = 0

    # SPEC: the match runs until both rosters are full or the board PLUS the
    # pity reserves are exhausted — leftover S/A pity cards keep flipping
    # after the board runs out while someone still has slots to fill.
    while not session.both_full() and (
        session.current_card() is not None or session.pity_pool
    ):
        if any(p.disconnected for p in session.players.values()):
            return await finalize_game(session, forfeit=True)

        is_pity = False
        card = session.current_card()

        if card is None or (
            session.consecutive_passes >= PITY_THRESHOLD and session.pity_pool
        ):
            card = session.pity_pool.pop(random.randrange(len(session.pity_pool)))
            is_pity = True
            session.consecutive_passes = 0
            await broadcast_all(session, pb.PityTriggeredEvent())

        cards_shown += 1
        await broadcast_all(
            session,
            pb.CardFlippedEvent(
                card_number=cards_shown,
                cards_remaining=session.cards_remaining() - (0 if is_pity else 1),
                card=to_card_info(card),
                tier=_TIER_ENUM[card.tier],
            ),
        )

        session.phase = Phase.BID_WINDOW
        for pid, p in session.players.items():
            await send(
                session,
                pid,
                pb.BidWindowOpenEvent(
                    duration_seconds=int(BID_WINDOW_SECONDS),
                    your_max_bid=p.max_bid(),
                ),
            )
        # Neutral copy so spectators can render the bidding phase.
        for q in session.spectator_queues.values():
            await q.put(
                wrap(pb.BidWindowOpenEvent(duration_seconds=int(BID_WINDOW_SECONDS)))
            )

        bids = await collect_bids(session, timeout=BID_WINDOW_SECONDS)
        session.phase = Phase.RESOLVING

        if all(v == 0 for v in bids.values()):
            session.consecutive_passes += 1
            if not is_pity:
                session.board_index += 1
            await broadcast_all(
                session,
                pb.CardPassedEvent(
                    consecutive_passes=session.consecutive_passes,
                ),
            )
            continue

        winner_id, winning_bid = resolve_auction(bids)
        loser_id = next(pid for pid in bids if pid != winner_id)

        session.players[winner_id].credits -= winning_bid
        session.players[winner_id].lineup.append(card)
        session.consecutive_passes = 0
        if not is_pity:
            session.board_index += 1

        for pid in (winner_id, loser_id):
            await send(
                session,
                pid,
                _bid_resolved_event(session, card, bids, winner_id, loser_id, pid),
            )

        # Neutral BidResolved for spectators (both bids revealed)
        for q in session.spectator_queues.values():
            await q.put(
                wrap(_bid_resolved_event(session, card, bids, winner_id, loser_id))
            )

    await finalize_game(session, forfeit=False)
