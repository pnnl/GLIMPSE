# GLIMPSE v0.5.0 ✨

![NSD_2294_BRAND_HAGEN-GLIMPSE_final_color](https://github.com/user-attachments/assets/182d1235-eb30-4467-b880-aec3000e786f)

GLIMPSE is a graph-based desktop application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Electron.js, Node.js, and Python.

## UI

![UI](https://github.com/user-attachments/assets/12896785-d76a-470c-b80f-f91870b537f1)

**NOTE**: If you are looking for EPA-developed energy planning tool GLIMPSE. See [epa glimpse](https://epa.gov/glimpse) for information about that project.

## Installers (Windows, MacOS, Linux)

Check out the [releases](https://github.com/pnnl/GLIMPSE/releases) for installers or build the tool with the following instructions.

## Build Instructions

### Download Node and Nim

- [Node.js](https://nodejs.org/en)
- [Nim](https://nim-lang.org/install.html) (Only if planning to export glm files updated with GLIMPSE tool)

In a directory of your choice clone the repository :

```bash
git clone http://github.com/pnnl/GLIMPSE
```

Then in `GLIMPSE/`:

```bash
npm install
```

After all node modules are installed in `GLIMPSE/local-server` create a python environment:

```bash
python -m venv glimpse-server
```

Once the environment is created activate it using one of the following command for your system in the table below:

| Platform | Shell      | Command to activate virtual environment       |
| :------: | :--------- | :-------------------------------------------- |
|  POSIX   | bash/zsh   | `$ source glimpse-server/bin/activate`        |
|    -     | fish       | `$ source glimpse-server/bin/activate.fish`   |
|    -     | csh/tcsh   | `$ source glimpse-server/bin/activate.csh`    |
|    -     | PowerShell | `$ glimpse-server/bin/Activate.ps1`           |
| Windows  | cmd.exe    | `C:\> glimpse-server\Scripts\activate.bat`    |
|    -     | PowerShell | `PS C:\> glimpse-server\Scripts\Activate.ps1` |

You will know if the environment activation worked if there is a `(glimpse-server)` indicator at the start of your command line.

Next install the server's requirements:

```bash
pip install -r requirements.txt
```

Install CIM-Builder to environment. CIM-Builder is used to export modified CIM/XML files with GLIMPSE interface.

In `GLIMPSE/local-server/` clone CIM-Builder.

```bash
git clone -b develop https://github.com/PNNL-CIM-Tools/CIM-Builder.git
```

Then in `GLIMPSE/local-server/CIM-Builder/` install as a python library to environment.

```bash
python -m pip install .
```

### Additional Instructions for MacOS with Apple Silicon

In `GLIMPSE/local-server/` clone the glm parser repository.

```bash
git clone https://github.com/NREL/glm.git
```

Then in `GLIMPSE/local-server/glm/` you will then build the glm parser. For this you need to make sure that `nim` is installed and added to your computers `PATH`.

```bash
nim c -d:release --opt:size --cpu:arm64 --passC:"-flto -target arm64-apple-macos11" --passL:"-flto -target arm64-apple-macos11" --app:lib --out:lib/_glm.so src/glm.nim
```

Next run the following command to create the glm python library wheel

```bash
python setup.py bdist_wheel --plat-name=macosx_11_0_arm64
```

Once that is done, in `GLIMPSE/local-server/glm/dist/` there is a `.whl` archive that you are able to install using pip to the local `glimpse-server` python environment

```bash
python -m pip install ./dist/glm-0.4.4-py2.py3-none-macosx_11_0_arm64.whl
```

## Start GLIMPSE

In `GLIMPSE/` start the application with the following command:

```bash
npm run dev
```

## Supported Input Files

### GLIMPSE supports two different JSON file formats for custom graph visualizations.

1. GLIMPSE's data structure based off the [glm2json](https://github.com/NREL/glm) parser output used by GLIMPSE.
   - [example 1](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/customModelExample.json)
   - [example 2](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/levelExample.json)
   - [example 3](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/socialExample.json)
   - [example 4](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/test.json)
2. Networkx's [node_link_data](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html#networkx.readwrite.json_graph.node_link_data) JSON dump function
   - [fishing example](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/gdata.json)

### GLIMPSE glm (GridLAB-D Model) file support

1. To get started upload all the `.glm` files in the `GLIMPSE/glimpse/data/123-bus-model/` folder
2. Feel free to also upload the 3000, 8500, and 9500 model `.glm` files to experience GLIMPSE's scalability through community detection and node clustering.
3. To re-upload files after visualization, click on the `HOME` button at the top right of the app.

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
