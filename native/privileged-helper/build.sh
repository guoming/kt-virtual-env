#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
OUT="../../apps/desktop/resources/helper"
mkdir -p "$OUT"

build() {
  local goos=$1
  local goarch=$2
  local output=$3
  local ldflags=""
  if [[ "$goos" == "windows" ]]; then
    ldflags="-H windowsgui"
  fi
  GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 go build -ldflags="$ldflags" -o "$OUT/$output" .
  echo "✓ helper $output"
}

targets="${KTVE_HELPER_TARGETS:-all}"

case "$targets" in
  mac)
    build darwin arm64 helper-darwin-arm64
    build darwin amd64 helper-darwin-amd64
    ;;
  win)
    build windows amd64 helper-windows-amd64.exe
    ;;
  all)
    build darwin arm64 helper-darwin-arm64
    build darwin amd64 helper-darwin-amd64
    build windows amd64 helper-windows-amd64.exe
    ;;
  *)
    echo "unknown KTVE_HELPER_TARGETS: $targets (use mac|win|all)" >&2
    exit 1
    ;;
esac

echo "built helpers in $OUT ($targets)"
