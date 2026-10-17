#!/usr/bin/env sh
# workspace-hub CLI 를 빌드해 Tauri externalBin 위치(src-tauri/binaries/)에 target triple 접미사로 복사한다.
# 사용: sh scripts/build-cli.sh [release]
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR="$SCRIPT_DIR/../.."
PROFILE=${1:-debug}
TRIPLE=$(rustc -vV | sed -n 's/^host: //p')

if [ "$PROFILE" = "release" ]; then
  cargo build --release -p workspace-hub-cli --manifest-path "$ROOT_DIR/Cargo.toml"
else
  cargo build -p workspace-hub-cli --manifest-path "$ROOT_DIR/Cargo.toml"
fi

mkdir -p "$SCRIPT_DIR/../src-tauri/binaries"
cp "$ROOT_DIR/target/$PROFILE/workspace-hub" "$SCRIPT_DIR/../src-tauri/binaries/workspace-hub-cli-$TRIPLE"
