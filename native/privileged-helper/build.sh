#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
OUT="../../apps/desktop/resources/helper"
mkdir -p "$OUT"
GOOS=darwin GOARCH=arm64 go build -o "$OUT/helper-darwin-arm64" .
GOOS=darwin GOARCH=amd64 go build -o "$OUT/helper-darwin-amd64" .
GOOS=windows GOARCH=amd64 go build -o "$OUT/helper-windows-amd64.exe" .
echo "built helpers in $OUT"
