#!/usr/bin/env bash
# Phase 0 architecture guard (Main-plan.md):
# Fails if any outbound-network usage is found in the frontend or Rust source.
# Enforces FR-11 / NFR "No Network Calls" — the app must work 100% offline.
set -euo pipefail

cd "$(dirname "$0")/.."

# Patterns that indicate outbound network access. Extend as the codebase grows.
# - JS/TS: browser or Tauri HTTP APIs
# - Rust: HTTP client crates or Tauri HTTP plugin
JS_PATTERNS=(
  'fetch\('
  'XMLHttpRequest'
  'WebSocket\('
  'EventSource\('
  'axios'
  '@tauri-apps/plugin-http'
  'tauri_plugin_http'
)
RUST_PATTERNS=(
  'reqwest'
  'ureq'
  'hyper'
  'tauri_plugin_http'
)

violations=0

for pat in "${JS_PATTERNS[@]}"; do
  if grep -rn -E "$pat" app/ src-tauri/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null; then
    echo "FOUND: outbound network pattern '$pat' in frontend code" >&2
    violations=$((violations + 1))
  fi
done

for pat in "${RUST_PATTERNS[@]}"; do
  if grep -rn -E "$pat" src-tauri/src/ --include='*.rs' 2>/dev/null; then
    echo "FOUND: outbound network pattern '$pat' in Rust code" >&2
    violations=$((violations + 1))
  fi
done

if [ "$violations" -gt 0 ]; then
  echo "ERROR: $violations network usage violation(s) — the app must make zero outbound calls (FR-11)." >&2
  exit 1
fi

echo "OK: no outbound network usage found (FR-11 satisfied)."