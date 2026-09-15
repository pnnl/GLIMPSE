![NSD_2294_BRAND_HAGEN-GLIMPSE_final_color](https://github.com/user-attachments/assets/182d1235-eb30-4467-b880-aec3000e786f)

GLIMPSE is a graph-based desktop application to visualize and update GridLAB-D power grid models. With GLIMPSE, you can:

- **Search and highlight** power grid model objects
- **Update** model attributes
- **Export** modified models for future simulations
- **Leverage GPU acceleration** for rendering large power grids

The application is built with **React.js**, **Electron.js**, **Node.js**, **Sigma.js**, and **Python**.

> [!NOTE]
> If you're looking for the EPA-developed energy planning tool called glimpse, visit [epa.gov/glimpse](https://epa.gov/glimpse).

## Installation

### Option 1: Pre-Built Installers (Easiest)

> [!WARNING]
>
> **For MacOS installer**
>
> GLIMPSE app is not signed and will not run after installation. Run the following command to remove the application from "quarintine"
>
> ```bash
> sudo xattr -r -d com.apple.quarantine /Applications/GLIMPSE.app
> ```

**[Releases](https://github.com/pnnl/GLIMPSE/releases/)** <-----

### Option 2: Docker

The repository ships with a [Docker Compose](https://docs.docker.com/compose/) setup that builds and runs GLIMPSE as two containers — the React frontend (served by nginx) and the Flask + SocketIO backend — so you don't need to install Node, Python, or any of the plugins yourself.

> [!NOTE]
> This section assumes you already have a working **Docker Engine** with the **Docker Compose** plugin (`docker compose version` should print a version). If not, see [Docker's install guide](https://docs.docker.com/engine/install/).

### Step 1: Clone the Repository

```bash
git clone http://github.com/pnnl/GLIMPSE
cd GLIMPSE
```

### Step 2: Build and Start the Containers

From the `GLIMPSE/` root directory (where `docker-compose.yml` lives), run:

```bash
docker compose up --build
```

The first build takes a few minutes while images are created; subsequent runs are cached and start quickly. Add `-d` to run detached (in the background):

```bash
docker compose up --build -d
```

### Step 3: Open GLIMPSE

Once the containers are running, open your browser and navigate to:

```
http://localhost:5173
```

The frontend serves the UI on port **5173** and the backend listens on port **5052**.

### Stopping the Containers

```bash
docker compose down
```

This stops and removes the containers and network. Built images remain cached for the next start. (If you ran in the foreground, you can also press `Ctrl+C` first, then run `docker compose down` to clean up.)

### Option 3: GitHub Codespaces (No Install At All)

If you can't install software locally, you can run GLIMPSE entirely in your browser. A
[Codespace](https://docs.github.com/en/codespaces) builds the app on GitHub's infrastructure and
forwards it to a URL only you can open — nothing is installed on your machine.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/pnnl/GLIMPSE)

Or, from the repository page: **Code → Codespaces → Create codespace on `master`**.

The first build takes a few minutes (installing Node and Python dependencies, then building the
frontend). After that, the container starts GLIMPSE automatically and VS Code offers to open the
forwarded URL — a `https://<your-codespace>-4173.app.github.dev` address. If you dismiss the prompt,
the **Ports** tab lists it under the label **GLIMPSE**.

#### You get the built app, not the dev server

A Codespace serves the production bundle from `dist/`, so editing files under `src/` has **no effect
on the running app**. That is deliberate: exploring or accidentally changing the code can't break
GLIMPSE for you. To make code changes take effect:

```bash
npm run codespace:build && .devcontainer/serve.sh restart
```

Other useful commands inside the Codespace terminal:

```bash
.devcontainer/serve.sh status    # is the backend/frontend up?
.devcontainer/serve.sh logs      # tail the combined log
.devcontainer/serve.sh stop      # stop both processes
```

The regular `npm run dev` workflow from [Option 4](#option-4-build-from-source) still works if you
want hot reload — just stop the built app first so the ports are free.

#### File uploads are capped at ~16 MB

GitHub caps the request body on a forwarded port at **16 MB** and rejects anything larger with a
`413` before it ever reaches GLIMPSE. This is GitHub's limit, not the app's — the backend accepts up
to `MAX_UPLOAD_MB` (65 MB by default), and raising that changes nothing here.

The bundled models are unaffected, because they load **server-side**: pick one from **Example
Models** and the backend reads it straight off disk, so the request carries only the model's name.
The IEEE 9500 feeder (a 56 MB file, 13,591 objects) opens this way in a Codespace without issue.

To open a large model of your own, either drop it into the `models/` folder in the Codespace's file
explorer and load it from there, or run GLIMPSE locally, where no such limit applies.

#### Sharing and privacy

The forwarded port is **private to you** by default — a GitHub login is required, so pasting the URL
to someone else won't give them access. Everyone who wants to use GLIMPSE should create their own
Codespace from the repository. If you deliberately want to share a running instance, right-click the
port in the **Ports** tab and set **Port Visibility → Public**; be aware this makes it reachable by
anyone with the link, with no authentication in front of the backend.

#### How it's wired

Only **one** port is exposed. `vite preview` serves the built bundle on `:4173` and proxies `/api`
and `/socket.io` to the Flask backend on `127.0.0.1:5052` inside the same container. Because the
browser talks to a single origin, there is no CORS to configure and no second forwarded port to
authenticate against. The backend is not reachable from outside the Codespace.

> [!NOTE]
> GridAPPS-D features (live simulations, platform model browsing, the distributed-agent views) are
> unavailable in a Codespace — there is no broker to connect to. GLIMPSE detects this at startup and
> disables those panels; file upload, visualization, editing, and export all work normally.

### Option 4: Build From Source

#### Quick Overview

This section will walk you through installing dependencies and building GLIMPSE. Here's what you'll do:

1. ✅ Install Node.js
2. ✅ Clone the repository and install Node dependencies
3. ✅ Create and activate a Python environment
4. ✅ Install Python dependencies
5. ✅ Start the development server

#### Prerequisites

1. **[Node.js](https://nodejs.org/en)** — Required for all users

### Step 1: Clone the Repository

In a directory of your choice, clone the repository:

```bash
git clone http://github.com/pnnl/GLIMPSE
```

```glm
cd GLIMPSE
```

### Step 2: Install Node Dependencies

```bash
npm install
```

### Step 3: Set Up Python Environment

Navigate to the local server directory:

```bash
cd GLIMPSE/local-server/
```

#### Choose your package manager and create the environment:

**Option A: UV (Recommended)**

```bash
uv sync
```

**Option B: VENV**

```bash
python -m venv .venv
```

**Option C: Conda**

```bash
conda create -n glimpse_env
conda activate glimpse_env
```

#### Activate your environment:

| Platform | Shell      | Command                          |
| :------: | :--------- | :------------------------------- |
|  POSIX   | bash/zsh   | `source .venv/bin/activate`      |
|    -     | fish       | `source .venv/bin/activate.fish` |
|    -     | csh/tcsh   | `source .venv/bin/activate.csh`  |
|    -     | PowerShell | `.\.venv\Scripts\activate.ps1`   |
| Windows  | cmd.exe    | `.venv\Scripts\activate.bat`     |
|    -     | PowerShell | `.\.venv\Scripts\activate.ps1`   |
|  macOS   | bash/zsh   | `source .venv/bin/activate`      |

> [!NOTE]
> You'll know the environment is active when you see `(.venv)` at the start of your command line.
> For conda, use `conda activate glimpse_env` instead.

#### Install dependencies (skip if using UV):

If you used VENV or Conda, install requirements:

```bash
pip install -r requirements.txt
```

The `.glm` parser ([`glmparser`](local-server/glmparser/)) is pure Python and ships as part of
`local-server/` — no separate install or build step is needed.

## Start GLIMPSE

From the `GLIMPSE/` root directory, run:

```bash
npm run dev
```

The application will start in development mode. Open your browser and navigate to the provided local address (typically `http://localhost:5173/`) to access GLIMPSE.

## Desktop App (Electron)

GLIMPSE can also run as a standalone desktop application. The Electron shell starts the bundled local server automatically on launch and shuts it down (including all child processes) when the window is closed — no terminal or browser needed.

> [!NOTE]
> These steps assume you have completed the **Build from Source** setup above (Node dependencies and the Python environment for `local-server/`). The Python environment must include `pyinstaller`, which is listed in both `local-server/requirements.txt` and `local-server/pyproject.toml`.

### Develop in a Desktop Window

Runs the Python backend, the Vite dev server, and Electron together (with hot reload). Closing the Electron window stops all three:

```bash
npm run electron:dev
```

### Build an Installer

Installers are built **on and for the OS you are running** (electron-builder cannot cross-compile, e.g. a Windows installer must be built on Windows):

```bash
npm run dist          # build for the current OS
npm run dist:linux    # AppImage + .deb   (run on Linux)
npm run dist:win      # NSIS installer    (run on Windows)
npm run dist:mac      # .dmg              (run on macOS)
```

Each `dist` command runs three steps:

1. `vite build` — bundles the React frontend into `dist/`
2. `pyinstaller server.spec` — freezes the Python backend (with its Python runtime) into `local-server/dist/server/`
3. `electron-builder` — packages both into an installer in `release/`

The finished installer is written to the `release/` directory. The installed app needs no Node or Python on the target machine — the backend is fully self-contained.

> [!TIP]
> If `pyinstaller` is not on your PATH, activate the Python environment you created for `local-server/` first (or, with UV, run `uv run pyinstaller server.spec --noconfirm` inside `local-server/`).

## Supported Input Files

### JSON Formats

GLIMPSE supports two JSON file formats for custom graph visualizations:

1. **GLIMPSE JSON Format** — Based on [glm2json](https://github.com/NREL/glm) parser output
    - [Example 1](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/customModelExample.json)
    - [Example 2](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/levelExample.json)
    - [Example 3](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/socialExample.json)
    - [Example 4](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/test.json)

2. **NetworkX Node-Link Format** — From NetworkX's [node_link_data](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html#networkx.readwrite.json_graph.node_link_data) function
    - [Fishing example](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/VAST24_Release0417G.json)

### GridLAB-D (.glm) Files

To get started with GridLAB-D models:

1. Start with example models in `GLIMPSE/testing/123/` — upload all `.glm` files from this folder
2. Try larger models: `3000/`, `8500/`, and `9500/` to experience GPU-accelerated rendering with [Sigma.js](https://www.sigmajs.org/)
3. To re-upload files after visualization, click the **LOAD** button at the top right

### CIM/XML Files

GLIMPSE can import and export CIM (Common Information Model) files.

- Example CIM files are available [here](https://github.com/pnnl/GLIMPSE/tree/master/data/cim)
- Modified models can be exported as CIM/XML files through the GLIMPSE interface

```bash
cd local-server
uv sync --group dev      # pytest is a dev dependency, not in requirements-server.txt
.venv/bin/python -m pytest
```

or, from the repo root:

```bash
npm run test:server
```

This is separate from [`socket-testing/`](socket-testing/), which exercises the SocketIO event API
described below and requires a running backend (`npm run dev:backend`) rather than being a pytest
suite.

## Socket Events API

GLIMPSE exposes a [SocketIO](https://socket.io/) event API so external scripts can
**load graphs** and **update the live visualization** — adding, removing,
restyling, hiding, and showing nodes and edges in any connected frontend. Both the
GLIMPSE JSON format and NetworkX node-link data are accepted.

- **Full reference:** [`socket-testing/EVENTS_API.md`](socket-testing/EVENTS_API.md)
  — payload shapes, field references, the data model, and example clients.
- **Runnable examples:** [`socket-testing/`](socket-testing/) — connect and exercise
  every event (`load-graph`, `update`, `add-node`, `add-edge`, `delete-node`,
  `delete-edge`).

```python
import socketio, networkx as nx
sio = socketio.Client(); sio.connect("http://127.0.0.1:5052")
sio.call("load-graph", nx.node_link_data(nx.karate_club_graph()))
sio.call("update", {"id": "0", "elementType": "node",
                    "updates": {"color": "#ff0000", "size": 18, "hidden": None}})
```

## Cite as

```BibTeX
@inproceedings{sanchez2024glimpse,
  title={GLIMPSE of Future Power Grid Models},
  author={Sanchez, Armando Mendoza and Purohit, Sumit},
  booktitle={2024 IEEE 18th International Conference on Semantic Computing (ICSC)},
  pages={224--225},
  year={2024},
  organization={IEEE}
}
```
