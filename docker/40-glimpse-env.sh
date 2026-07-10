#!/bin/sh
# Runs at nginx container start (nginx:alpine sources /docker-entrypoint.d/*.sh).
# Injects the backend URL into the static bundle so one image works anywhere.
set -eu

API_URL="${API_URL:-http://127.0.0.1:5052}"
# Shared bearer token the browser must send. Must match the backend's
# GLIMPSE_API_TOKEN. Empty = auth disabled.
API_TOKEN="${API_TOKEN:-}"
HTML_DIR="/usr/share/nginx/html"

# 1) Expose runtime config to the app (read by src/config.js).
cat > "${HTML_DIR}/env.js" <<EOF
window.__GLIMPSE_ENV__ = { API_URL: "${API_URL}", API_TOKEN: "${API_TOKEN}" };
EOF

# 2) Allow the browser to reach that backend by patching the CSP connect-src.
#    Derive the ws(s) origin from the http(s) one for SocketIO.
WS_URL="$(printf '%s' "${API_URL}" | sed -e 's#^http#ws#')"
CONNECT="connect-src 'self' ${API_URL} ${WS_URL};"
sed -i "s#connect-src[^;]*;#${CONNECT}#" "${HTML_DIR}/index.html"

echo "[glimpse] API_URL set to ${API_URL}"
