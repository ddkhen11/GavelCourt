import asyncio
import uuid
from session import GameSession, PlayerState
from board import BoardBuilder

_sessions_by_match: dict[str, GameSession] = {}
_session_by_player: dict[
    str, GameSession
] = {}  # player_id -> session (StreamDuel lookup)
_ranked_waiter: dict | None = None  # {"player_id", "future"} or None

# Populated at startup from the DB tier pools
_tier_pools: dict[str, list] = {"S": [], "A": [], "B": [], "C": []}


def set_tier_pools(pools: dict[str, list]) -> None:
    global _tier_pools
    _tier_pools = pools


def get_session_for_player(player_id: str) -> GameSession:
    s = _session_by_player.get(player_id)
    if s is None:
        raise LookupError("no session for player")
    return s


def get_session_by_match(match_id: str) -> GameSession:
    s = _sessions_by_match.get(match_id)
    if s is None:
        raise LookupError("no session for match")
    return s


def _build_and_register_session(player_a_id: str, player_b_id: str) -> GameSession:
    match_id = str(uuid.uuid4())
    board, pity_pool = BoardBuilder().build(_tier_pools)
    session = GameSession(
        match_id=match_id,
        board=board,
        pity_pool=pity_pool,
        players={
            player_a_id: PlayerState(player_id=player_a_id),
            player_b_id: PlayerState(player_id=player_b_id),
        },
    )
    _sessions_by_match[match_id] = session
    _session_by_player[player_a_id] = session
    _session_by_player[player_b_id] = session
    return session


# ── Challenge matchmaking (CreateMatch / JoinMatch) ────────────────────────

_pending_challenge: dict[
    str, dict
] = {}  # match_id -> {"creator_id", "join_code", "session"}


def create_challenge_match(player_id: str) -> tuple[str, str]:
    """Create a challenge session (board not built yet). Returns (match_id, join_code)."""
    match_id = str(uuid.uuid4())
    join_code = str(uuid.uuid4())[:6].upper()
    # Placeholder session — board built when second player joins
    session = GameSession(match_id=match_id)
    session.players[player_id] = PlayerState(player_id=player_id)
    _sessions_by_match[match_id] = session
    _session_by_player[player_id] = session
    _pending_challenge[match_id] = {
        "creator_id": player_id,
        "join_code": join_code,
    }
    return match_id, join_code


def join_challenge_match(match_id: str, player_id: str, join_code: str) -> GameSession:
    """Validate join code, add second player, build the board. Returns the session."""
    pending = _pending_challenge.get(match_id)
    if pending is None:
        raise ValueError("match not found")
    if pending["join_code"] != join_code:
        raise ValueError("invalid join code")

    session = _sessions_by_match[match_id]
    creator_id = pending["creator_id"]
    del _pending_challenge[match_id]

    board, pity_pool = BoardBuilder().build(_tier_pools)
    session.board = board
    session.pity_pool = pity_pool
    session.players[player_id] = PlayerState(player_id=player_id)
    _session_by_player[player_id] = session
    return session


# ── Ranked matchmaking (FindRankedMatch) ───────────────────────────────────


async def find_ranked_match(player_id: str) -> str:
    """Park until paired; returns match_id once paired."""
    global _ranked_waiter
    if _ranked_waiter is None:
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        _ranked_waiter = {"player_id": player_id, "future": fut}
        match_id: str = await fut
        return match_id
    else:
        opp = _ranked_waiter
        _ranked_waiter = None
        session = _build_and_register_session(opp["player_id"], player_id)
        opp["future"].set_result(session.match_id)
        return session.match_id
