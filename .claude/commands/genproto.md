---
description: Regenerate gRPC stubs (Python + TS) from proto/duel.proto
---

Run `bash scripts/gen_proto.sh`, then verify the generated artifacts exist and report them:
- `gen/duel_pb2.py`, `gen/duel_pb2_grpc.py`
- `client/src/grpc/DuelServiceClientPb.ts`, `client/src/grpc/duel_pb.js`, `client/src/grpc/duel_pb.d.ts`

If the script fails, show the protoc error verbatim and stop. Never hand-edit generated files — fix `proto/duel.proto` and regenerate.
