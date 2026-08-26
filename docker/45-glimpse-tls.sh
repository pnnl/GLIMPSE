#!/bin/sh
# Ensure nginx has a certificate to start with.
#
# nginx refuses to start at all if ssl_certificate points at a missing file, so
# a stack that requires the operator to have generated one first fails on the
# very first `docker compose up`. Certificates can't be committed to the repo
# either. So: use mounted certs when they're there, and fall back to a
# self-signed pair generated here.
set -eu

MOUNTED_DIR=/etc/nginx/certs   # read-only bind mount; may be empty or absent
ACTIVE_DIR=/etc/nginx/tls      # what nginx.prod.conf actually points at

mkdir -p "${ACTIVE_DIR}"

if [ -f "${MOUNTED_DIR}/glimpse.crt" ] && [ -f "${MOUNTED_DIR}/glimpse.key" ]; then
    cp "${MOUNTED_DIR}/glimpse.crt" "${MOUNTED_DIR}/glimpse.key" "${ACTIVE_DIR}/"
    echo "[glimpse] using mounted TLS certificate"
    exit 0
fi

if [ -f "${ACTIVE_DIR}/glimpse.crt" ]; then
    echo "[glimpse] reusing previously generated self-signed certificate"
    exit 0
fi

echo "[glimpse] no certificate mounted at ${MOUNTED_DIR} — generating a self-signed one."
echo "[glimpse] Browsers will warn. For a trusted local cert:"
echo "[glimpse]   mkcert -cert-file docker/certs/glimpse.crt -key-file docker/certs/glimpse.key localhost 127.0.0.1"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "${ACTIVE_DIR}/glimpse.key" \
    -out "${ACTIVE_DIR}/glimpse.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
