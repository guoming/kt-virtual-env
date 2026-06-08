#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/resources/bin"
KTCTL_VERSION="0.3.7"
KUBECTL_VERSION="1.28.15"
CURL_OPTS=(
  --connect-timeout 15
  --max-time 300
  --retry 6
  --retry-delay 5
  --retry-max-time 900
  --retry-all-errors
)

curl_download() {
  local url="$1"
  local dest="$2"
  curl -fsSL "${CURL_OPTS[@]}" "$url" -o "$dest"
}

should_verify_binary() {
  local platform_key="$1"
  local host_os host_arch
  host_os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  host_arch="$(uname -m)"
  case "$platform_key" in
    darwin-arm64)
      [[ "$host_os" == darwin* && "$host_arch" == arm64 ]]
      ;;
    darwin-amd64)
      [[ "$host_os" == darwin* && "$host_arch" != arm64 ]]
      ;;
    windows-amd64)
      [[ "$host_os" == msys* || "$host_os" == mingw* || "$host_os" == cygwin* ]]
      ;;
    *)
      return 1
      ;;
  esac
}

copy_from_path() {
  local name="$1"
  local dest="$2"
  local found
  found="$(command -v "$name" 2>/dev/null || true)"
  if [[ -n "$found" && -x "$found" ]]; then
    install -m 755 "$found" "$dest"
    echo "⚠ ${name} 下载失败，已从本机复制: $found" >&2
    return 0
  fi
  return 1
}

download_ktctl() {
  local platform_key="$1"
  local url
  local dest="$BIN_DIR/$platform_key"
  mkdir -p "$dest"

  case "$platform_key" in
    darwin-arm64)
      # 官方 release 资产名为 MacOS_arm_64，非 Darwin_arm64
      url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_MacOS_arm_64.tar.gz"
      ;;
    darwin-amd64)
      url="https://github.com/alibaba/kt-connect/releases/download/v${KTCTL_VERSION}/ktctl_${KTCTL_VERSION}_MacOS_x86_64.tar.gz"
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
  local ok=0
  if [[ "$platform_key" == windows-amd64 ]]; then
    if curl_download "$url" "$tmp/ktctl.zip"; then
      unzip -q "$tmp/ktctl.zip" -d "$tmp"
      install -m 755 "$tmp/ktctl.exe" "$dest/ktctl.exe"
      ok=1
    elif copy_from_path ktctl.exe "$dest/ktctl.exe"; then
      ok=1
    fi
  else
    if curl_download "$url" "$tmp/ktctl.tar.gz"; then
      tar xzf "$tmp/ktctl.tar.gz" -C "$tmp"
      install -m 755 "$tmp/ktctl" "$dest/ktctl"
      ok=1
    elif copy_from_path ktctl "$dest/ktctl"; then
      ok=1
    fi
  fi
  rm -rf "$tmp"
  if [[ "$ok" -eq 0 ]]; then
    echo "failed to download ktctl: $url (且无本机 ktctl 可回退)" >&2
    return 1
  fi
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

  # Windows 发行包须带 .exe 后缀，否则 dl.k8s.io 返回 404
  local artifact="kubectl"
  if [[ "$platform_key" == windows-amd64 ]]; then
    artifact="kubectl.exe"
  fi
  local url="https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${os}/${arch}/${artifact}"
  local ok=0
  if [[ "$platform_key" == windows-amd64 ]]; then
    if curl_download "$url" "$dest/kubectl.exe"; then
      ok=1
    elif copy_from_path kubectl.exe "$dest/kubectl.exe"; then
      ok=1
    fi
  else
    if curl_download "$url" "$dest/kubectl"; then
      chmod +x "$dest/kubectl"
      ok=1
    elif copy_from_path kubectl "$dest/kubectl"; then
      ok=1
    fi
  fi
  if [[ "$ok" -eq 0 ]]; then
    echo "failed to download kubectl: $url (且无本机 kubectl 可回退)" >&2
    return 1
  fi
  local installed="$dest/$artifact"
  if should_verify_binary "$platform_key"; then
    if ! "$installed" version --client >/dev/null 2>&1; then
      echo "kubectl 下载后无法执行: $installed" >&2
      return 1
    fi
  elif [[ ! -s "$installed" ]]; then
    echo "kubectl 下载结果为空: $installed" >&2
    return 1
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
      msys*|mingw*|cygwin*)
        targets=(windows-amd64)
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
