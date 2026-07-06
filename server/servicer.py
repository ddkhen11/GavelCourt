import asyncio
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
from game_loop import game_loop, wrap


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
        match_id = await matchmaking.find_ranked_match(request.player_id)
        return pb.FindRankedMatchResponse(
            match_id=match_id,
            status=pb.MATCH_STATUS_READY,
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

        session.event_queues[player_id] = asyncio.Queue()
        session.action_queues[player_id] = asyncio.Queue()
        session.players[player_id].connected = True

        # 3. Reader task: phase-gated action enqueue
        async def reader():
            try:
                async for action in request_iterator:
                    if action.HasField("ready") and session.phase is Phase.WAITING:
                        await session.action_queues[player_id].put(action)
                    elif (
                        action.WhichOneof("action") in ("bid", "pass")
                        and session.phase is Phase.BID_WINDOW
                    ):
                        await session.action_queues[player_id].put(action)
                    else:
                        await session.event_queues[player_id].put(
                            wrap(
                                pb.ErrorEvent(
                                    code="INVALID_PHASE",
                                    message="action not accepted right now",
                                )
                            )
                        )
            except Exception:
                pass
            finally:
                session.players[player_id].disconnected = True

        session.reader_tasks[player_id] = asyncio.create_task(reader())

        # 4. Start game loop exactly once when both players are connected
        if len(session.event_queues) == 2 and not session.game_loop_started:
            session.game_loop_started = True
            session.loop_task = asyncio.create_task(game_loop(session))

        # 5. Yield events to client until game ends
        try:
            while True:
                event = await session.event_queues[player_id].get()
                yield event
                if event.HasField("game_ended"):
                    break
        finally:
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
