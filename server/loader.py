"""
Loads player season data from nba_stats.db (raw_stats table) into the game DB's
player_seasons table.

Column mapping (raw_stats → player_seasons):
  player_name  <- player_name
  season       <- season          (integer year, stored as text e.g. "1991")
  team         <- team
  position     <- pos             (take first token; normalize to PG/SG/SF/PF/C)
  laker_score  <- rapm_total      (LAKER Tot = Off + Def combined RAPM)
  rapm         <- rapm_total      (same column)
  rapm_offense <- rapm_offense    (LAKER Off)
  rapm_defense <- rapm_defense    (LAKER Def)
  war          <- war
  player_id    <- f"{player_name}_{season}" spaces→_ lowercased
"""

import sqlite3
import aiosqlite
from constants import LAKER_FLOOR, TIER_THRESHOLDS

RAW_DB_PATH = "server/data/nba_stats.db"

VALID_POSITIONS = {"PG", "SG", "SF", "PF", "C"}


def _normalize_position(raw_pos) -> str:
    if not raw_pos or str(raw_pos).strip().upper() == "NAN":
        return "PG"
    token = str(raw_pos).split("/")[0].strip().upper()
    return token if token in VALID_POSITIONS else "PG"


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
    Reads raw_stats from nba_stats.db, filters laker_score >= LAKER_FLOOR,
    assigns tiers, and upserts qualifying rows into game_db's player_seasons.
    Returns the number of rows upserted.
    """
    raw = sqlite3.connect(RAW_DB_PATH)
    raw.row_factory = sqlite3.Row
    rows = raw.execute(
        "SELECT player_name, season, team, pos, rapm_total, rapm_offense, rapm_defense, war"
        " FROM raw_stats WHERE rapm_total IS NOT NULL AND rapm_total >= ?",
        (LAKER_FLOOR,),
    ).fetchall()
    raw.close()

    upserted = 0
    for r in rows:
        laker_score = float(r["rapm_total"])
        player_id = _make_player_id(r["player_name"], r["season"])
        tier = _assign_tier(laker_score)
        position = _normalize_position(r["pos"])

        await game_db.execute(
            """INSERT INTO player_seasons
               (player_id, player_name, season, team, position,
                laker_score, rapm, rapm_offense, rapm_defense, war, tier)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(player_id) DO UPDATE SET
                 player_name=excluded.player_name,
                 season=excluded.season,
                 team=excluded.team,
                 position=excluded.position,
                 laker_score=excluded.laker_score,
                 rapm=excluded.rapm,
                 rapm_offense=excluded.rapm_offense,
                 rapm_defense=excluded.rapm_defense,
                 war=excluded.war,
                 tier=excluded.tier""",
            (
                player_id,
                r["player_name"],
                str(r["season"]),
                r["team"],
                position,
                laker_score,
                laker_score,
                float(r["rapm_offense"]) if r["rapm_offense"] is not None else 0.0,
                float(r["rapm_defense"]) if r["rapm_defense"] is not None else 0.0,
                float(r["war"]) if r["war"] is not None else 0.0,
                tier,
            ),
        )
        upserted += 1

    await game_db.commit()
    return upserted
