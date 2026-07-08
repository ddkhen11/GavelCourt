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

# Frontend (protoc-gen-grpc-web). commonjs+dts (not import_style=typescript):
# Vite cannot serve source-tree CommonJS, so the generated files live in the
# local package client/protos ("duel-protos") and are prebundled as a dep
# (vite.config optimizeDeps.include handles the CJS -> ESM interop).
protoc \
  --plugin=protoc-gen-grpc-web="${SCRIPT_DIR}/protoc-gen-grpc-web" \
  --js_out=import_style=commonjs:client/protos \
  --grpc-web_out=import_style=commonjs+dts,mode=grpcwebtext:client/protos \
  --proto_path=proto/ \
  proto/duel.proto
