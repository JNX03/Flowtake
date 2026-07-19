#!/usr/bin/env bash

set -euo pipefail

APPDIR_LINT_COMMIT="5da36fb54d5847ed76d2b9959d96722cbc857923"
APPDIR_LINT_SHA256="408c60f34269b74ace4a87f074e9f215e9009772af57af4afc6be95de6790091"
EXCLUDELIST_SHA256="8893d840861b37c23992310ddd50f30d2ad9401e0d50b7b56593bec9e1c2b93d"

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <path-to-AppImage>" >&2
    exit 64
fi

appimage="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if [[ ! -s "$appimage" ]]; then
    echo "AppImage is missing or empty: $appimage" >&2
    exit 1
fi

work_dir="$(mktemp -d)"
cleanup() {
    rm -rf "$work_dir"
}
trap cleanup EXIT

tool_dir="$work_dir/appdir-lint"
extract_dir="$work_dir/extract"
mkdir -p "$tool_dir" "$extract_dir"

curl --fail --location --show-error --silent \
    "https://raw.githubusercontent.com/AppImageCommunity/pkg2appimage/${APPDIR_LINT_COMMIT}/appdir-lint.sh" \
    --output "$tool_dir/appdir-lint.sh"
curl --fail --location --show-error --silent \
    "https://raw.githubusercontent.com/AppImageCommunity/pkg2appimage/${APPDIR_LINT_COMMIT}/excludelist" \
    --output "$tool_dir/excludelist"

printf '%s  %s\n' "$APPDIR_LINT_SHA256" "$tool_dir/appdir-lint.sh" \
    | sha256sum --check --strict -
printf '%s  %s\n' "$EXCLUDELIST_SHA256" "$tool_dir/excludelist" \
    | sha256sum --check --strict -

(
    cd "$extract_dir"
    chmod +x "$appimage"
    "$appimage" --appimage-extract >/dev/null
)

app_dir="$extract_dir/squashfs-root"
bash "$tool_dir/appdir-lint.sh" "$app_dir"

validate_relocatable_path() {
    local path="$1"
    local label="$2"

    if [[ ! -e "$path" ]]; then
        echo "$label is missing or resolves outside the AppDir: $path" >&2
        exit 1
    fi

    if [[ -L "$path" ]]; then
        local target
        target="$(readlink "$path")"
        if [[ "$target" = /* ]]; then
            echo "$label must use a relative symlink target, found: $target" >&2
            exit 1
        fi
    fi
}

validate_relocatable_path "$app_dir/.DirIcon" ".DirIcon"

mapfile -t desktop_entries < <(
    find "$app_dir" -maxdepth 1 \( -type l -o -type f \) -name '*.desktop'
)
if [[ ${#desktop_entries[@]} -ne 1 ]]; then
    echo "Expected exactly one root desktop entry, found ${#desktop_entries[@]}" >&2
    exit 1
fi
validate_relocatable_path "${desktop_entries[0]}" "Root desktop entry"

echo "AppImage metadata is lint-clean and relocatable."
