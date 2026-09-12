#!/usr/bin/env bash
# Check the separately installed FFmpeg used for local Flowtake development.
# Flowtake release packages do not include FFmpeg executables or libraries.

set -euo pipefail

ffmpeg_path="$(command -v ffmpeg 2>/dev/null || true)"
if [[ -n "$ffmpeg_path" ]] && "$ffmpeg_path" -hide_banner -version >/dev/null 2>&1; then
  echo "[flowtake-ffmpeg] Ready: $ffmpeg_path"
  exit 0
fi

echo "[flowtake-ffmpeg] FFmpeg was not found or did not launch."
case "$(uname -s)" in
  Darwin)
    echo "Install it with Homebrew: brew install ffmpeg"
    ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      echo "Install it with: sudo apt-get install ffmpeg"
    elif command -v dnf >/dev/null 2>&1; then
      echo "Install it with: sudo dnf install ffmpeg"
    elif command -v pacman >/dev/null 2>&1; then
      echo "Install it with: sudo pacman -S ffmpeg"
    else
      echo "Install FFmpeg with your distribution package manager."
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "Install it with: winget install --id Gyan.FFmpeg --exact --source winget"
    ;;
  *)
    echo "See https://ffmpeg.org/download.html"
    ;;
esac

exit 1
