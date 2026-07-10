"""
Loads player season data from nba_stats.db (raw_stats table) into the game DB's
player_seasons table.

Column mapping (raw_stats → player_seasons):
  player_name  <- player_name
  season       <- season          (integer year, stored as text e.g. "1991")
  team         <- team
  position     <- pos             (first token of "/" or "-"; normalize to PG/SG/SF/PF/C)
  laker_score  <- rapm_total      (LAKER Tot = Off + Def combined RAPM)
  rapm         <- rapm_total      (same column)
  rapm_offense <- rapm_offense    (LAKER Off)
  rapm_defense <- rapm_defense    (LAKER Def)
  war          <- war
  player_id    <- f"{player_name}_{season}" spaces→_ lowercased

Only regular-season rows load (type='RS'): playoff lines are small-sample and
would collide with the RS row on player_id. Mid-season trades leave one RS row
per team for the same player-season; the strongest line wins deterministically
(highest laker_score, team name as tiebreak).
"""

import re
import sqlite3
import aiosqlite
from constants import LAKER_FLOOR, TIER_THRESHOLDS

RAW_DB_PATH = "server/data/nba_stats.db"

VALID_POSITIONS = {"PG", "SG", "SF", "PF", "C"}

# Bare forward/guard labels map to a fixed position so lineup bonuses stay
# well-defined; unknown values fail the load loudly rather than defaulting.
_POSITION_ALIASES = {"F": "SF", "G": "SG"}


def _normalize_position(raw_pos) -> str:
    text = "" if raw_pos is None else str(raw_pos).strip().upper()
    if not text or text == "NAN":
        raise ValueError(f"missing position: {raw_pos!r}")
    token = re.split(r"[/-]", text)[0].strip()
    token = _POSITION_ALIASES.get(token, token)
    if token not in VALID_POSITIONS:
        raise ValueError(f"unknown position: {raw_pos!r}")
    return token


def _assign_tier(score: float) -> str:
    if score >= TIER_THRESHOLDS["S"]:
        return "S"
    if score >= TIER_THRESHOLDS["A"]:
        return "A"
    if score >= TIER_THRESHOLDS["B"]:
        return "B"
    return "C"


def _make_player_id(name: str, season) -> str:
    return f"{name}_{season}".replace(" ", "_").lower()


async def load_player_seasons(game_db: aiosqlite.Connection) -> int:
    """
    Reads regular-season raw_stats from nba_stats.db, filters
    laker_score >= LAKER_FLOOR, dedupes traded player-seasons, assigns tiers,
    and fully reloads game_db's player_seasons. Returns the row count.
    """
    raw = sqlite3.connect(RAW_DB_PATH)
    raw.row_factory = sqlite3.Row
    rows = raw.execute(
        "SELECT player_name, season, team, pos, rapm_total, rapm_offense, rapm_defense, war"
        " FROM raw_stats WHERE type='RS' AND rapm_total IS NOT NULL AND rapm_total >= ?",
        (LAKER_FLOOR,),
    ).fetchall()
    raw.close()

    # One row per player_id: for traded player-seasons keep the strongest line.
    best: dict[str, sqlite3.Row] = {}
    for r in rows:
        player_id = _make_player_id(r["player_name"], r["season"])
        cur = best.get(player_id)
        if cur is None or (r["rapm_total"], r["team"]) > (
            cur["rapm_total"],
            cur["team"],
        ):
            best[player_id] = r

    # Full reload: a filter/dedup change must not leave stale rows behind.
    await game_db.execute("DELETE FROM player_seasons")
    for player_id, r in best.items():
        laker_score = float(r["rapm_total"])
        await game_db.execute(
            """INSERT INTO player_seasons
               (player_id, player_name, season, team, position,
                laker_score, rapm, rapm_offense, rapm_defense, war, tier)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                player_id,
                r["player_name"],
                str(r["season"]),
                r["team"],
                _normalize_position(r["pos"]),
                laker_score,
                laker_score,
                float(r["rapm_offense"]) if r["rapm_offense"] is not None else 0.0,
                float(r["rapm_defense"]) if r["rapm_defense"] is not None else 0.0,
                float(r["war"]) if r["war"] is not None else 0.0,
                _assign_tier(laker_score),
            ),
        )

    await game_db.commit()
    return len(best)
