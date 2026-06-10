---
description: Start the local dev stack (gRPC server, grpc-web proxy, Vite client) in the background
---

Start the three dev processes in the background (each with `run_in_background: true`) and report the status + ports of each:

1. `python server/main.py` — gRPC server on :50051
2. `grpcwebproxy --backend_addr=localhost:50051 --run_tls_server=false --allow_all_origins` — proxy on :8080
3. `cd client && npm run dev` — React on :3000

Before starting, check each is not already running. After starting, confirm :50051, :8080, and :3000 are listening. If a process isn't built yet (e.g. no `client/` or no `server/main.py`), skip it and say so — don't fail the whole command.
