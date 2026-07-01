#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${1:-.}"

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "Error: '$ROOT_DIR' is not a directory." >&2
  exit 1
fi

ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
WWWROOT_DIR="$ROOT_DIR/wwwroot"

echo "Applying permissions under: $ROOT_DIR"

# Outside wwwroot: files read-only for owner/group, directories traversable by everyone.
find "$ROOT_DIR" -path "$WWWROOT_DIR" -prune -o -type d -exec chmod 555 {} +
find "$ROOT_DIR" -path "$WWWROOT_DIR" -prune -o -type f -exec chmod 440 {} +

# Inside wwwroot: directories traversable by everyone, files read-only for everyone.
if [[ -d "$WWWROOT_DIR" ]]; then
  find "$WWWROOT_DIR" -type d -exec chmod 555 {} +
  find "$WWWROOT_DIR" -type f -exec chmod 444 {} +
fi

echo "Done."
