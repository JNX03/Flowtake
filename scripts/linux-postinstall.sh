#!/bin/bash
# Post-installation script for Flowtake on Linux
# This runs after the .deb or .rpm package is installed.
# Dependencies like ffmpeg, xdotool, wmctrl are handled by the package manager
# (declared in depends), but this script verifies and logs the status.

echo "[Flowtake] Post-install: verifying dependencies..."

MISSING=""

# Check FFmpeg
if ! command -v ffmpeg &>/dev/null; then
    MISSING="$MISSING ffmpeg"
fi

# Check xdotool (needed for mouse tracking and window enumeration)
if ! command -v xdotool &>/dev/null; then
    MISSING="$MISSING xdotool"
fi

# Check wmctrl (preferred for window enumeration)
if ! command -v wmctrl &>/dev/null; then
    MISSING="$MISSING wmctrl"
fi

if [ -n "$MISSING" ]; then
    echo "[Flowtake] WARNING: Missing optional dependencies:$MISSING"
    echo "[Flowtake] Install them with:"

    if command -v apt-get &>/dev/null; then
        echo "  sudo apt-get install$MISSING"
    elif command -v dnf &>/dev/null; then
        echo "  sudo dnf install$MISSING"
    elif command -v pacman &>/dev/null; then
        echo "  sudo pacman -S$MISSING"
    else
        echo "  Use your package manager to install:$MISSING"
    fi
else
    echo "[Flowtake] All dependencies found."
fi

echo "[Flowtake] Installation complete."
