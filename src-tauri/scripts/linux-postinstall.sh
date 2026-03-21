#!/bin/bash
# Flowtake Linux post-install script
# Ensures required dependencies are available after package installation.

set -e

# Update desktop database so Flowtake appears in app launchers
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi

# Update icon cache
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -q /usr/share/icons/hicolor 2>/dev/null || true
fi

echo "Flowtake installed successfully."
