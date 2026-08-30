#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$REPO_ROOT/native/macos-capture"
OUTPUT_DIR="$REPO_ROOT/src-tauri/binaries"
PRODUCT_NAME="flowtake-macos-capture"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The native ScreenCaptureKit helper can only be built on macOS." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

build_arch() {
  local target_triple="$1"
  local scratch_dir="$2"

  swift build \
    --package-path "$PACKAGE_DIR" \
    --configuration release \
    --triple "$target_triple" \
    --scratch-path "$scratch_dir" >&2

  swift build \
    --package-path "$PACKAGE_DIR" \
    --configuration release \
    --triple "$target_triple" \
    --scratch-path "$scratch_dir" \
    --show-bin-path
}

ARM64_BIN_DIR="$(build_arch arm64-apple-macosx13.0 "$PACKAGE_DIR/.build-arm64")"
X86_64_BIN_DIR="$(build_arch x86_64-apple-macosx13.0 "$PACKAGE_DIR/.build-x86_64")"
ARM64_BIN="$ARM64_BIN_DIR/$PRODUCT_NAME"
X86_64_BIN="$X86_64_BIN_DIR/$PRODUCT_NAME"

test -x "$ARM64_BIN"
test -x "$X86_64_BIN"

cp "$ARM64_BIN" "$OUTPUT_DIR/${PRODUCT_NAME}-aarch64-apple-darwin"
cp "$X86_64_BIN" "$OUTPUT_DIR/${PRODUCT_NAME}-x86_64-apple-darwin"
lipo -create \
  "$ARM64_BIN" \
  "$X86_64_BIN" \
  -output "$OUTPUT_DIR/${PRODUCT_NAME}-universal-apple-darwin"

chmod +x \
  "$OUTPUT_DIR/${PRODUCT_NAME}-aarch64-apple-darwin" \
  "$OUTPUT_DIR/${PRODUCT_NAME}-x86_64-apple-darwin" \
  "$OUTPUT_DIR/${PRODUCT_NAME}-universal-apple-darwin"

lipo -verify_arch arm64 x86_64 "$OUTPUT_DIR/${PRODUCT_NAME}-universal-apple-darwin"
"$OUTPUT_DIR/${PRODUCT_NAME}-$(uname -m | sed 's/arm64/aarch64/')-apple-darwin" probe
