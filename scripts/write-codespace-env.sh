#!/usr/bin/env bash
# Point the built bundle at its own origin (empty-string API_URL, so requests are relative) so `vite preview` can serve dist/ and proxy /api + /socket.io from one port.
# Without it src/config.js falls through to 127.0.0.1:5052, the user's laptop in a Codespace; runs after every build (codespace:build).
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
