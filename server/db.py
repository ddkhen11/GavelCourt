"""
Column mapping from server/data/nba_stats.db (raw_stats table) to player_seasons:
  raw: player_name     -> player_name
  raw: season          -> season       (integer year stored as text, e.g. "1991")
  raw: team            -> team
  raw: pos             -> position     (may be multi-position like "PG/SG"; take first token)
  raw: rapm_total      -> laker_score  (LAKER Tot = Off + Def combined RAPM)
  raw: rapm_total      -> rapm         (same column — total RAPM)
  raw: rapm_offense    -> rapm_offense (LAKER Off)
  raw: rapm_defense    -> rapm_defense (LAKER Def)
  raw: war             -> war          (wins above replacement)
"""

import aiosqlite
from datetime import datetime, timezone

_db: aiosqlite.Connection | None = None


async def init_db(path: str = "server/data/game.db") -> aiosqlite.Connection:
    global _db
    _db = await aiosqlite.connect(path)
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.executescript("""
        CREATE TABLE IF NOT EXISTS player_seasons (
          player_id    TEXT PRIMARY KEY,
          player_name  TEXT NOT NULL,
          season       TEXT NOT NULL,
          team         TEXT NOT NULL,
          position     TEXT NOT NULL,
          laker_score  REAL NOT NULL,
          rapm         REAL NOT NULL,
          rapm_offense REAL NOT NULL,
          rapm_defense REAL NOT NULL,
          war          REAL NOT NULL,
          tier         TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS players (
          player_id  TEXT PRIMARY KEY,
          username   TEXT NOT NULL,
          auth_token TEXT NOT NULL UNIQUE,
          elo        INTEGER NOT NULL DEFAULT 1000,
          wins       INTEGER NOT NULL DEFAULT 0,
          losses     INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS matches (
          match_id            TEXT PRIMARY KEY,
          player_a_id         TEXT NOT NULL,
          player_b_id         TEXT NOT NULL,
          winner_id           TEXT,
          player_a_score      REAL,
          player_b_score      REAL,
          player_a_elo_change INTEGER,
          player_b_elo_change INTEGER,
          completed_at        TEXT
        );
    """)
    await _db.commit()
    return _db


def get_db() -> aiosqlite.Connection:
    if _db is None:
        raise RuntimeError("Database not initialised — call init_db() first")
    return _db


async def get_player_seasons_by_tier() -> dict[str, list[dict]]:
    """Return all player_seasons rows grouped by tier."""
    tiers: dict[str, list[dict]] = {"S": [], "A": [], "B": [], "C": []}
    async with get_db().execute("SELECT * FROM player_seasons") as cur:
        async for row in cur:
            d = dict(row)
            tiers.setdefault(d["tier"], []).append(d)
    return tiers


async def register_player(player_id: str, username: str, auth_token: str) -> None:
    await get_db().execute(
        "INSERT INTO players (player_id, username, auth_token, created_at) VALUES (?,?,?,?)",
        (player_id, username, auth_token, datetime.now(timezone.utc).isoformat()),
    )
    await get_db().commit()


async def verify_token(player_id: str, token: str) -> bool:
    async with get_db().execute(
        "SELECT 1 FROM players WHERE player_id=? AND auth_token=?", (player_id, token)
    ) as cur:
        return await cur.fetchone() is not None


async def get_player_elo(player_id: str) -> int:
    async with get_db().execute(
        "SELECT elo FROM players WHERE player_id=?", (player_id,)
    ) as cur:
        row = await cur.fetchone()
        return row["elo"] if row else 1000


async def get_leaderboard(limit: int = 20) -> list[dict]:
    """Players ranked by elo descending."""
    async with get_db().execute(
        "SELECT username, elo, wins, losses FROM players ORDER BY elo DESC LIMIT ?",
        (limit,),
    ) as cur:
        return [dict(row) for row in await cur.fetchall()]


async def record_match(
    session, scores: dict, elo_changes: dict, winner_id: str | None
) -> None:
    """Persist match result and update player elo/win/loss counters.

    winner_id comes from finalize_game (None == tie). It is passed explicitly
    rather than derived from scores because a forfeiting player loses even
    with the higher score.
    """
    db = get_db()
    player_ids = list(session.players.keys())
    a_id, b_id = player_ids[0], player_ids[1]

    await db.execute(
        """INSERT INTO matches
           (match_id, player_a_id, player_b_id, winner_id,
            player_a_score, player_b_score,
            player_a_elo_change, player_b_elo_change, completed_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            session.match_id,
            a_id,
            b_id,
            winner_id,
            scores[a_id],
            scores[b_id],
            elo_changes[a_id],
            elo_changes[b_id],
            datetime.now(timezone.utc).isoformat(),
        ),
    )

    for pid, delta in elo_changes.items():
        won = winner_id == pid
        lost = winner_id is not None and winner_id != pid
        await db.execute(
            "UPDATE players SET elo=elo+?, wins=wins+?, losses=losses+? WHERE player_id=?",
            (delta, int(won), int(lost), pid),
        )

    await db.commit()
