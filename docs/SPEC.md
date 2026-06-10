# NBA Auction Draft — Project Spec (corrected)

This document is the single source of truth for building this project. Design decisions
here are final. Do not deviate from these patterns without flagging it first.

> This is the **corrected** spec. It supersedes the original draft. A changelog of the
> fixes applied is at the bottom (see "Corrections Log"). Where this document and the
> original disagree, this document wins.

---

## Project Overview

A real-time 1v1 multiplayer NBA auction draft game. Both players draw from the same blind
board of historical NBA player-seasons. Cards flip one at a time. Both players secretly bid
credits on each card simultaneously. Bids reveal at the same time. Higher bid wins the
player. If both pass, the card disappears. **Each player drafts exactly 5 players.** Best
LAKER-score lineup wins. Full Elo ranking system.

**Roster rule (important):** a player who already holds 5 players is *full* and is excluded
from all further bidding (auto-passes). The other player keeps drafting from the remaining
board, now uncontested, until they also reach 5. The match ends when both rosters are full
or the board (plus pity reserves) is exhausted. A **reserve rule** guarantees neither player
can overspend themselves below 5 (see "Bidding rules").

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend language | Python 3.11+ |
| gRPC library | `grpcio` + `grpcio-tools` |
| Async runtime | `grpcio.aio` (asyncio) |
| Database | SQLite via `aiosqlite` |
| Proto codegen (backend) | `grpcio-tools` |
| Proto codegen (frontend) | `protoc-gen-grpc-web` |
| grpc-web proxy | `grpcwebproxy` binary (Improbable) — see note below |
| Frontend language | TypeScript |
| Frontend framework | React (Vite) |
| Frontend gRPC client | `@grpc/grpc-web` + `google-protobuf` |

> **grpc-web proxy note:** Improbable's `grpcwebproxy` is effectively unmaintained but works
> fine for local dev. If it gives trouble, swap in **Envoy** with the `grpc_web` filter — the
> client code does not change. Keep `grpcwebproxy` as the documented default for now.

**requirements.txt:**
```
grpcio>=1.60.0
grpcio-tools>=1.60.0
grpcio-reflection>=1.60.0
aiosqlite>=0.19.0
pandas>=2.0.0
openpyxl>=3.1.0
```

**package.json dependencies (frontend):**
```json
{
  "@grpc/grpc-web": "^1.5.0",
  "google-protobuf": "^3.21.0"
}
```

---

## Repository Structure

```
NBAAuctionDraftGame/
├── proto/
│   └── duel.proto               # source of truth — never edit gen/ directly
├── gen/
│   ├── duel_pb2.py              # generated — do not edit
│   └── duel_pb2_grpc.py         # generated — do not edit
├── server/
│   ├── main.py                  # server bootstrap + reflection
│   ├── constants.py             # all tunables in one place (NEW)
│   ├── servicer.py              # DuelServiceImpl (subclasses generated Servicer)
│   ├── matchmaking.py           # session registry + ranked queue + match creation (NEW)
│   ├── session.py               # GameSession, PlayerState, PlayerSeason dataclasses
│   ├── game_loop.py             # game_loop() coroutine — state machine
│   ├── board.py                 # BoardBuilder — tiered board construction + pity pool
│   ├── scoring.py               # LAKER scoring + lineup bonus calculation
│   ├── elo.py                   # Elo rating calculation (win/loss + tie)
│   ├── db.py                    # all SQLite interactions via aiosqlite
│   └── data/
│       └── laker_stats.xlsx     # real LAKER stats 1977-2026 — provided at session start
├── client/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── grpc/                # generated TS stubs (from protoc-gen-grpc-web)
│   │   │   ├── DuelServiceClientPb.ts
│   │   │   ├── duel_pb.js
│   │   │   └── duel_pb.d.ts
│   │   ├── hooks/
│   │   │   ├── useMatch.ts      # matchmaking (Find Ranked Match + Challenge)
│   │   │   └── useDuel.ts       # StreamDuel bidi stream management
│   │   └── components/
│   │       ├── Lobby.tsx        # "Find Ranked Match" button + challenge code UI
│   │       ├── Board.tsx        # card flip display + bid input
│   │       ├── Lineup.tsx       # your drafted lineup
│   │       └── Results.tsx
│   ├── package.json
│   └── vite.config.ts           # dev server pinned to port 3000
├── scripts/
│   └── gen_proto.sh             # runs protoc for both backend and frontend
├── requirements.txt
├── CLAUDE.md                    # session guide for Claude Code
├── SPEC.md                      # this file
└── README.md
```

> **There is no `player_seasons.json`.** The original draft mentioned both an xlsx and a JSON
> file as the data source — that was a contradiction. The authoritative source is the
> **xlsx** at `server/data/laker_stats.xlsx`, loaded with pandas. Ignore any reference to
> `player_seasons.json`.

---

## Proto Schema

File: `proto/duel.proto`

