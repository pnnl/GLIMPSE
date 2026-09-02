#!/usr/bin/env bash
# postCreateCommand: one-time setup after the container is built.
#
# Ends by producing dist/ — a Codespace serves the *built* app, so editing src/
# has no effect until someone runs `npm run codespace:build` again.
set -euo pipefail

WS="${1:-/workspaces/GLIMPSE}"
cd "$WS"

# npm install, not npm ci: package-lock.json is gitignored, so a fresh clone
# has no lockfile to install from.
echo "==> npm install"
npm install

echo "==> uv sync (creates local-server/.venv, incl. the dev group: pytest)"
uv sync --project local-server

echo "==> Building the frontend bundle"
npm run codespace:build

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

echo "==> Setup complete: $(local-server/.venv/bin/python --version)"
