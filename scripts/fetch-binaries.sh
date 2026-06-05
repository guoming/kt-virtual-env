#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/resources/bin"
KTCTL_VERSION="0.3.7"
KUBECTL_VERSION="1.28.15"

download_ktctl() {
  local platform_key="$1"
  local url
  local dest="$BIN_DIR/$platform_key"
  mkdir -p "$dest"

  case "$platform_key" in
    darwin-arm64)
      url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_Darwin_arm64.tar.gz"
      ;;
    darwin-amd64)
      url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_Darwin_x86_64.tar.gz"
      ;;
    windows-amd64)
      url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_Windows_x86_64.zip"
      ;;
    *)
      echo "unsupported ktctl platform: $platform_key" >&2
      return 1
      ;;
  esac

  local tmp
  tmp="$(mktemp -d)"
  if [[ "$platform_key" == windows-amd64 ]]; then
    curl -fsSL "$url" -o "$tmp/ktctl.zip"
    unzip -q "$tmp/ktctl.zip" -d "$tmp"
    install -m 755 "$tmp/ktctl.exe" "$dest/ktctl.exe"
  else
    curl -fsSL "$url" | tar xz -C "$tmp"
    install -m 755 "$tmp/ktctl" "$dest/ktctl"
  fi
  rm -rf "$tmp"
  echo "✓ ktctl $platform_key"
}

download_kubectl() {
  local platform_key="$1"
  local os
  local arch
  local bin_name="kubectl"
  local dest="$BIN_DIR/$platform_key"
  mkdir -p "$dest"

  case "$platform_key" in
    darwin-arm64) os="darwin"; arch="arm64" ;;
    darwin-amd64) os="darwin"; arch="amd64" ;;
    windows-amd64) os="windows"; arch="amd64"; bin_name="kubectl.exe" ;;
    *)
      echo "unsupported kubectl platform: $platform_key" >&2
      return 1
      ;;
  esac

  local url="https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${os}/${arch}/kubectl"
  if [[ "$platform_key" == windows-amd64 ]]; then
    curl -fsSL "$url" -o "$dest/kubectl.exe"
  else
    curl -fsSL "$url" -o "$dest/kubectl"
    chmod +x "$dest/kubectl"
  fi
  echo "✓ kubectl $platform_key"
}

main() {
  local targets=("$@")
  if [[ ${#targets[@]} -eq 0 ]]; then
    local host_os host_arch
    host_os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    host_arch="$(uname -m)"
    case "$host_os" in
      darwin)
        if [[ "$host_arch" == arm64 ]]; then
          targets=(darwin-arm64)
        else
          targets=(darwin-amd64)
        fi
        ;;
      linux)
        if [[ "$host_arch" == aarch64 || "$host_arch" == arm64 ]]; then
          targets=(darwin-arm64)
        else
          targets=(darwin-amd64)
        fi
        echo "note: linux dev host; downloading darwin binaries for packaging" >&2
        ;;
      *)
        echo "unsupported host OS: $host_os" >&2
        exit 1
        ;;
    esac
  fi

  for key in "${targets[@]}"; do
    download_ktctl "$key"
    download_kubectl "$key"
  done

  echo "done: ${targets[*]}"
}

main "$@"
