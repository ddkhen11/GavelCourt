# NBA Auction Draft

Real-time 1v1 NBA auction draft. Both players bid credits on a shared blind board of
historical NBA player-seasons (1977–2026, real LAKER/RAPM data); the higher bid wins the
card. Each player drafts exactly 5; the best LAKER-score lineup wins; Elo ranking with a
leaderboard. Python gRPC server, React web client over grpc-web.

Design docs: [docs/SPEC.md](docs/SPEC.md) (source of truth) ·
[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) (task tracker).

## Prerequisites

- Python 3.11+
- Node 18+
- Go (only to install the grpc-web proxy):
  ```
  go install github.com/improbable-eng/grpc-web/go/grpcwebproxy@latest
  ```
  (any grpcwebproxy binary on your PATH works; Envoy with the `grpc_web` filter is an
  alternative)

## Setup

```bash
# Server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Client (also links the local duel-protos stub package)
cd client && npm install && cd ..
```

The player data ships in the repo (`server/data/nba_stats.db`); the game database
(`server/data/game.db`) is created and loaded automatically at server startup.

## Run (three terminals, from the repo root)

```bash
# 1. gRPC server on :50051
.venv/bin/python server/main.py

# 2. grpc-web proxy on :8080 (websockets required for the bidi duel stream)
grpcwebproxy --backend_addr=localhost:50051 --run_tls_server=false \
             --allow_all_origins --use_websockets

# 3. React dev server on :3000
cd client && npm run dev
```

Open http://localhost:3000 in **two** browser windows (use a private window for the
second player — identity is stored in localStorage). Register a name in each, click
**Find Ranked Match** in both (or create/join a challenge with the shared code), ready
up, and bid. The browser talks only to :8080, never to :50051.

There is also a terminal auto-play client, useful for smoke tests:

```bash
.venv/bin/python scripts/test_client.py alice   # terminal A
.venv/bin/python scripts/test_client.py bob     # terminal B
```

## Tests

```bash
.venv/bin/python -m unittest discover -s tests          # server unit tests
node client/e2e/gate_usematch.mjs                        # browser e2e (needs the full
node client/e2e/gate_components.mjs                      # stack above running, run from client/)
```

## Regenerating the gRPC stubs

Only needed after editing `proto/duel.proto`. Requires `protoc` (e.g.
`brew install protobuf`) plus `pip install mypy-protobuf` in the venv; the
`protoc-gen-grpc-web` plugin is bundled in `scripts/`.

```bash
PATH="$PWD/.venv/bin:$PATH" bash scripts/gen_proto.sh
rm -rf client/node_modules/.vite   # drop Vite's prebundle of the old stubs
```

Never edit `gen/` or `client/protos/*_pb.*` by hand.
