#!/bin/bash
# Download FFmpeg binary for the current platform and place it in src-tauri/binaries/
# Run this before `tauri build` on macOS or Linux to bundle FFmpeg as a sidecar.
# On Windows, the binary is already committed as ffmpeg-x86_64-pc-windows-msvc.exe

set -e

BINARIES_DIR="$(cd "$(dirname "$0")/../src-tauri/binaries" && pwd)"
mkdir -p "$BINARIES_DIR"

# Detect platform and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "[download-ffmpeg] Platform: $OS $ARCH"

case "$OS" in
  Darwin)
    case "$ARCH" in
      x86_64)
        TARGET="x86_64-apple-darwin"
        FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/zip"
        ;;
      arm64)
        TARGET="aarch64-apple-darwin"
        FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/zip"
        ;;
      *)
        echo "[download-ffmpeg] Unsupported macOS architecture: $ARCH"
        exit 1
        ;;
    esac

    DEST="$BINARIES_DIR/ffmpeg-$TARGET"

    if [ -f "$DEST" ]; then
      echo "[download-ffmpeg] FFmpeg already exists at $DEST"
      exit 0
    fi

    echo "[download-ffmpeg] Downloading FFmpeg for macOS ($TARGET)..."
    TMPDIR=$(mktemp -d)
    curl -L "$FFMPEG_URL" -o "$TMPDIR/ffmpeg.zip"
    unzip -o "$TMPDIR/ffmpeg.zip" -d "$TMPDIR"
    mv "$TMPDIR/ffmpeg" "$DEST"
    chmod +x "$DEST"
    rm -rf "$TMPDIR"
    echo "[download-ffmpeg] Installed FFmpeg to $DEST"
    ;;

  Linux)
    case "$ARCH" in
      x86_64)
        TARGET="x86_64-unknown-linux-gnu"
        FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
        ;;
      aarch64)
        TARGET="aarch64-unknown-linux-gnu"
        FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
        ;;
      *)
        echo "[download-ffmpeg] Unsupported Linux architecture: $ARCH"
        exit 1
        ;;
    esac

    DEST="$BINARIES_DIR/ffmpeg-$TARGET"

    if [ -f "$DEST" ]; then
      echo "[download-ffmpeg] FFmpeg already exists at $DEST"
      exit 0
    fi

    echo "[download-ffmpeg] Downloading FFmpeg for Linux ($TARGET)..."
    TMPDIR=$(mktemp -d)
    curl -L "$FFMPEG_URL" -o "$TMPDIR/ffmpeg.tar.xz"
    tar -xf "$TMPDIR/ffmpeg.tar.xz" -C "$TMPDIR"
    # The archive extracts to a directory like ffmpeg-6.1-amd64-static/
    FFMPEG_BIN=$(find "$TMPDIR" -name "ffmpeg" -type f | head -1)
    if [ -z "$FFMPEG_BIN" ]; then
      echo "[download-ffmpeg] ERROR: ffmpeg binary not found in archive"
      rm -rf "$TMPDIR"
      exit 1
    fi
    mv "$FFMPEG_BIN" "$DEST"
    chmod +x "$DEST"
    rm -rf "$TMPDIR"
    echo "[download-ffmpeg] Installed FFmpeg to $DEST"
    ;;

  MINGW*|MSYS*|CYGWIN*)
    echo "[download-ffmpeg] Windows detected - FFmpeg should already be at:"
    echo "  $BINARIES_DIR/ffmpeg-x86_64-pc-windows-msvc.exe"
    if [ ! -f "$BINARIES_DIR/ffmpeg-x86_64-pc-windows-msvc.exe" ]; then
      echo "[download-ffmpeg] WARNING: FFmpeg not found! Download it manually."
      echo "  https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
      exit 1
    fi
    ;;

  *)
    echo "[download-ffmpeg] Unsupported platform: $OS"
    exit 1
    ;;
esac

echo "[download-ffmpeg] Done."
