const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   getJsonData: (paths) => ipcRenderer.invoke("openPaths", paths), //working
   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath), // Working
   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject), //Working
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData), // in progress
   getPlot: () => ipcRenderer.invoke("getPlot") //Working
})