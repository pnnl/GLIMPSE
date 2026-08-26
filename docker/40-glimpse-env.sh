#!/bin/sh
# Runs at nginx container start (nginx:alpine sources /docker-entrypoint.d/*.sh).
# Injects the backend URL into the static bundle so one image works anywhere.
set -eu

# Empty means same-origin: the browser talks to this nginx, which proxies /api
# to the backend. Use the "is it set at all" form so an intentional empty value
# survives (":-" would replace it with the default).
API_URL="${API_URL-http://127.0.0.1:5052}"
# Shared bearer token the browser must send. Must match the backend's
# GLIMPSE_API_TOKEN. Empty = auth disabled.
API_TOKEN="${API_TOKEN:-}"
# "hosted" hides the desktop-only UI (diagram tab, GridAPPS-D, simulation) whose
# endpoints the hosted backend doesn't register. Must match the backend's
# GLIMPSE_MODE.
MODE="${GLIMPSE_MODE:-desktop}"
HTML_DIR="/usr/share/nginx/html"

# 1) Expose runtime config to the app (read by src/config.js).
cat > "${HTML_DIR}/env.js" <<EOF
window.__GLIMPSE_ENV__ = { API_URL: "${API_URL}", API_TOKEN: "${API_TOKEN}", MODE: "${MODE}" };
EOF

# 2) Allow the browser to reach that backend by patching the CSP connect-src.
#    Derive the ws(s) origin from the http(s) one for SocketIO.
if [ -z "${API_URL}" ]; then
    # Same-origin: 'self' already covers it, and an empty token would make the
    # directive malformed.
    CONNECT="connect-src 'self';"
else
    WS_URL="$(printf '%s' "${API_URL}" | sed -e 's#^http#ws#')"
    CONNECT="connect-src 'self' ${API_URL} ${WS_URL};"
fi
sed -i "s#connect-src[^;]*;#${CONNECT}#" "${HTML_DIR}/index.html"

echo "[glimpse] API_URL set to ${API_URL} (mode: ${MODE})"
