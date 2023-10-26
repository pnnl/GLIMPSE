# GLIMPSE (Grid Layout Interface for Model Preview and System Exploration)

GLIMPSE is a graph-based web application to visualize and update GridLAB-D power grid models. The tool can be used to search and highlight power grid model objects. Additionally, it also update the model attributes and export the modified model future simulations. The application is developed using React.js, Node.js, and Python. It also uses following GLM parser that can be installed using pip: [GLM](https://github.com/NREL/glm) 

## Clone the repository and install dependencies
Install [Node.js](https://nodejs.org/en)

```
git clone http://github.com/pnnl/GLIMPSE
pip install glm
pip install networkx
```

## in `GLIMPSE/glimpse/` run 
```
npm install
npm run start
```

### Example:
We provide few examples of exploring starndard IEEE bus models using GLIMPSE. From the home page, upload all the ".glm" files from `data/123-bus-model`.

**To re-uplaod files after visualization, press `ctrl + R` or click `view` then `reload`**

![image](https://github.com/pnnl/glm_viz/assets/4779453/5c74d781-6491-49a9-afec-7fcf13a2ba56)