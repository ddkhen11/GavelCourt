# BUILD_PLAN — NBA Auction Draft

This is the **durable task tracker** and the source of truth for the implementation loop.
It survives context compaction and session restarts: any session (or `/loop`) reads this
file, does the first unchecked task, and checks it off.

## How to use it
- `[ ]` = not done · `[x]` = done & committed · `🚦` = **human gate** (the loop must stop here).
- Each task names its **gate** — the objective signal that it's done (a passing test or a
  manual check). A task isn't `[x]` until its gate is green **and** it's committed.
- Work top-to-bottom; respect dependencies. Build details live in [SPEC.md](SPEC.md).

## The loop prompt
```
/loop  Read docs/BUILD_PLAN.md + docs/SPEC.md. Take the first unchecked [ ] task,
implement it exactly per SPEC, then satisfy its gate (write/run the test, or do the
check). If green: mark it [x], commit with a descriptive message, continue to the next
task. If you hit a 🚦 gate, or a gate fails after 2 attempts, STOP and summarize for me.
```
Run it self-paced (no interval). Recommended model for the loop: **Sonnet**; switch to
**Opus** for Phase 4 (game loop) and all 🚦 reviews.

---

## Phase 0 — Foundation
- [x] Make initial commit of current docs (`CLAUDE.md`, `docs/`, `.gitignore`) — _gate: `git log` shows baseline commit_
- [x] `requirements.txt` per SPEC — _gate: `pip install -r requirements.txt` succeeds in a venv_
- [x] `server/constants.py` (full, from SPEC § Constants) — _gate: `python -c "import constants"` clean_
- [x] `scripts/gen_proto.sh` (from SPEC) + `chmod +x` — _gate: file exists, executable_

## Phase 1 — Proto + codegen
- [x] `proto/duel.proto` (full corrected schema from SPEC) — _gate: `protoc` parses it_
- [x] Run `scripts/gen_proto.sh`; verify `gen/duel_pb2.py`, `gen/duel_pb2_grpc.py`, and TS stubs exist — _gate: generated files present, importable_

## Phase 2 — Data layer
- [x] **Inspect `server/data/laker_stats.xlsx`**: print columns + sample rows, map to name/season/team/**position**/laker_score/rapm/rapm_offense/rapm_defense/war — _gate: column mapping written down in a comment_
- [x] `server/db.py`: 3 tables, WAL, single shared aiosqlite connection — _gate: tables created on a temp db_
- [x] xlsx loader: filter `>= 3.5`, assign tiers, deterministic `player_id`, upsert — _gate: row count > 0; spot-check 3 rows match the sheet_
- [x] `server/session.py`: `PlayerSeason`, `PlayerState` (incl. `max_bid`), `GameSession` dataclasses — _gate: import clean; unit test `max_bid` reserve formula_
- [x] `server/board.py`: `BoardBuilder.build()` returning `(board, pity_pool)` — _gate: **test** builds 20 boards, asserts both constraints hold + pity_pool excludes board cards_

## Phase 3 — Server skeleton
- [x] `server/matchmaking.py`: session registry, ranked single-waiter queue, `create_session_with_players` (builds board) — _gate: unit test pairs two players into one session_
- [x] `server/main.py`: grpc.aio bootstrap + reflection, loads data at startup — _gate: server boots, reflection lists `DuelService`_
- [x] Implement `RegisterPlayer`, `CreateMatch`, `JoinMatch`, `FindRankedMatch` — _gate: exercise each with `grpcurl`_

## Phase 4 — Game loop 🚦
- [x] `server/game_loop.py`: state machine — per-player queues, phase gate, reserve rule, draft cap, pity fix, disconnect/forfeit — _gate: unit-test `collect_bids`, `resolve_auction`, pity no-advance_
- [x] `server/servicer.py`: `StreamDuel` handler (auth, per-player queues, stored task refs) — _gate: import + handler wiring sanity test_
- [X] 🚦 **Two-client integration test**: two Python CLI clients connect, play a full match, both reach 5 — _gate: **human** runs it and confirms a clean end-to-end match_

## Phase 5 — Scoring + Elo + finalize
- [x] `server/scoring.py` — _gate: **test** known lineup → expected impact + each bonus path_
- [x] `server/elo.py` (win/loss + tie) — _gate: **test** symmetric deltas, tie path_
- [x] `finalize_game` + `db.record_match` (elo persist, win/loss counters, matches row) — _gate: full CLI match writes correct rows_

## Phase 6 — Web frontend 🚦
- [x] Vite + React scaffold, port 3000, deps installed — _gate: `npm run dev` serves :3000_
- [x] grpc-web codegen into `client/src/grpc` — _gate: stubs import in TS_
- [x] `useMatch` (Find Ranked Match + challenge code) — _gate: registers + matches against live server_
- [x] `useDuel` (bidi stream mgmt) — _gate: receives GameStarted/CardFlipped events_
- [x] `Lobby`, `Board`, `Lineup`, `Results` components — _gate: render with live events_
- [ ] 🚦 **Full visual playthrough** (server + grpcwebproxy + client, two browsers) — _gate: **human** plays a match start→finish in the browser_

## Phase 7 — Leaderboard + hardening
- [ ] Leaderboard query (players by elo) + simple view — _gate: returns ranked list_
- [ ] 🚦 `/code-review` high on the full diff — _gate: findings triaged_
- [ ] 🚦 `/security-review` (auth tokens, bid validation) — _gate: no open high-severity findings_
- [ ] `README.md`: setup + dev commands — _gate: a fresh clone can follow it to a running app_

---

_When every box is `[x]` and both 🚦 reviews are clean, the project is done._
