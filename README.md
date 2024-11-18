![NSD_2294_BRAND_HAGEN-GLIMPSE_final_color](https://github.com/user-attachments/assets/182d1235-eb30-4467-b880-aec3000e786f)

# v0.4.0 ✨

GLIMPSE is a graph-based desktop application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Electron.js, Node.js, and Python.

## Build Instructions

> :warning: **Building the tool on an M3 Macbook currently not working**: Currently working on get a build working on latest MacOS

**Download Node and Nim**

-  [Node.js](https://nodejs.org/en)
-  [Nim](https://nim-lang.org/install.html) (Only if planning to export glm files updated with GLIMPSE tool)

```
git clone http://github.com/pnnl/GLIMPSE

cd /GLIMPSE/glimpse/

npm install

npm run watch

# on another terminal run the following:
cd /GLIMPSE/glimpse/local-server/

python -m venv venv
```

### In `/GLIMPSE/glimpse/local-server/` Activate Virtual Environment using the following command for your system

| Platform | Shell      | Command to activate virtual environment |
| :------: | :--------- | :-------------------------------------- |
|  POSIX   | bash/zsh   | `$ source <venv>/bin/activate`          |
|    -     | fish       | `$ source <venv>/bin/activate.fish`     |
|    -     | csh/tcsh   | `$ source <venv>/bin/activate.csh`      |
|    -     | PowerShell | `$ <venv>/bin/Activate.ps1`             |
| Windows  | cmd.exe    | `C:\> <venv>\Scripts\activate.bat`      |
|    -     | PowerShell | `PS C:\> <venv>\Scripts\Activate.ps1`   |

```
pip install -r requirements.txt
```

## Then in `GLIMPSE/glimpse/` run

```
npm run start
```

### Example:

We provide few examples of exploring starndard IEEE bus models using GLIMPSE. From the home page, upload all the ".glm" files from `data/123-bus-model`.

**To re-uplaod files after visualization, click on the HOME button**

![ui](https://github.com/user-attachments/assets/76ecdcf4-df35-4c9f-9878-c99cdc49dfea)

## Cite as

```yaml
@inproceedings{sanchez2024glimpse,
  title={GLIMPSE of Future Power Grid Models},
  author={Sanchez, Armando Mendoza and Purohit, Sumit},
  booktitle={2024 IEEE 18th International Conference on Semantic Computing (ICSC)},
  pages={224--225},
  year={2024},
  organization={IEEE}
}
```
