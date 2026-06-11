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

**comming soon**

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
uv add -r requirements.txt --prerelease=allow
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

### Step 4: Install CIM-Builder (Required)

CIM-Builder is needed to export modified CIM/XML files.

In `GLIMPSE/local-server/`, clone CIM-Builder:

```bash
git clone -b develop https://github.com/PNNL-CIM-Tools/CIM-Builder.git
```

Navigate to the CIM-Builder directory and install it (without dependencies, as it requires an older version of cim-graph):

```bash
cd CIM-Builder
```

**With PIP:**

```bash
python -m pip install . --no-deps
```

**With UV:**

```bash
uv pip install . --no-deps
```

### Step 5: Install GLM Parser

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

Clone the GLM parser:

```bash
cd GLIMPSE/local-server/
```

```bash
git clone https://github.com/NREL/glm.git
```

```bash
cd glm
```

Build the parser (ensure [Nim](https://nim-lang.org/) is installed and in your PATH):

```bash
nim c -d:release --opt:size --passC:"-flto" --passL:"-flto" --app:lib --out:lib/_glm.so src/glm.nim
```

Create a wheel:

```bash
python setup.py bdist_wheel
# or
python3 setup.py bdist_wheel
```

Install the wheel from `dist/` folder:

**With PIP:**

```bash
pip install dist/<whl-filename>.whl
```

**With UV:**

```bash
uv pip install dist/<whl-filename>.whl
```

## Start GLIMPSE

From the `GLIMPSE/` root directory, run:

```bash
npm run dev
```

The application will start in development mode. Open your browser and navigate to the provided local address (typically `http://localhost:5173/`) to access GLIMPSE.

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
