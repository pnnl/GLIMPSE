# GLIMPSE (Grid Layout Interface for Model Preview and System Exploration)

This visualization is a graph-based web application to visualize and update power grid models. The tool allows to search, highlight power grid objects. Additionally, it also supports update attributes and export updated model to integrate with GridLAB-D for future simulations. The application is developed using react.js, node.js, and python. It also uses follwoing GLM parser: [GLM](https://github.com/NREL/glm) 

## Clone the repository and install [Node.js](https://nodejs.org/en)
```
git clone github.com/pnnl/GLIMPSE
conda install -c anaconda nodejs
pip install glm
```

## in `glimpse/backend/` run 
```
npm install
npm run start
```

## in `glimpse/client/` run 
```
npm install
npm run make
```
The `make` command will generate an executable for your
specific system and will be stored in `glimpse/client/out/make/`


![image](https://github.com/pnnl/glm_viz/assets/4779453/5c74d781-6491-49a9-afec-7fcf13a2ba56)


Please reach out if there are any issues creating the executable.
