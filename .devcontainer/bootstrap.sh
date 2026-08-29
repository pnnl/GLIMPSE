#!/usr/bin/env bash
# postCreateCommand: one-time setup after the container is built.
# node_modules and local-server/.venv are named volumes, so Docker creates them
# root-owned on first run — they must be handed to the container user before
# npm/uv can write into them.
set -euo pipefail

WS="${1:-/workspaces/GLIMPSE}"
cd "$WS"

echo "==> Fixing ownership on the mounted volumes"
sudo chown "$(id -u):$(id -g)" node_modules local-server/.venv

echo "==> npm install"
npm install

echo "==> uv sync (creates local-server/.venv, incl. the dev group: pytest)"
uv sync --project local-server

# Interactive shells get the venv activated the same way a local dev would.
# remoteEnv already puts .venv/bin on PATH for VS Code processes; this makes
# `python`, `pip` and the (venv) prompt marker behave in plain terminals too.
ACTIVATE_LINE="[ -f \"$WS/local-server/.venv/bin/activate\" ] && . \"$WS/local-server/.venv/bin/activate\""
for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
    [ -f "$RC" ] || continue
    grep -qF 'local-server/.venv/bin/activate' "$RC" || {
        printf '\n# GLIMPSE: activate the backend virtualenv\n%s\n' "$ACTIVATE_LINE" >> "$RC"
    }
done

echo "==> Bootstrap complete: $(local-server/.venv/bin/python --version)"
