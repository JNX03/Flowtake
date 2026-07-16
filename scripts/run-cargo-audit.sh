#!/usr/bin/env bash

set -euo pipefail

readonly CARGO_AUDIT_VERSION="0.22.2"
readonly CARGO_AUDIT_TARGET="x86_64-unknown-linux-gnu"
readonly CARGO_AUDIT_ARCHIVE="cargo-audit-${CARGO_AUDIT_TARGET}-v${CARGO_AUDIT_VERSION}.tgz"
readonly CARGO_AUDIT_ARCHIVE_ROOT="${CARGO_AUDIT_ARCHIVE%.tgz}"
readonly CARGO_AUDIT_URL="https://github.com/rustsec/rustsec/releases/download/cargo-audit/v${CARGO_AUDIT_VERSION}/${CARGO_AUDIT_ARCHIVE}"
readonly CARGO_AUDIT_SHA256="ab28a1bdb54db4d5d8ad5981cf1f959410370b3d28250dbd35f6a44248620e39"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "ERROR: the pinned cargo-audit binary requires x86_64 Linux" >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "${script_dir}/.." && pwd -P)"
lockfile="${repo_root}/src-tauri/Cargo.lock"

if [[ ! -f "${lockfile}" ]]; then
  echo "ERROR: Cargo lockfile not found at ${lockfile}" >&2
  exit 2
fi

temp_dir="$(mktemp -d)"
cleanup() {
  rm -rf -- "${temp_dir}"
}
trap cleanup EXIT

archive_path="${temp_dir}/${CARGO_AUDIT_ARCHIVE}"
extract_dir="${temp_dir}/extracted"
cargo_home="${temp_dir}/cargo-home"
audit_workdir="${temp_dir}/audit-workdir"

curl \
  --fail \
  --location \
  --retry 3 \
  --retry-all-errors \
  --connect-timeout 15 \
  --max-time 180 \
  --show-error \
  --silent \
  --proto '=https' \
  --tlsv1.2 \
  --output "${archive_path}" \
  "${CARGO_AUDIT_URL}"

(
  cd -- "${temp_dir}"
  printf '%s  %s\n' "${CARGO_AUDIT_SHA256}" "${CARGO_AUDIT_ARCHIVE}" \
    | sha256sum --check --strict -
)

mkdir -p -- "${extract_dir}" "${cargo_home}" "${audit_workdir}"
tar \
  --extract \
  --gzip \
  --file "${archive_path}" \
  --directory "${extract_dir}" \
  --no-same-owner \
  "${CARGO_AUDIT_ARCHIVE_ROOT}/cargo-audit"

cargo_audit_bin="${extract_dir}/${CARGO_AUDIT_ARCHIVE_ROOT}/cargo-audit"
if [[ ! -x "${cargo_audit_bin}" ]]; then
  echo "ERROR: expected cargo-audit binary was not extracted at ${cargo_audit_bin}" >&2
  exit 2
fi

# Run outside the repository with an empty CARGO_HOME. cargo-audit therefore
# cannot inherit a project or runner audit.toml containing advisory ignores.
(
  cd -- "${audit_workdir}"
  CARGO_HOME="${cargo_home}" "${cargo_audit_bin}" audit --file "${lockfile}"
)
