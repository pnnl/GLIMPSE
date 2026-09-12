#!/usr/bin/env bash
# Point the built bundle at its own origin, so `vite preview` can serve dist/
# and proxy /api + /socket.io from a single forwarded port.
#
# Without this, dist/env.js is the copy of public/env.js — `{}` — and
# src/config.js falls through to http://127.0.0.1:5052, which in a Codespace is
# the *user's own laptop*. An empty-string API_URL is what makes every request
# relative.
#
# Runs after every build, not just on container create. See scripts in
# package.json (codespace:build).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO_ROOT/dist"

[ -f "$DIST/index.html" ] || {
    echo "error: $DIST/index.html missing — run 'npm run build' first" >&2
    exit 1
}

# Set inside a Codespace; absent in a local Dev Container or a plain checkout,
# where 'self' alone is correct.
EXTRA=""
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
    HOST="${CODESPACE_NAME}-4173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    # CSP3 says 'self' matches same-origin wss:, but engines have disagreed
    # historically and the socket layer is core here — name it explicitly.
    EXTRA="wss://${HOST} https://${HOST}"
fi

API_URL="" \
API_TOKEN="${GLIMPSE_API_TOKEN:-}" \
HTML_DIR="$DIST" \
EXTRA_CONNECT_SRC="$EXTRA" \
    sh "$REPO_ROOT/docker/40-glimpse-env.sh"
