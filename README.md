# GLIMPSE v0.7.0-alpha ✨

![NSD_2294_BRAND_HAGEN-GLIMPSE_final_color](https://github.com/user-attachments/assets/182d1235-eb30-4467-b880-aec3000e786f)

GLIMPSE is a graph-based desktop application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Electron.js, Node.js, Sigma.js, and Python.

## UI

> [!NOTE]
> If you are looking for EPA-developed energy planning tool GLIMPSE. See [epa glimpse](https://epa.gov/glimpse) for information about that project.

## Installers (Windows, MacOS, Linux)

Check out the [releases](https://github.com/pnnl/GLIMPSE/releases) for installers or build the tool with the following instructions.

## Build Instructions

### Download Node and Nim

1. [Node.js](https://nodejs.org/en)
2. [Nim](https://nim-lang.org/install.html)
   - Only if planning to export glm files modified with GLIMPSE or building the glm parser on Apple silicon

In a directory of your choice clone the repository

```bash
git clone http://github.com/pnnl/GLIMPSE
```

Then in `GLIMPSE/`:

```bash
npm install
```

### Create a python environment for local server

Creating environment with python venv or Anaconda

```bash
cd GLIMPSE/local-server/
```

#### UV

```bash
uv add -r requirements.txt --prerelease=allow
```

#### VENV

```bash
python -m venv .venv
```

#### Conda

```bash
conda create -n env
```

### Activating Python Environment

Once the python venv environment is created activate it using one of the following command for your system in the table below:

If using conda simply activate the environment

```bash
conda activate env
```

| Platform | Shell      | Command to activate virtual environment |
| :------: | :--------- | :-------------------------------------- |
|  POSIX   | bash/zsh   | `$ source .venv/bin/activate`           |
|    -     | fish       | `$ source .venv/bin/activate.fish`      |
|    -     | csh/tcsh   | `$ source .venv/bin/activate.csh`       |
|    -     | PowerShell | `$ .\.venv\Scripts\activate.ps1`        |
| Windows  | cmd.exe    | `C:\> .venv\Scripts\activate.bat`       |
|    -     | PowerShell | `PS C:\> .\.venv\Scripts\activate.ps1`  |

> [!NOTE]
> You will know if the environment activation worked if there is a `(.venv)` indicator at the start of your command line.

### Install Requirements

> [!NOTE]
> If you used `uv` to create your environment you may skip the following section

```bash
pip install -r requirements.txt
```

### Additional Required Dependencies

install glm parser

> [!WARNING]
> If on Apple silicon (M chips) you will need to build the glm package using nim.
> [build glm](#additional-instructions-for-macos-with-apple-silicon)

#### PIP

```bash
pip install glm
```

#### UV

```bash
uv add glm
```

or

```bash
uv pip install glm
```

Install CIM-Builder to environment. CIM-Builder is used to export modified CIM/XML files with GLIMPSE interface.

In `GLIMPSE/local-server/` clone CIM-Builder.

```bash
git clone -b develop https://github.com/PNNL-CIM-Tools/CIM-Builder.git
```

Then in `GLIMPSE/local-server/CIM-Builder/` install as a python library to environment.

> [!NOTE]
> We install the CIM-Builder package with not dependencies because it will require and older version of cim-graph

#### PIP

```bash
python -m pip install . --no-deps
```

#### UV

```bash
uv pip install . --no-deps
```

### Additional Instructions for MacOS with Apple Silicon

In `GLIMPSE/local-server/` clone the glm parser repository.

```bash
git clone https://github.com/NREL/glm.git
```

Then in `GLIMPSE/local-server/glm/` you will then build the glm parser. For this you need to make sure that [nim](https://nim-lang.org/) is installed and added to your computers `PATH`.

```bash
nim c -d:release --opt:size --passC:"-flto" --passL:"-flto" --app:lib --out:lib/_glm.so src/glm.nim
```

Next run the following command to create the glm python library wheel

```bash
python setup.py bdist_wheel
```

or

```bash
python3 setup.py bdist_wheel
```

Once that is done, in `GLIMPSE/local-server/glm/dist/` there is a `.whl` archive that you are able to install using pip to your python environment

#### PIP

```bash
# .whl file name will vary based on system
pip install dist/<whl-filename>.whl
```

#### UV

```bash
uv pip install dist/<whl-filename>.whl
```

## Start GLIMPSE

In `GLIMPSE/` start the application with the following command:

```bash
npm run dev 
```

## Supported Input Files

### GLIMPSE supports two different JSON file formats for custom graph visualizations.

1. GLIMPSE's data structure based off the [glm2json](https://github.com/NREL/glm) parser output used by GLIMPSE.
   - [example 1](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/customModelExample.json)
   - [example 2](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/levelExample.json)
   - [example 3](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/socialExample.json)
   - [example 4](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/test.json)
1. NetworkX's [node_link_data](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html#networkx.readwrite.json_graph.node_link_data) JSON dump function
   - [fishing example](https://github.com/pnnl/GLIMPSE/blob/master/data/demo_examples/VAST24_Release0417G.json)

### GLIMPSE glm (GridLAB-D Model) file support

1. To get started upload all the `.glm` files in the `GLIMPSE/glimpse/testing/123/` folder
2. Feel free to also upload the 3000, 8500, and 9500 model `.glm` files to experience GLIMPSE's GPU accelerated rendering using [sigma.js](https://www.sigmajs.org/)
3. To re-upload files after visualization, click on the `LOAD` button at the top right of the application.

### CIM (.XML) File Support

1. Example file found [here](https://github.com/pnnl/GLIMPSE/tree/master/data/cim).

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
