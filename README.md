# GLIMPSE (Grid Layout Interface for Model Preview and System Exploration)

GLIMPSE is a graph-based web application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Node.js, and Python. It also uses following GLM parser that can be installed using pip: [GLM](https://github.com/NREL/glm) 

## Clone the repository and install dependencies
- [Node.js](https://nodejs.org/en)
- [Nim](https://nim-lang.org/install.html)

```
git clone http://github.com/pnnl/GLIMPSE

cd /GLIMPSE/glimpse/local-server/

python -m venv venv

pip install -r requirements.txt
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
## in `GLIMPSE/glimpse/` run 
```
npm install
npm run start
```

### Example:
We provide few examples of exploring starndard IEEE bus models using GLIMPSE. From the home page, upload all the ".glm" files from `data/123-bus-model`.

**To re-uplaod files after visualization, press `ctrl + R` or click `view` then `reload`**

![image](https://github.com/pnnl/glm_viz/assets/4779453/5c74d781-6491-49a9-afec-7fcf13a2ba56)

# Features
* Each node or edge in the legend can be double clicked for highlighting.
* Navigate through each highlighted Node with the **Prev** and **Next** buttons.
* Hovering over a node in the visualization will display a tooltip of that node's attribtues.
* **Auto layout** switch will allow for the dragging of nodes with mouse.
* Double Clicking on a node in the visualization will show a form that allows you to edit the nodes attributes.
* The **Show Plot** button will display a plot created from metrics gathered from the power grid model (Will show a filler plot for now).
* The **Show Stats** button will display a couple statistics values.
* If any changes were done to a node's attributes using the tool you can download a copy of the uploaded files to a desired directory with the changes using the **Export** button.