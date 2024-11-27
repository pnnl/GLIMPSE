![NSD_2294_BRAND_HAGEN-GLIMPSE_final_color](https://github.com/user-attachments/assets/182d1235-eb30-4467-b880-aec3000e786f)

# v0.4.1 ✨

GLIMPSE is a graph-based desktop application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Electron.js, Node.js, and Python.

## Build Instructions

> :warning: **Building the tool on an M3 Macbook currently not working**: Currently working on get a build working on latest MacOS

**Download Node and Nim**

-  [Node.js](https://nodejs.org/en)
-  [Nim](https://nim-lang.org/install.html) (Only if planning to export glm files updated with GLIMPSE tool)

In a directory of your choice clone the repository :

```bash
git clone http://github.com/pnnl/GLIMPSE
```

Then in `GLIMPSE/glimpse`:

```bash
npm install
```

After all node modules are installed run the following command to bundle the source code using webpack:

```bash
npm run watch
```

Then after the source code is bundled `Ctrl+C` to end the dev server that webpack starts.
After that in `GLIMPSE/glimpse/local-server` create a python environment:

```
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

Finally in `GLIMPSE/glimpse/` start the application with the following command:

```bash
npm run start
```

# Supported Files

## JSON

### GLIMPSE supports two different JSON file structures:

1. GLIMPSE's data structure which is based on the [glm2json](https://github.com/NREL/glm) parser used by GLIMPSE.
   Examples:
   -  [example 1](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/customModelExample.json)
   -  [example 2](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/levelExample.json)
   -  [example 3](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/socialExample.json)
   -  [example 4](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/test.json)
2. Networkx's [node_link_data](https://networkx.org/documentation/stable/reference/readwrite/generated/networkx.readwrite.json_graph.node_link_data.html#networkx.readwrite.json_graph.node_link_data) JSON dump function
   Example:
   -  [fishing example](https://github.com/pnnl/GLIMPSE/blob/master/glimpse/data/demo_examples/gdata.json)

## GLM (GridLAB-D Model)

### Examples:

We provide few examples of exploring standard IEEE bus models using GLIMPSE. From the home page, upload all the `.glm` files from `GLIMPSE/glimpse/data/123-bus-model`.

**To re-upload files after visualization, click on the HOME button**
![ui](https://github.com/user-attachments/assets/76ecdcf4-df35-4c9f-9878-c99cdc49dfea)

## Cite as

```
@inproceedings{sanchez2024glimpse,
  title={GLIMPSE of Future Power Grid Models},
  author={Sanchez, Armando Mendoza and Purohit, Sumit},
  booktitle={2024 IEEE 18th International Conference on Semantic Computing (ICSC)},
  pages={224--225},
  year={2024},
  organization={IEEE}
}
```
