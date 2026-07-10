import asyncio
import logging
import uuid
import grpc
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gen"))
import duel_pb2 as pb
import duel_pb2_grpc as pb_grpc

from session import Phase
import db as database
import matchmaking
from game_loop import game_loop, send, wrap

logger = logging.getLogger(__name__)


def _observe_loop_task(session):
    """A crashed game loop must not silently freeze both clients: log it,
    push a terminal event so the streams end, and drop the session."""

    def on_done(task: asyncio.Task) -> None:
        if task.cancelled():
            return
        exc = task.exception()
        if exc is None:
            return
        logger.error("game loop crashed for match %s", session.match_id, exc_info=exc)
        for q in list(session.event_queues.values()) + list(
            session.spectator_queues.values()
        ):
            q.put_nowait(
                wrap(pb.ErrorEvent(code="INTERNAL", message="game loop crashed"))
            )
            q.put_nowait(wrap(pb.GameEndedEvent(result=pb.GAME_RESULT_UNSPECIFIED)))
        matchmaking.remove_session(session.match_id)

    return on_done


class DuelServiceImpl(pb_grpc.DuelServiceServicer):
    # ── Registration ───────────────────────────────────────────────────────

    async def RegisterPlayer(self, request, context):
        player_id = str(uuid.uuid4())
        auth_token = str(uuid.uuid4())
        await database.register_player(player_id, request.username, auth_token)
        return pb.RegisterPlayerResponse(player_id=player_id, auth_token=auth_token)

    # ── Challenge matchmaking ───────────────────────────────────────────────

    async def CreateMatch(self, request, context):
        match_id, join_code = matchmaking.create_challenge_match(request.player_id)
        return pb.CreateMatchResponse(match_id=match_id, join_code=join_code)

    async def JoinMatch(self, request, context):
        try:
            session = matchmaking.join_challenge_match(
                request.match_id, request.player_id, request.join_code
            )
        except ValueError as e:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(e))  # type: ignore[misc]
            return
        return pb.JoinMatchResponse(
            match_id=session.match_id,
            status=pb.MATCH_STATUS_READY,
        )

    # ── Ranked matchmaking ──────────────────────────────────────────────────

    async def FindRankedMatch(self, request, context):
        try:
            match_id = await matchmaking.find_ranked_match(request.player_id)
        except ValueError as e:  # e.g. same player queued from two tabs
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))  # type: ignore[misc]
            return
        return pb.FindRankedMatchResponse(
            match_id=match_id,
            status=pb.MATCH_STATUS_READY,
        )

    # ── Leaderboard ─────────────────────────────────────────────────────────

    async def GetLeaderboard(self, request, context):
        limit = request.limit or 20
        rows = await database.get_leaderboard(limit)
        return pb.GetLeaderboardResponse(
            entries=[
                pb.LeaderboardEntry(
                    username=r["username"],
                    elo=r["elo"],
                    wins=r["wins"],
                    losses=r["losses"],
                )
                for r in rows
            ]
        )

    # ── Bidi streaming ─────────────────────────────────────────────────────

    async def StreamDuel(self, request_iterator, context):
        # 1. Authenticate via metadata
        md = dict(context.invocation_metadata())
        raw_pid = md.get("player-id")
        raw_tok = md.get("auth-token")
        if not raw_pid or not raw_tok:
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "missing credentials")  # type: ignore[misc]
            return
        # grpc text-key metadata is always str at runtime; decode defensively for stubs
        player_id = raw_pid if isinstance(raw_pid, str) else raw_pid.decode()
        token = raw_tok if isinstance(raw_tok, str) else raw_tok.decode()
        if not await database.verify_token(player_id, token):
            await context.abort(grpc.StatusCode.UNAUTHENTICATED, "invalid token")  # type: ignore[misc]
            return

        # 2. Look up the session this player belongs to
        try:
            session = matchmaking.get_session_for_player(player_id)
        except LookupError:
            await context.abort(grpc.StatusCode.NOT_FOUND, "no session")  # type: ignore[misc]
            return

        my_event_queue: asyncio.Queue = asyncio.Queue()
        session.event_queues[player_id] = my_event_queue
        session.action_queues[player_id] = asyncio.Queue()
        # A reattach (React StrictMode remount, pre-start reconnect) must not
        # inherit the forfeit flag its dead predecessor stream set.
        session.players[player_id].disconnected = False

        def _still_current() -> bool:
            return session.event_queues.get(player_id) is my_event_queue

        # 3. Reader task: phase-gated action enqueue
        async def reader():
            try:
                async for action in request_iterator:
                    is_play = action.WhichOneof("action") in ("bid", "pass")
                    if action.HasField("ready") and session.phase is Phase.WAITING:
                        await session.action_queues[player_id].put(action)
                    elif is_play and session.players[player_id].is_full():
                        await send(
                            session,
                            player_id,
                            pb.ErrorEvent(
                                code="ROSTER_FULL",
                                message="roster is full — you are auto-passing",
                            ),
                        )
                    elif is_play and session.phase is Phase.BID_WINDOW:
                        await session.action_queues[player_id].put(action)
                    else:
                        await send(
                            session,
                            player_id,
                            pb.ErrorEvent(
                                code="INVALID_PHASE",
                                message="action not accepted right now",
                            ),
                        )
            except Exception:
                pass
            finally:
                # Only the stream that currently owns this player may forfeit
                # it — a superseded stream's teardown is not a disconnect.
                if _still_current():
                    session.players[player_id].disconnected = True

        session.reader_tasks[player_id] = asyncio.create_task(reader())

        # 4. Start game loop exactly once when both players are connected
        if len(session.event_queues) == 2 and not session.game_loop_started:
            session.game_loop_started = True
            session.loop_task = asyncio.create_task(game_loop(session))
            session.loop_task.add_done_callback(_observe_loop_task(session))

        # 5. Yield events to client until game ends
        try:
            while True:
                event = await my_event_queue.get()
                yield event
                if event.HasField("game_ended"):
                    break
        finally:
            if _still_current():
                session.players[player_id].disconnected = True

    # ── Spectator stream ────────────────────────────────────────────────────

    async def WatchMatch(self, request, context):
        try:
            session = matchmaking.get_session_by_match(request.match_id)
        except LookupError:
            await context.abort(grpc.StatusCode.NOT_FOUND, "match not found")  # type: ignore[misc]
            return

        spectator_id = str(uuid.uuid4())
        q: asyncio.Queue = asyncio.Queue()
        session.spectator_queues[spectator_id] = q

        try:
            while True:
                event = await q.get()
                yield event
                if event.HasField("game_ended"):
                    break
        finally:
            session.spectator_queues.pop(spectator_id, None)
