#!/usr/bin/env bash
# workspace-hub installer for macOS
# Builds the Tauri app from source and installs it to /Applications.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$REPO_ROOT/app"
BUILT_APP="$REPO_ROOT/target/release/bundle/macos/workspace-hub.app"
INSTALL_DEST="/Applications/workspace-hub.app"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "이 스크립트는 macOS 전용입니다 (현재: $(uname))." >&2
  exit 1
fi

missing=()
command -v pnpm  >/dev/null || missing+=("pnpm  — https://pnpm.io")
command -v cargo >/dev/null || missing+=("cargo / rustup — https://rustup.rs")
xcode-select -p >/dev/null 2>&1 || missing+=("Xcode Command Line Tools — 'xcode-select --install'")

if (( ${#missing[@]} > 0 )); then
  echo "다음 사전조건이 필요합니다:" >&2
  for m in "${missing[@]}"; do echo "  - $m" >&2; done
  exit 1
fi

cd "$APP_DIR"

echo ">> pnpm install"
pnpm install

echo ">> pnpm tauri build (수 분 소요)"
pnpm tauri build

if [[ ! -d "$BUILT_APP" ]]; then
  echo "빌드 결과물을 찾을 수 없습니다: $BUILT_APP" >&2
  exit 1
fi

if [[ -d "$INSTALL_DEST" ]]; then
  echo ">> 기존 설치 제거: $INSTALL_DEST"
  rm -rf "$INSTALL_DEST"
fi

echo ">> /Applications 로 복사"
cp -R "$BUILT_APP" "$INSTALL_DEST"

cat <<EOF

설치 완료.

  - 실행: Launchpad 또는 Finder에서 'workspace-hub' 검색 후 더블클릭
  - 데이터 위치: ~/.workspace-hub/workspace-hub.sqlite
EOF