```protobuf
syntax = "proto3";

package duel.v1;

service DuelService {
  // Unary — registration (creates the player row, returns the auth token)
  rpc RegisterPlayer(RegisterPlayerRequest) returns (RegisterPlayerResponse);

  // Unary — CHALLENGE matchmaking (private match via join code)
  rpc CreateMatch(CreateMatchRequest)  returns (CreateMatchResponse);
  rpc JoinMatch(JoinMatchRequest)      returns (JoinMatchResponse);

  // Unary — RANKED matchmaking ("Find Ranked Match" button). Awaits pairing.
  rpc FindRankedMatch(FindRankedMatchRequest) returns (FindRankedMatchResponse);

  // Bidi streaming — one stream per player, open for the entire match
  rpc StreamDuel(stream PlayerAction)  returns (stream GameEvent);

  // Server streaming — spectators (neutral view)
  rpc WatchMatch(WatchMatchRequest)    returns (stream GameEvent);
}

// ── Registration ───────────────────────────────────────

message RegisterPlayerRequest  { string username = 1; }
message RegisterPlayerResponse {
  string player_id  = 1;   // server-generated uuid
  string auth_token = 2;   // server-generated uuid; client stores it (localStorage)
}

// ── Matchmaking ────────────────────────────────────────

message CreateMatchRequest {
  string player_id = 1;
  MatchMode mode   = 2;    // CHALLENGE only via this RPC; RANKED uses FindRankedMatch
}

message CreateMatchResponse {
  string match_id  = 1;
  string join_code = 2;    // set for CHALLENGE mode
}

message JoinMatchRequest {
  string match_id  = 1;
  string player_id = 2;
  string join_code = 3;    // required for CHALLENGE mode
}

message JoinMatchResponse {
  string match_id    = 1;
  MatchStatus status = 2;
}

message FindRankedMatchRequest  { string player_id = 1; }
message FindRankedMatchResponse {
  string match_id    = 1;  // set once paired
  MatchStatus status = 2;  // READY once paired
}

message WatchMatchRequest { string match_id = 1; }

enum MatchMode {
  MATCH_MODE_UNSPECIFIED = 0;
  MATCH_MODE_RANKED      = 1;
  MATCH_MODE_CHALLENGE   = 2;
}

enum MatchStatus {
  MATCH_STATUS_UNSPECIFIED = 0;
  MATCH_STATUS_WAITING     = 1;
  MATCH_STATUS_READY       = 2;
  MATCH_STATUS_IN_PROGRESS = 3;
  MATCH_STATUS_COMPLETE    = 4;
}

// ── Player Actions (client → server) ───────────────────

message PlayerAction {
  oneof action {
    ReadyAction ready = 1;
    BidAction   bid   = 2;
    PassAction  pass  = 3;
  }
}

message ReadyAction {}
message BidAction   { uint32 amount = 1; }  // 0 is treated as a pass
message PassAction  {}

// ── Game Events (server → client) ──────────────────────

message GameEvent {
  oneof event {
    GameStartedEvent   game_started   = 1;
    CardFlippedEvent   card_flipped   = 2;
    BidWindowOpenEvent bid_window_open = 3;
    BidResolvedEvent   bid_resolved   = 4;
    CardPassedEvent    card_passed    = 5;
    PityTriggeredEvent pity_triggered = 6;
    GameEndedEvent     game_ended     = 7;
    ErrorEvent         error          = 8;
  }
}

message GameStartedEvent {
  string match_id     = 1;
  uint32 board_size   = 2;
  uint32 your_credits = 3;   // STARTING_CREDITS (100)
  uint32 roster_size  = 4;   // ROSTER_SIZE (5)
}

message CardFlippedEvent {
  uint32   card_number     = 1;  // 1-indexed (counts every card shown, incl. pity)
  uint32   cards_remaining = 2;  // board cards still to come after this one
  CardInfo card            = 3;
  CardTier tier            = 4;
}

message CardInfo {
  string player_id   = 1;
  string player_name = 2;
  string season      = 3;  // e.g. "1991"
  string team        = 4;
  string position    = 5;  // PG / SG / SF / PF / C — identity, NOT a hidden stat
  // Performance stats intentionally omitted here — hidden until after bid resolves
}

enum CardTier {
  CARD_TIER_UNSPECIFIED = 0;
  CARD_TIER_S           = 1;
  CARD_TIER_A           = 2;
  CARD_TIER_B           = 3;
  CARD_TIER_C           = 4;
}

message BidWindowOpenEvent {
  uint32 duration_seconds = 1;  // BID_WINDOW_SECONDS (10)
  uint32 your_max_bid     = 2;  // reserve-rule cap for THIS player on THIS card
}

message BidResolvedEvent {
  bool      you_won                    = 1;
  uint32    winning_bid                = 2;
  uint32    your_bid                   = 3;
  uint32    opponent_bid               = 4;
  CardStats revealed_stats             = 5;   // stats revealed here
  uint32    your_credits_remaining     = 6;
  uint32    opponent_credits_remaining = 7;
  uint32    your_players_drafted       = 8;
  uint32    opponent_players_drafted   = 9;
}

// CardStats is self-contained: it carries identity AND stats so the Results screen
// can render full lineups without a separate lookup.
message CardStats {
  string player_id    = 1;
  string player_name  = 2;
  string season       = 3;
  string team         = 4;
  string position     = 5;
  float  laker_score  = 6;
  float  rapm         = 7;
  float  rapm_offense = 8;
  float  rapm_defense = 9;
  float  war          = 10;
}

message CardPassedEvent {
  uint32 consecutive_passes = 1;  // pity counter — shown in UI
}

message PityTriggeredEvent {}     // the card being flipped now is guaranteed A-tier or better

message GameEndedEvent {
  GameResult result          = 1;
  Lineup     your_lineup     = 2;
  Lineup     opponent_lineup = 3;
  float      your_score      = 4;
  float      opponent_score  = 5;
  int32      elo_change      = 6;
  bool       by_forfeit      = 7;  // true if the opponent disconnected
}

message Lineup {
  repeated CardStats players      = 1;
  float              impact_score = 2;
  float              bonus        = 3;
  float              total_score  = 4;
}

enum GameResult {
  GAME_RESULT_UNSPECIFIED = 0;
  GAME_RESULT_WIN         = 1;
  GAME_RESULT_LOSS        = 2;
  GAME_RESULT_TIE         = 3;
}

message ErrorEvent {
  string code    = 1;  // BID_EXCEEDS_BALANCE | BID_EXCEEDS_MAX | INVALID_PHASE | ROSTER_FULL
  string message = 2;
}
```

