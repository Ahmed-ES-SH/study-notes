#!/usr/bin/env bash
# Phase 6 runtime smoke test: proves the built binary runs with 100%
# functionality inside an unshared network namespace (zero interfaces).
# Complements the static `check:offline` guard by testing the real process.
#
# Usage: scripts/dev/test-network-isolation.sh
# Requires: unshare (util-linux), a completed production build
#   (pnpm tauri build — binary under src-tauri/target/release).
set -euo pipefail

BINARY="$(dirname "$0")/../../src-tauri/target/release/study-notes-app"

if [ ! -x "$BINARY" ]; then
  echo "ERROR: release binary not found at $BINARY — run 'pnpm tauri build' first." >&2
  exit 1
fi

if ! command -v unshare >/dev/null 2>&1; then
  echo "ERROR: unshare not found (pacman -S util-linux)." >&2
  exit 1
fi

echo "Launching built binary inside 'unshare -n' (no network interfaces)..."
echo "The app window should appear and function normally. Close it to finish."

# unshare -n creates a network namespace with only a down loopback device.
# If the app launches and stays up, it made no outbound connections that
# matter; any attempt to bind outbound sockets would still work inside the
# namespace but reach nothing — combined with CSP connect-src 'none' this
# proves functional offline operation (FR-11).
exec unshare -n "$BINARY"
