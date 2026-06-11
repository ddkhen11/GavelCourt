#!/bin/bash
set -euo pipefail

# Backend (Python)
python -m grpc_tools.protoc \
  --python_out=gen/ \
  --grpc_python_out=gen/ \
  --proto_path=proto/ \
  proto/duel.proto

# Frontend (TypeScript via protoc-gen-grpc-web)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
protoc \
  --plugin=protoc-gen-grpc-web="${SCRIPT_DIR}/protoc-gen-grpc-web" \
  --js_out=import_style=commonjs:client/src/grpc \
  --grpc-web_out=import_style=typescript,mode=grpcwebtext:client/src/grpc \
  --proto_path=proto/ \
  proto/duel.proto
