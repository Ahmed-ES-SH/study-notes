#!/usr/bin/env bash
# Phase 0 architecture guard (Main-plan.md), hardened in Phase 6:
# Fails if any outbound-network usage is found in the frontend, Rust source,
# or app configuration. Enforces FR-11 — the app must work 100% offline.
#
# Layers:
#   1. Static source scan (JS/TS, Rust, HTML/CSS patterns)
#   2. Remote-URL scan of app config (localhost dev URLs exempt)
#   3. CSP enforcement: `connect-src 'none'` must be set in tauri.conf.json
set -euo pipefail

cd "$(dirname "$0")/.."

JS_PATTERNS=(
  'fetch\('
  'XMLHttpRequest'
  'WebSocket\('
  'EventSource\('
  'axios'
  '@tauri-apps/plugin-http'
  'tauri_plugin_http'
  'navigator\.sendBeacon'
  "import_scripts\("
)

RUST_PATTERNS=(
  'reqwest'
  'ureq'
  'hyper'
  'tauri_plugin_http'
  'tokio::net'
  'TcpStream'
  'UdpSocket'
)

HTML_CSS_PATTERNS=(
  '@import url\(http'
  'fonts\.googleapis\.com'
  'src="http'
  'url\(http'
)

# Remote URLs in JS/TS/HTML source — localhost is the only exemption
# (dev server URL). Matches http:// or https:// followed by a host.
REMOTE_URL='https?://'

violations=0

scan() {
  local label="$1" pat="$2" include_args="${3:-}"
  local hits=""
  if [ -n "$include_args" ]; then
    hits=$(grep -rn -E "$pat" $include_args 2>/dev/null || true)
  else
    hits=$(grep -rn -E "$pat" app/ components/ lib/ \
        --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
        --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=out 2>/dev/null || true)
  fi
  if [ -n "$hits" ]; then
    echo "$hits"
    echo "FOUND: outbound network pattern '$pat' in $label" >&2
    violations=$((violations + 1))
  fi
}

# ── 1. Static source scans ──────────────────────────────────────────
for pat in "${JS_PATTERNS[@]}"; do
  scan "frontend code" "$pat"
done

for pat in "${RUST_PATTERNS[@]}"; do
  scan "Rust code" "$pat" "src-tauri/src/ --include='*.rs'"
done

for pat in "${HTML_CSS_PATTERNS[@]}"; do
  scan "styles/markup" "$pat"
done

# Remote URLs in frontend source (localhost exempt).
hits=$(grep -rn -E "$REMOTE_URL" app/ components/ lib/ \
    --include='*.ts' --include='*.tsx' --include='*.js' \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=out 2>/dev/null \
    | grep -v -E 'https?://(localhost|127\.0\.0\.1)' || true)
if [ -n "$hits" ]; then
  echo "$hits"
  echo "FOUND: remote URL reference in frontend code" >&2
  violations=$((violations + 1))
fi

# ── 2. Config scan: no remote hosts in tauri.conf.json ─────────────
hits=$(grep -E "$REMOTE_URL" src-tauri/tauri.conf.json 2>/dev/null \
    | grep -v -E 'https?://(localhost|127\.0\.0\.1)' || true)
if [ -n "$hits" ]; then
  echo "$hits"
  echo "FOUND: remote URL in tauri.conf.json" >&2
  violations=$((violations + 1))
fi

# ── 3. CSP enforcement: webview must forbid all socket connections ──
CSP=$(python3 -c "
import json
with open('src-tauri/tauri.conf.json') as f:
    print(json.load(f).get('app', {}).get('security', {}).get('csp') or '')
")
if [ -z "$CSP" ]; then
  echo "FOUND: tauri.conf.json has no CSP — connect-src 'none' is required (FR-11)." >&2
  violations=$((violations + 1))
elif ! echo "$CSP" | grep -q "connect-src 'none'"; then
  echo "FOUND: CSP is missing \"connect-src 'none'\" — outbound webview requests are not blocked." >&2
  violations=$((violations + 1))
fi

if [ "$violations" -gt 0 ]; then
  echo "ERROR: $violations network usage violation(s) — the app must make zero outbound calls (FR-11)." >&2
  exit 1
fi

echo "OK: no outbound network usage found; CSP blocks webview sockets (FR-11 satisfied)."
