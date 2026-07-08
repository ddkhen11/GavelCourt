# CLAUDE.md — NBA Auction Draft

Real-time 1v1 NBA auction draft. Both players bid credits on a shared blind board of
historical NBA player-seasons; higher bid wins. Each drafts **exactly 5**; best LAKER-score
lineup wins; Elo ranking.

**[docs/SPEC.md](docs/SPEC.md) is the single source of truth.** Read it before implementing. This file
is the quick orientation + the decisions that are easy to get wrong.

## Stack
Python 3.11 + `grpcio.aio` + `aiosqlite`; React/Vite + grpc-web. Proto in `proto/duel.proto`
(regen with `scripts/gen_proto.sh`; never edit `gen/` by hand). Build order: see SPEC §
"Implementation Order".

## Dev commands
```
python server/main.py                                   # gRPC :50051
grpcwebproxy --backend_addr=localhost:50051 --run_tls_server=false --allow_all_origins --use_websockets  # :8080
cd client && npm run dev                                 # React :3000 (pinned in vite.config)
```
Client talks to :8080, never :50051.

## First task
The data file `server/data/laker_stats.xlsx` is provided at session start. Before writing the
loader: open it, print columns + sample rows, and map them to name / season / team /
**position** / laker_score / rapm / rapm_offense / rapm_defense / war. Real column names will
differ. Filter `laker_score >= 3.5`; tier by score (S≥9, A 7–9, B 5–7, C 3.5–5);
`player_id = f"{name}_{season}"` spaces→`_`, lowercased.

## Decisions that are easy to get wrong (don't regress these)
- **Roster cap = 5.** A player with 5 is *full* → auto-passes; the other keeps drafting
  uncontested until they also reach 5. Game ends when both full or board+pity exhausted.
- **Reserve rule.** Max bid = `credits − (empty_slots − 1)` (keep ≥1 credit per future slot).
  Guarantees both players can fill all 5. Server enforces; surfaced via `your_max_bid`.
- **Per-player action queues, not one shared queue.** Only enqueue bids/passes during
  `BID_WINDOW` (phase gate) so a stale action can't land on the next card. The game loop is
  the only coroutine that mutates `GameSession` — no locks.
- **Stats are blind.** `CardFlippedEvent` carries identity only (incl. position). Performance
  stats (`CardStats`) appear only in `BidResolvedEvent`. Enforced at the protocol, not just UI.
- **Pity cards** come from `session.pity_pool` (S/A cards not on the board) and **never**
  advance `board_index` (won or passed). Empty pool → pity silently doesn't fire.
- **Auth:** `RegisterPlayer` issues `player_id` + `auth_token` (UUIDs); client stores them and
  sends them as `player-id` / `auth-token` gRPC metadata on `StreamDuel`.
- **Ranked matchmaking** = "Find Ranked Match" button → server single-waiter queue pairs the
  first two callers. Challenge mode still uses `CreateMatch`/`JoinMatch` + join code.
- **Keep strong refs** to `reader` and `game_loop` tasks on the session (GC footgun).
- **Disconnect = forfeit** (opponent wins, `GameEndedEvent.by_forfeit`). Never `context.abort`
  mid-match for a bad bid — send an inline `ErrorEvent`.
- **Amount 0 == pass.** Min winning bid is 1. Tie auction → coin flip.
- One shared `aiosqlite` connection with WAL. Constants live in `server/constants.py` — don't
  hardcode 100/5/10/20 in more than one place.
```
