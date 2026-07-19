#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/src-tauri/native/macos-capture"
BINARIES_DIR="$ROOT_DIR/src-tauri/binaries"
PRODUCT_NAME="flowtake-macos-capture"
MODE="${1:---native}"

mkdir -p "$BINARIES_DIR"

build_architecture() {
  local architecture="$1"
  local scratch_path="$PACKAGE_DIR/.build/$architecture"

  swift build \
    --package-path "$PACKAGE_DIR" \
    --configuration release \
    --arch "$architecture" \
    --scratch-path "$scratch_path"

  swift build \
    --package-path "$PACKAGE_DIR" \
    --configuration release \
    --arch "$architecture" \
    --scratch-path "$scratch_path" \
    --show-bin-path
}

case "$MODE" in
  --native)
    machine_arch="$(uname -m)"
    case "$machine_arch" in
      arm64) target_arch="aarch64" ;;
      x86_64) target_arch="x86_64" ;;
      *)
        echo "Unsupported macOS architecture: $machine_arch" >&2
        exit 1
        ;;
    esac

    bin_path="$(build_architecture "$machine_arch" | tail -1)"
    install -m 755 \
      "$bin_path/$PRODUCT_NAME" \
      "$BINARIES_DIR/$PRODUCT_NAME-$target_arch-apple-darwin"
    ;;

  --universal)
    arm64_bin_path="$(build_architecture arm64 | tail -1)"
    x86_64_bin_path="$(build_architecture x86_64 | tail -1)"
    output="$BINARIES_DIR/$PRODUCT_NAME-universal-apple-darwin"

    lipo -create \
      "$arm64_bin_path/$PRODUCT_NAME" \
      "$x86_64_bin_path/$PRODUCT_NAME" \
      -output "$output"
    chmod 755 "$output"

    file "$output" | grep -q "arm64"
    file "$output" | grep -q "x86_64"
    ;;

  *)
    echo "Usage: $0 [--native|--universal]" >&2
    exit 1
    ;;
esac
