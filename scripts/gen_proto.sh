#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_BIN="$REPO_ROOT/.venv/bin"

# Backend (Python + mypy stubs)
python -m grpc_tools.protoc \
  --plugin=protoc-gen-mypy="$VENV_BIN/protoc-gen-mypy" \
  --plugin=protoc-gen-mypy_grpc="$VENV_BIN/protoc-gen-mypy_grpc" \
  --python_out=gen/ \
  --grpc_python_out=gen/ \
  --mypy_out=gen/ \
  --mypy_grpc_out=gen/ \
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
