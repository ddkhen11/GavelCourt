import uuid
import grpc
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gen"))
import duel_pb2 as pb
import duel_pb2_grpc as pb_grpc

from session import PlayerSeason
import db as database
import matchmaking


def _ps_from_row(r: dict) -> PlayerSeason:
    return PlayerSeason(**{k: r[k] for k in PlayerSeason.__dataclass_fields__})


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
            await context.abort(grpc.StatusCode.NOT_FOUND, str(e))
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

    # ── Bidi streaming (stub — implemented in Phase 4) ─────────────────────

    async def StreamDuel(self, request_iterator, context):
        await context.abort(
            grpc.StatusCode.UNIMPLEMENTED, "StreamDuel not yet implemented"
        )

    # ── Spectator stream (stub) ─────────────────────────────────────────────

    async def WatchMatch(self, request, context):
        await context.abort(
            grpc.StatusCode.UNIMPLEMENTED, "WatchMatch not yet implemented"
        )