---

## Codegen Script

File: `scripts/gen_proto.sh`

```bash
#!/bin/bash
set -euo pipefail

# Backend (Python)
python -m grpc_tools.protoc \
  --python_out=gen/ \
  --grpc_python_out=gen/ \
  --proto_path=proto/ \
  proto/duel.proto

# Frontend (TypeScript via protoc-gen-grpc-web)
protoc \
  --js_out=import_style=commonjs:client/src/grpc \
  --grpc-web_out=import_style=typescript,mode=grpcwebtext:client/src/grpc \
  --proto_path=proto/ \
  proto/duel.proto
```

---

## Database Schema

File: `server/db.py` — use `aiosqlite`. Three tables.

```sql
-- Static player data, loaded from data/laker_stats.xlsx at startup
CREATE TABLE IF NOT EXISTS player_seasons (
  player_id    TEXT PRIMARY KEY,  -- e.g. "michaeljordan_1991"
  player_name  TEXT NOT NULL,
  season       TEXT NOT NULL,     -- e.g. "1991"
  team         TEXT NOT NULL,
  position     TEXT NOT NULL,     -- "PG" | "SG" | "SF" | "PF" | "C"
  laker_score  REAL NOT NULL,
  rapm         REAL NOT NULL,
  rapm_offense REAL NOT NULL,
  rapm_defense REAL NOT NULL,
  war          REAL NOT NULL,
  tier         TEXT NOT NULL      -- "S" | "A" | "B" | "C"
);

-- One row per registered player
CREATE TABLE IF NOT EXISTS players (
  player_id  TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  auth_token TEXT NOT NULL UNIQUE,   -- simple UUID bearer token (no OAuth)
  elo        INTEGER NOT NULL DEFAULT 1000,
  wins       INTEGER NOT NULL DEFAULT 0,
  losses     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Match history
CREATE TABLE IF NOT EXISTS matches (
  match_id            TEXT PRIMARY KEY,
  player_a_id         TEXT NOT NULL,
  player_b_id         TEXT NOT NULL,
  winner_id           TEXT,          -- NULL if tie
  player_a_score      REAL,
  player_b_score      REAL,
  player_a_elo_change INTEGER,
  player_b_elo_change INTEGER,
  completed_at        TEXT
);
```

**Connection handling:** open **one** shared `aiosqlite` connection at startup and reuse it.
aiosqlite serializes operations through its own worker thread, so a single connection is
safe across coroutines. Enable WAL once at startup:
`await db.execute("PRAGMA journal_mode=WAL")`.

---

## Player Seasons Data

A real spreadsheet covering all NBA player-seasons from 1977–2026 with LAKER scores is
provided at `server/data/laker_stats.xlsx`. Do not mock this data or create placeholder rows.

**First task before any data-loading code:** open the xlsx, print column names and a few
sample rows, and map columns explicitly to: player name, season year, team, **position**,
LAKER score, RAPM, offensive RAPM, defensive RAPM, WAR. Real column names will differ from
the names used in this spec — map them before writing the loader. **Position is required**
(scoring bonuses depend on it). If the sheet encodes multiple positions (e.g. "PG/SG"),
take the first/primary token and normalize to one of `PG, SG, SF, PF, C`.

**Loading pipeline:**
1. Read the xlsx with `pandas` (`openpyxl` engine).
2. Filter to rows where `laker_score >= LAKER_FLOOR` (3.5). Everything below is excluded.
3. Assign tiers at load time from `laker_score`:
   - S: `>= 9.0`
   - A: `7.0 <= score < 9.0`
   - B: `5.0 <= score < 7.0`
   - C: `3.5 <= score < 5.0`
4. Generate a stable, deterministic `player_id` as `f"{player_name}_{season}"` with spaces
   replaced by underscores, lowercased.
5. Upsert all qualifying rows into `player_seasons` (on conflict by `player_id`).

---

## Constants

File: `server/constants.py` — single source of truth for tunables (referenced everywhere;
do not hardcode these numbers in more than one place).

