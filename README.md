# GLIMPSE (Grid Layout Interface for Model Preview and System Exploration)

GLIMPSE is a graph-based web application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Node.js, and Python.

## Clone the repository and install dependencies
- [Node.js](https://nodejs.org/en)
- [Nim](https://nim-lang.org/install.html)

### **Conda environment is recommended to build the application**
```
git clone http://github.com/pnnl/GLIMPSE

cd /GLIMPSE/glimpse/

npm install

npm run watch

# on another terminal run the following: 
cd /GLIMPSE/glimpse/local-server/

python -m venv venv
```
### If on `Windows` go to `/venv/Scripts/` and rename **json2glm** to **json2glm.exe**

### In `/GLIMPSE/glimpse/local-server/` Activate Virtual Environment using the following command for your system
| Platform | Shell      | Command to activate virtual environment |
| :------: | :--------- | :-------------------------------------- |
| POSIX    | bash/zsh   | `$ source <venv>/bin/activate`          |
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

**To re-uplaod files after visualization, press `ctrl + R` or click `view` then `reload`**

![image](https://github.com/pnnl/glm_viz/assets/4779453/5c74d781-6491-49a9-afec-7fcf13a2ba56)
