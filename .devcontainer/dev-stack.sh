#!/usr/bin/env bash
# Start/stop/inspect the GLIMPSE dev stack (Flask backend :5052 + Vite :5173)
# as a detached background process, so the app is already up when the
# devcontainer finishes opening.
#
#   .devcontainer/dev-stack.sh start | stop | restart | status | logs
set -uo pipefail

WS="${GLIMPSE_WS:-/workspaces/GLIMPSE}"
[ -d "$WS" ] || WS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WS"

RUN_DIR="$WS/.devcontainer/.run"
PIDFILE="$RUN_DIR/dev-stack.pid"
LOGFILE="$RUN_DIR/dev-stack.log"
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

start() {
    if running; then
        echo "==> Dev stack already running (pid $(cat "$PIDFILE"))"
        status
        return 0
    fi

    # A rebuilt image with a stale volume can leave deps half-installed.
    [ -d node_modules/vite ] || { echo "==> node_modules incomplete, running npm install"; npm install; }
    [ -x local-server/.venv/bin/python ] || { echo "==> venv missing, running uv sync"; uv sync --project local-server; }

    echo "==> Starting backend (:5052) + frontend (:5173) in the background"
    : > "$LOGFILE"
    setsid nohup npm run dev >>"$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    disown 2>/dev/null || true

    # Bounded wait so the container reports an honest ready/not-ready state
    # without ever failing the open.
    wait_for_port 5052 "backend " 90 || true
    wait_for_port 5173 "frontend" 90 || true
    echo "==> Logs: $LOGFILE   (.devcontainer/dev-stack.sh logs)"
}

stop() {
    if running; then
        local pid; pid="$(cat "$PIDFILE")"
        echo "==> Stopping dev stack (pgid $pid)"
        kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
        sleep 2
        kill -KILL "-$pid" 2>/dev/null || true
    else
        echo "==> Dev stack not running"
    fi
    rm -f "$PIDFILE"
}

status() {
    running && echo "process : up (pid $(cat "$PIDFILE"))" || echo "process : down"
    port_up 5052 && echo "backend : http://localhost:5052  up" || echo "backend : down"
    port_up 5173 && echo "frontend: http://localhost:5173  up" || echo "frontend: down"
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