```python
STARTING_CREDITS    = 100
ROSTER_SIZE         = 5
BOARD_SIZE          = 20
BID_WINDOW_SECONDS  = 10
PITY_THRESHOLD      = 2        # consecutive passes that trigger a pity card
LAKER_FLOOR         = 3.5
MIN_BID             = 1        # smallest winning bid; amount 0 == pass

TIER_THRESHOLDS = {"S": 9.0, "A": 7.0, "B": 5.0, "C": 3.5}   # lower bounds
BOARD_FILL_WEIGHTS = {"S": 0.08, "A": 0.22, "B": 0.42, "C": 0.28}
ELO_K = 32
```

---

## Dataclasses

File: `server/session.py`

```python
from dataclasses import dataclass, field
from asyncio import Queue, Task
from enum import Enum
from constants import STARTING_CREDITS, ROSTER_SIZE

@dataclass
class PlayerSeason:
    player_id: str
    player_name: str
    season: str
    team: str
    position: str          # PG | SG | SF | PF | C
    laker_score: float
    rapm: float
    rapm_offense: float
    rapm_defense: float
    war: float
    tier: str              # S | A | B | C

class Phase(Enum):
    WAITING    = "WAITING"     # waiting for both players to connect and send Ready
    BID_WINDOW = "BID_WINDOW"  # bid window open; only here are bids/passes accepted
    RESOLVING  = "RESOLVING"   # bids collected, computing result
    GAME_OVER  = "GAME_OVER"

@dataclass
class PlayerState:
    player_id: str
    credits: int = STARTING_CREDITS
    lineup: list = field(default_factory=list)   # list of PlayerSeason
    connected: bool = False
    disconnected: bool = False                   # set if the stream drops mid-match

    def is_full(self) -> bool:
        return len(self.lineup) >= ROSTER_SIZE

    def empty_slots(self) -> int:
        return ROSTER_SIZE - len(self.lineup)

    def max_bid(self) -> int:
        # Reserve rule: keep >= 1 credit per remaining slot after this one.
        return max(0, self.credits - (self.empty_slots() - 1))

@dataclass
class GameSession:
    match_id: str
    board: list = field(default_factory=list)            # ordered PlayerSeason list
    pity_pool: list = field(default_factory=list)        # S+A cards NOT on the board
    board_index: int = 0
    phase: Phase = Phase.WAITING
    players: dict = field(default_factory=dict)          # player_id -> PlayerState
    consecutive_passes: int = 0
    ready_players: set = field(default_factory=set)
    game_loop_started: bool = False
    # Per-player queues (NOT one shared action queue — see "Game loop" rationale)
    action_queues: dict = field(default_factory=dict)    # player_id -> Queue[PlayerAction]
    event_queues: dict = field(default_factory=dict)     # player_id -> Queue[GameEvent]
    spectator_queues: dict = field(default_factory=dict) # spectator_id -> Queue[GameEvent]
    # Keep strong refs to spawned tasks so they are not garbage-collected.
    reader_tasks: dict = field(default_factory=dict)     # player_id -> Task
    loop_task: "Task | None" = None

    def current_card(self):
        return self.board[self.board_index] if self.board_index < len(self.board) else None

    def cards_remaining(self):
        return len(self.board) - self.board_index

    def both_full(self):
        return all(p.is_full() for p in self.players.values())
```

---

## Board Construction

File: `server/board.py`

The builder returns the ordered board **and** the leftover S+A cards used as the pity pool.

```python
import random
from constants import BOARD_SIZE, BOARD_FILL_WEIGHTS

class BoardBuilder:
    def build(self, tier_pools: dict[str, list]) -> tuple[list, list]:
        """
        Returns (board, pity_pool).
        board     = ordered list of ~BOARD_SIZE PlayerSeason objects for one match.
        pity_pool = all S and A cards NOT placed on the board (drawn from when pity fires).
        tier_pools = {"S": [...], "A": [...], "B": [...], "C": [...]}
        """
        # Step 1: guaranteed minimums (sample without replacement)
        board = []
        board += random.sample(tier_pools["S"], min(1, len(tier_pools["S"])))
        board += random.sample(tier_pools["A"], min(2, len(tier_pools["A"])))
        used_ids = {p.player_id for p in board}

        # Step 2: probabilistic fill to reach BOARD_SIZE cards total
        available = {
            tier: [p for p in pool if p.player_id not in used_ids]
            for tier, pool in tier_pools.items()
        }
        weights = BOARD_FILL_WEIGHTS
        while len(board) < BOARD_SIZE and any(available.values()):
            tier = random.choices(list(weights), weights=list(weights.values()))[0]
            if not available[tier]:
                continue
            pick = random.choice(available[tier])
            board.append(pick)
            available[tier].remove(pick)
            used_ids.add(pick.player_id)

        # Step 3: shuffle with constraints
        for _ in range(100):  # max retry attempts
            random.shuffle(board)
            if self._constraints_pass(board):
                break

        # Pity pool: every S/A card not on the board
        pity_pool = [p for tier in ("S", "A") for p in available[tier]]
        return board, pity_pool

    def _constraints_pass(self, board) -> bool:
        # Constraint A: no more than 2 consecutive C-tier cards
        consecutive_c = 0
        for card in board:
            if card.tier == "C":
                consecutive_c += 1
                if consecutive_c > 2:
                    return False
            else:
                consecutive_c = 0
        # Constraint B: at least 1 S/A card in the first 5 positions
        if not any(c.tier in ("S", "A") for c in board[:5]):
            return False
        return True
```

**Unit test:** build 20 boards; assert constraints hold on each and that `len(board)` is
`min(BOARD_SIZE, total available)`.

