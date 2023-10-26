# GLIMPSE (Grid Layout Interface for Model Preview and System Exploration)

This visualization is a graph-based web application to visualize and update power grid models. The tool allows to search, highlight power grid objects. Additionally, it also supports update attributes and export updated model to integrate with GridLAB-D for future simulations. The application is developed using react.js, node.js, and python. It also uses following GLM parser that can be installed with pip: [GLM](https://github.com/NREL/glm) 

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
We provide few examples of exploring starndard IEEE bus models using GLIMSES. From the home page, upload all the ".gml" files from data/123-bus-model.
**To re-uplaod files after visualization, press `ctrl + R` or click `view` then `reload`**


![image](https://github.com/pnnl/glm_viz/assets/4779453/5c74d781-6491-49a9-afec-7fcf13a2ba56)
