#!/usr/bin/env bash
# Start/stop/inspect the GLIMPSE stack (Flask backend :5052 + vite preview
# :4173) as a detached background process, so the app is already up when the
# container finishes opening.
#
# This serves the *built* bundle from dist/. To pick up code changes:
#   npm run codespace:build && .devcontainer/serve.sh restart
#
#   .devcontainer/serve.sh start | stop | restart | status | logs
set -uo pipefail

WS="${GLIMPSE_WS:-/workspaces/GLIMPSE}"
[ -d "$WS" ] || WS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WS"

RUN_DIR="$WS/.devcontainer/.run"
PIDFILE="$RUN_DIR/serve.pid"
LOGFILE="$RUN_DIR/serve.log"
mkdir -p "$RUN_DIR"

export PATH="$WS/local-server/.venv/bin:$PATH"
export VIRTUAL_ENV="$WS/local-server/.venv"

running() {
    [ -f "$PIDFILE" ] || return 1
    local pid; pid="$(cat "$PIDFILE" 2>/dev/null)" || return 1
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# A bare /dev/tcp probe can hang for minutes when the connection is dropped
# rather than refused (WSL, some docker network drivers) — always bound it.
port_up() { timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null; }

wait_for_port() {
    local port="$1" label="$2" deadline=$(( SECONDS + ${3:-90} ))
    while [ "$SECONDS" -lt "$deadline" ]; do
        port_up "$port" && { echo "    $label ready on :$port"; return 0; }
        sleep 1
    done
    echo "    $label did NOT come up on :$port — see $LOGFILE"
    return 1
}

app_url() {
    if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
        echo "https://${CODESPACE_NAME}-4173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    else
        echo "http://localhost:4173"
    fi
}

start() {
    if running; then
        echo "==> Already running (pid $(cat "$PIDFILE"))"
        status
        return 0
    fi

    # A rebuilt image with stale state can leave things half-installed.
    [ -d node_modules/vite ] || { echo "==> node_modules incomplete, running npm install"; npm install; }
    [ -x local-server/.venv/bin/python ] || { echo "==> venv missing, running uv sync"; uv sync --project local-server; }
    # dist/ is gitignored, so it only exists once something has built it.
    [ -f dist/index.html ] || { echo "==> dist/ missing, building"; npm run codespace:build; }

    echo "==> Starting backend (:5052) + built frontend (:4173) in the background"
    : > "$LOGFILE"
    setsid nohup npm run codespace:start >>"$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    disown 2>/dev/null || true

    # Bounded wait so the container reports an honest ready/not-ready state
    # without ever failing the open.
    wait_for_port 5052 "backend " 90 || true
    wait_for_port 4173 "frontend" 90 || true
    echo "==> GLIMPSE: $(app_url)"
    echo "==> Logs: $LOGFILE   (.devcontainer/serve.sh logs)"
}

stop() {
    if running; then
        local pid; pid="$(cat "$PIDFILE")"
        echo "==> Stopping (pgid $pid)"
        kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
        sleep 2
        kill -KILL "-$pid" 2>/dev/null || true
    else
        echo "==> Not running"
    fi
    rm -f "$PIDFILE"
}

status() {
    running && echo "process : up (pid $(cat "$PIDFILE"))" || echo "process : down"
    port_up 5052 && echo "backend : 127.0.0.1:5052  up" || echo "backend : down"
    port_up 4173 && echo "frontend: $(app_url)  up" || echo "frontend: down"
    echo "python  : $(command -v python) ($(python --version 2>&1))"
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; start ;;
    status)  status ;;
    logs)    tail -n 200 -f "$LOGFILE" ;;
    *)       echo "usage: $0 {start|stop|restart|status|logs}" >&2; exit 2 ;;
esac