---

## Matchmaking, Registration & Session Registry

File: `server/matchmaking.py` (+ unary handlers in `servicer.py`)

A module-level registry maps players to their session and tracks the ranked queue:

```python
_sessions_by_match: dict[str, GameSession] = {}
_session_by_player: dict[str, GameSession] = {}   # player_id -> session (StreamDuel lookup)
_ranked_waiter: dict | None = None                # {"player_id", "future"} or None

def get_session_for_player(player_id: str) -> GameSession:
    s = _session_by_player.get(player_id)
    if s is None:
        raise LookupError("no session for player")   # servicer maps to NOT_FOUND
    return s
```

**`RegisterPlayer(username)`** — generate `player_id = uuid4()` and `auth_token = uuid4()`,
insert into `players` (elo=1000, created_at=now), return both. The client persists them.

**`CreateMatch` (CHALLENGE)** — create a `GameSession` in `WAITING`, generate a join code,
register the creator as player A, register `player_id -> session`. Return `match_id` +
`join_code`. The board is NOT built yet (wait for the second player).

**`JoinMatch` (CHALLENGE)** — validate the join code, add player B, build the board +
pity pool from DB tier pools, register `player_id -> session`, set status `READY`. Both
clients now open `StreamDuel`.

**`FindRankedMatch(player_id)`** — server-side ranked queue, single waiting slot:
```python
async def find_ranked_match(player_id):
    global _ranked_waiter
    if _ranked_waiter is None:
        # First arrival: park on a Future until someone pairs with us.
        fut = asyncio.get_event_loop().create_future()
        _ranked_waiter = {"player_id": player_id, "future": fut}
        match_id = await fut          # resolved by the second arrival
        return FindRankedMatchResponse(match_id=match_id, status=READY)
    else:
        # Second arrival: create the match, build the board, wake the waiter.
        opp = _ranked_waiter; _ranked_waiter = None
        session = create_session_with_players(opp["player_id"], player_id)  # builds board
        opp["future"].set_result(session.match_id)
        return FindRankedMatchResponse(match_id=session.match_id, status=READY)
```
`create_session_with_players` builds the board + pity pool and registers both
`player_id -> session` mappings. (For a hobby scale this single-slot queue is enough; if you
later want skill-based pairing, replace the single waiter with an Elo-sorted list.)

**Board build timing:** always at the moment the second player is assigned (challenge join or
ranked pairing), before either opens `StreamDuel`.

---

## Server Architecture: The Asyncio Game Loop Pattern

Files: `server/servicer.py` and `server/game_loop.py`

Two `StreamDuel` coroutines run concurrently (one per player). They share a `GameSession`.
**Only `game_loop` mutates the session.** Asyncio is single-threaded, so no locks are needed.

### Why per-player action queues (corrected)

The original draft used a single shared `action_queue` consumed by two concurrent
"wait for my player's bid" coroutines that re-queued the other player's actions. That design
has two real bugs:
1. **Stale actions leak across cards.** An action that arrives outside a bid window sits in
   the shared queue and is consumed as the *next* card's bid — applying a bid to the wrong
   card.
2. **Cross-player re-queue spin.** Two consumers fighting over one queue, re-`put`-ing each
   other's items, is fragile and burns CPU.

**Fix:** one `asyncio.Queue` **per player** (`session.action_queues[pid]`). Each reader
pushes only its own player's actions. A **phase gate** ensures only bids/passes sent during
`BID_WINDOW` are enqueued; anything else gets an `INVALID_PHASE` `ErrorEvent` and is dropped.
`collect_bids` reads each player's own queue — no contention, no re-queue.

### servicer.py — StreamDuel handler

```python
async def StreamDuel(self, request_iterator, context):
    # 1. Authenticate via metadata
    md = dict(context.invocation_metadata())
    player_id, token = md.get('player-id'), md.get('auth-token')
    if not await verify_token(player_id, token):
        await context.abort(grpc.StatusCode.UNAUTHENTICATED, "invalid token")
        return

    # 2. Look up the session this player belongs to
    try:
        session = get_session_for_player(player_id)
    except LookupError:
        await context.abort(grpc.StatusCode.NOT_FOUND, "no session")
        return

    session.event_queues[player_id]  = asyncio.Queue()
    session.action_queues[player_id] = asyncio.Queue()
    session.players[player_id].connected = True

    # 3. Reader task: only enqueue actions accepted in the current phase.
    async def reader():
        try:
            async for action in request_iterator:
                if action.HasField('ready') and session.phase is Phase.WAITING:
                    await session.action_queues[player_id].put(action)
                elif action.WhichOneof('action') in ('bid', 'pass') \
                        and session.phase is Phase.BID_WINDOW:
                    await session.action_queues[player_id].put(action)
                else:
                    await session.event_queues[player_id].put(wrap(ErrorEvent(
                        code="INVALID_PHASE", message="action not accepted right now")))
        except Exception:
            pass  # client disconnected or stream errored
        finally:
            session.players[player_id].disconnected = True

    session.reader_tasks[player_id] = asyncio.create_task(reader())  # keep a strong ref

    # 4. When both players are connected, start the game loop exactly once.
    if len(session.event_queues) == 2 and not session.game_loop_started:
        session.game_loop_started = True
        session.loop_task = asyncio.create_task(game_loop(session))  # keep a strong ref

    # 5. Yield events from this player's event queue to the client.
    try:
        while True:
            event = await session.event_queues[player_id].get()
            yield event
            if event.HasField('game_ended'):
                break
    finally:
        session.players[player_id].disconnected = True
```

