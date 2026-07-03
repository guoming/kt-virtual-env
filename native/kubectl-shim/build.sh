#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
OUT="../../resources/bin/windows-amd64"
REAL_KUBECTL="$OUT/kubectl.real.exe"
SHIM="$OUT/kubectl.exe"

if [[ ! -f "$REAL_KUBECTL" ]]; then
  echo "skip kubectl shim: $REAL_KUBECTL not found (run fetch-binaries first)" >&2
  exit 0
fi

GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-H windowsgui" -o "$SHIM" .
echo "✓ kubectl shim $SHIM"
