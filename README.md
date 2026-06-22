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

[Releases](https://github.com/pnnl/GLIMPSE/releases/)

### Option 2: Build from Source

#### Quick Overview

This section will walk you through installing dependencies and building GLIMPSE. Here's what you'll do:

1. ✅ Install Node.js (and optionally Nim)
2. ✅ Clone the repository and install Node dependencies
3. ✅ Create and activate a Python environment
4. ✅ Install Python dependencies and plugins
5. ✅ Start the development server

#### Prerequisites

1. **[Node.js](https://nodejs.org/en)** — Required for all users
2. **[Nim](https://nim-lang.org/install.html)** — Only needed if:
    - You're on Apple silicon (M chips), OR
    - You plan to export modified GLM files

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

### Step 4: Install GLM Parser

#### Standard Installation (Windows, Linux, Intel/AMD Mac)

**With PIP:**

```bash
pip install glm
```

**With UV:**

```bash
uv pip install glm
```

#### Special Instructions for Apple Silicon (M Chips)

You'll need to build the GLM parser from source using Nim.

Clone the glm parser repository i forked:

```bash
cd GLIMPSE/local-server/
```

```bash
git cone https://github.com/itsMando/glm.git
```

```bash
cd glm
```

Build the parser (ensure [Nim](https://nim-lang.org/) is installed and in your PATH):

```bash
nimble -v
```

```bash
nimble package
nimble release
```

Install the python binary distributable from `dist/` folder:

**With PIP:**

```bash
pip install dist/*.whl
```

**With UV:**

```bash
uv pip install dist/*.whl
```

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

## Run with Docker

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