### game_loop.py — the state machine

```python
from constants import BID_WINDOW_SECONDS, PITY_THRESHOLD, STARTING_CREDITS, ROSTER_SIZE

async def game_loop(session: GameSession):
    """Single coroutine that drives the entire match. Only this fn mutates GameSession."""

    await wait_for_ready(session)   # both players send ReadyAction (Phase.WAITING)

    for pid in session.players:
        await send(session, pid, GameStartedEvent(
            match_id=session.match_id, board_size=len(session.board),
            your_credits=STARTING_CREDITS, roster_size=ROSTER_SIZE))

    # Main loop: continue until both rosters are full or we run out of cards.
    while not session.both_full() and session.current_card() is not None:

        # If either player has disconnected, end by forfeit.
        if any(p.disconnected for p in session.players.values()):
            return await finalize_game(session, forfeit=True)

        # Pity: replace this turn with an S/A card WITHOUT consuming a board slot.
        is_pity = False
        card = session.current_card()
        if session.consecutive_passes >= PITY_THRESHOLD and session.pity_pool:
            card = session.pity_pool.pop(random.randrange(len(session.pity_pool)))
            is_pity = True
            session.consecutive_passes = 0
            await broadcast_all(session, PityTriggeredEvent())

        # Flip the card (identity only — no stats).
        await broadcast_all(session, CardFlippedEvent(
            card_number=card_number_for(session, is_pity),
            cards_remaining=session.cards_remaining() - (0 if is_pity else 1),
            card=to_card_info(card), tier=tier_enum(card.tier)))

        # Open bid window. Full players are excluded (auto-pass).
        session.phase = Phase.BID_WINDOW
        for pid, p in session.players.items():
            await send(session, pid, BidWindowOpenEvent(
                duration_seconds=BID_WINDOW_SECONDS, your_max_bid=p.max_bid()))
        bids = await collect_bids(session, timeout=BID_WINDOW_SECONDS)  # {pid: amount}
        session.phase = Phase.RESOLVING

        if all(v == 0 for v in bids.values()):
            # Both passed (or auto-passed). The pity card, if any, does NOT advance the board.
            session.consecutive_passes += 1
            if not is_pity:
                session.board_index += 1
            await broadcast_all(session, CardPassedEvent(
                consecutive_passes=session.consecutive_passes))
            continue

        winner_id, winning_bid = resolve_auction(bids)   # tie -> coin flip
        loser_id = next(pid for pid in bids if pid != winner_id)

        session.players[winner_id].credits -= winning_bid
        session.players[winner_id].lineup.append(card)
        session.consecutive_passes = 0
        if not is_pity:
            session.board_index += 1   # a won pity card likewise does not advance the board

        for pid in (winner_id, loser_id):
            opp = loser_id if pid == winner_id else winner_id
            await send(session, pid, BidResolvedEvent(
                you_won=(pid == winner_id), winning_bid=winning_bid,
                your_bid=bids[pid], opponent_bid=bids[opp],
                revealed_stats=to_card_stats(card),
                your_credits_remaining=session.players[pid].credits,
                opponent_credits_remaining=session.players[opp].credits,
                your_players_drafted=len(session.players[pid].lineup),
                opponent_players_drafted=len(session.players[opp].lineup)))

    await finalize_game(session, forfeit=False)
```

### Bidding rules (collect_bids)

```python
async def collect_bids(session: GameSession, timeout: float) -> dict:
    bids = {pid: 0 for pid in session.players}

    async def wait_for_one_bid(player_id):
        p = session.players[player_id]
        if p.is_full():          # full roster -> excluded, auto-pass
            return
        q = session.action_queues[player_id]
        while True:
            action = await q.get()
            if action.HasField('bid'):
                amount = action.bid.amount
                if amount > p.max_bid():   # reserve rule (also catches > credits)
                    await session.event_queues[player_id].put(wrap(ErrorEvent(
                        code="BID_EXCEEDS_MAX",
                        message=f"Max bid is {p.max_bid()} "
                                f"(keep 1 credit per remaining slot)")))
                    continue             # wait for a valid bid
                bids[player_id] = amount  # 0 is allowed and means pass
                return
            elif action.HasField('pass'):
                bids[player_id] = 0
                return

    # Drain any stale actions before opening (belt-and-suspenders with the phase gate).
    for q in session.action_queues.values():
        while not q.empty():
            q.get_nowait()

    try:
        await asyncio.wait_for(
            asyncio.gather(*[wait_for_one_bid(pid) for pid in session.players]),
            timeout=timeout)
    except asyncio.TimeoutError:
        pass  # missing bids stay at 0 (treated as pass)

    return bids
```

Rules summary:
- **Amount 0 == pass.** Smallest *winning* bid is `MIN_BID` (1).
- **Reserve rule:** a bid may not exceed `player.max_bid() = credits − (empty_slots − 1)`.
  On your last open slot you may bid all remaining credits. This guarantees you can always
  fill all 5 slots.
- **Full players auto-pass** and never block the window. The non-full player wins uncontested
  at their own bid (≥1).

### Helper signatures (define these)

```python
def resolve_auction(bids) -> tuple[str, int]:
    (a, av), (b, bv) = bids.items()
    winner = random.choice([a, b]) if av == bv else (a if av > bv else b)
    return winner, bids[winner]

def wrap(event) -> GameEvent: ...          # set the correct GameEvent oneof field by type
async def send(session, pid, event): await session.event_queues[pid].put(wrap(event))
async def broadcast_all(session, event):   # players + spectators (neutral events only)
    for q in session.event_queues.values():     await q.put(wrap(event))
    for q in session.spectator_queues.values():  await q.put(wrap(event))
async def wait_for_ready(session): ...     # await a ReadyAction from each player's queue
def to_card_info(card) -> CardInfo: ...     # identity + position, NO stats
def to_card_stats(card) -> CardStats: ...   # identity + position + stats
async def verify_token(player_id, token) -> bool: ...  # check players table
```

`broadcast_all` carries only **neutral** events (flip, window, pass, pity, game_started,
game_ended). Per-player `BidResolvedEvent` is sent individually with `send`, because
`you_won` differs per player. Spectators get a neutral resolve (see WatchMatch).

---

## Scoring

File: `server/scoring.py` — LAKER scoring mirrors SixRings. `position` is now always present.

```python
from collections import Counter

def score_lineup(lineup: list[PlayerSeason]) -> tuple[float, float, float]:
    """Returns (impact_score, bonus, total_score)."""
    impact = sum(p.laker_score for p in lineup)
    bonus = calculate_bonus(lineup)
    return impact, bonus, impact + bonus

def calculate_bonus(lineup: list[PlayerSeason]) -> float:
    bonus = 0.0
    positions = [p.position for p in lineup]

    # +3 for all 5 positions represented (PG, SG, SF, PF, C)
    if len(set(positions)) == 5:
        bonus += 3.0
    # +2 for balance: no position duplicated
    if positions and max(Counter(positions).values()) <= 1:
        bonus += 2.0
    # +4 for lockdown: at least one player with rapm_defense > 2.5
    if any(p.rapm_defense > 2.5 for p in lineup):
        bonus += 4.0
    return bonus
```

> Bonuses assume a 5-player lineup. A forfeited/partial lineup is scored as-is (the position
> bonuses simply won't trigger).

---

## Elo

File: `server/elo.py` — standard Elo, K=32, with a tie path.

```python
from constants import ELO_K

def expected_score(rating_a: int, rating_b: int) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

def elo_change(winner_rating, loser_rating, k=ELO_K) -> tuple[int, int]:
    dw = round(k * (1 - expected_score(winner_rating, loser_rating)))
    dl = round(k * (0 - expected_score(loser_rating, winner_rating)))
    return dw, dl   # (winner_delta >= 0, loser_delta <= 0)

def elo_change_tie(rating_a, rating_b, k=ELO_K) -> tuple[int, int]:
    da = round(k * (0.5 - expected_score(rating_a, rating_b)))
    db = round(k * (0.5 - expected_score(rating_b, rating_a)))
    return da, db
```

---

## Game Finalization

File: `server/game_loop.py` (`finalize_game`) + `server/db.py`

```python
async def finalize_game(session, forfeit: bool):
    session.phase = Phase.GAME_OVER
    a, b = list(session.players.values())

    if forfeit:
        # Disconnected player loses regardless of score.
        loser  = next(p for p in (a, b) if p.disconnected)
        winner = a if loser is b else b
        results = {winner.player_id: WIN, loser.player_id: LOSS}
        scores  = {p.player_id: score_lineup(p.lineup)[2] for p in (a, b)}
        da, db_ = apply_elo(winner.player_id, loser.player_id, tie=False)
    else:
        sa = score_lineup(a.lineup); sb = score_lineup(b.lineup)
        scores = {a.player_id: sa[2], b.player_id: sb[2]}
        if sa[2] == sb[2]:
            results = {a.player_id: TIE, b.player_id: TIE}
            da, db_ = apply_elo(a.player_id, b.player_id, tie=True)
        else:
            winner, loser = (a, b) if sa[2] > sb[2] else (b, a)
            results = {winner.player_id: WIN, loser.player_id: LOSS}
            da, db_ = apply_elo(winner.player_id, loser.player_id, tie=False)

    # Persist: update players (elo/wins/losses), insert matches row.
    await db.record_match(session, scores, elo_changes={a.player_id: da, b.player_id: db_})

    # Send GameEndedEvent to each player (per-player result, lineup, elo_change, by_forfeit),
    # and a neutral copy to spectators. Then players' StreamDuel loops break.
```

`apply_elo` fetches both current ratings from `players`, computes deltas (win/loss or tie),
writes the new ratings + win/loss counters, and returns the per-player deltas for the events.

---

## Spectators (WatchMatch)

`WatchMatch(match_id)` registers a queue in `session.spectator_queues` and streams events
from it until `game_ended`. Spectators receive every `broadcast_all` event (flip, window,
pass, pity, started, ended). For bid resolution they get a **neutral** `BidResolvedEvent`
(both bids populated, `you_won=false`, stats revealed) pushed to spectator queues alongside
the two per-player resolves. Spectators never send actions.

---

## Local Dev Architecture

```
Terminal 1: python server/main.py          -> gRPC on :50051
Terminal 2: grpcwebproxy --backend_addr=localhost:50051 \
                         --run_tls_server=false --allow_all_origins   -> :8080
Terminal 3: cd client && npm run dev        -> React on :3000
```

`client/vite.config.ts` pins `server.port = 3000`. React talks to **port 8080**
(grpcwebproxy), never to 50051 directly. `--allow_all_origins` is fine **locally only**.

---

## Implementation Order

Build in this sequence. Do not skip phases.

**Phase 1 — Proto + codegen.** Write `duel.proto`. Run `gen_proto.sh`. Verify generated files.

**Phase 2 — Data layer.** Inspect `laker_stats.xlsx`; map columns (incl. **position**).
Write `constants.py`, `db.py` (3 tables + WAL), the xlsx loader, `board.py`. Unit-test the
board: build 20 boards, assert both constraints hold and pity_pool excludes board cards.

**Phase 3 — Server skeleton.** `session.py` dataclasses, `matchmaking.py` (registry + ranked
queue + session creation), `main.py` (bootstrap + reflection). Implement `RegisterPlayer`,
`CreateMatch`, `JoinMatch`, `FindRankedMatch`. Test with grpcurl.

**Phase 4 — Game loop.** `game_loop.py` + `servicer.py` StreamDuel handler. Per-player
queues, phase gate, reserve rule, draft cap, pity fix, disconnect/forfeit. Test with two
Python CLI clients connecting simultaneously.

**Phase 5 — Scoring + Elo.** `scoring.py`, `elo.py`, `finalize_game`, db persistence.
Verify a full match end-to-end with CLI clients.

**Phase 6 — Web frontend.** Vite + React (port 3000). grpc-web codegen. `useMatch`
(Find Ranked Match button + challenge codes), `useDuel` (bidi stream). Build Lobby, Board,
Lineup, Results.

**Phase 7 — Leaderboard.** Leaderboard query over `players` ordered by elo.

---

## Key Implementation Notes

- **No locks.** Only `game_loop` mutates `GameSession`; asyncio is single-threaded.
- **Stats are never sent in `CardFlippedEvent`.** Only `CardInfo` (name, season, team,
  position). `CardStats` (with performance numbers) appears only in `BidResolvedEvent`. This
  enforces the blind mechanic at the protocol level. Position is identity, not a hidden stat.
- **`ErrorEvent` is inline, not a stream abort.** Invalid bids → `ErrorEvent` down that
  player's stream; never `context.abort()` mid-match.
- **Tie auction → coin flip.** `random.choice([a, b])` on equal non-zero bids.
- **Pity card does not consume a board slot.** Drawn from `session.pity_pool` (S/A cards not
  on the board). When a pity card is shown, `board_index` is **not** advanced whether it is
  won or passed, so the real board card at `board_index` still gets its turn. If `pity_pool`
  is empty, pity silently does not fire.
- **Roster cap = 5.** Full players auto-pass. The reserve rule (`credits − (empty−1)`)
  guarantees both players can always reach 5.
- **Keep task refs.** Store `reader` and `game_loop` tasks on the session; tasks created with
  `create_task` can be GC'd if unreferenced.
- **Disconnect = forfeit.** If a player's stream drops mid-match, the opponent wins;
  `GameEndedEvent.by_forfeit = true`.
- **Auth.** `player-id` + `auth-token` (UUID) in gRPC metadata on `StreamDuel`, verified
  against `players`. Tokens come from `RegisterPlayer`. No OAuth.
- **One shared aiosqlite connection**, WAL enabled.

---

## Corrections Log (what changed from the original draft)

1. **Position field added** to `player_seasons`, `CardInfo`, `CardStats`, `PlayerSeason`, and
   the loader. Scoring's positional bonuses now have data to work with.
2. **Data source disambiguated:** the xlsx is authoritative; `player_seasons.json` removed.
3. **Roster cap (5) + reserve rule.** Full players auto-pass; nobody can over/under-fill.
4. **Pity off-by-one fixed.** Pity cards come from a real `pity_pool` and never advance
   `board_index`; empty-pool case guarded.
5. **Auth completed.** Added `RegisterPlayer` RPC and `auth_token` column; defined how
   tokens are issued, stored, and verified.
6. **Action-queue race fixed.** Per-player queues + phase gate replace the shared queue /
   re-queue spin; stale bids can no longer land on the wrong card.
7. **Ranked matchmaking defined** as a "Find Ranked Match" queue (single-waiter pairing).
8. **Undefined symbols specified:** `PlayerSeason`, `wait_for_ready`, `resolve_auction`,
   `wrap`/`send`/`broadcast_all`, registry helpers, `verify_token`.
9. **GameSession fields added:** `game_loop_started`, `pity_pool`, `action_queues`,
   `spectator_queues`, task refs.
10. **Elo tie path, `finalize_game`, and DB persistence** specified.
11. **WatchMatch spectators** wired with their own queues + neutral resolves.
12. **Tier-3 polish:** `constants.py`, stored task refs, disconnect/forfeit, 0-bid==pass made
    explicit, Vite port 3000, single WAL aiosqlite connection, Envoy noted as proxy fallback.
```
