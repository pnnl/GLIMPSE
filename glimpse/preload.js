const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths),
   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath),
   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject),
   getJsonData: (path) => ipcRenderer.invoke("getJsonData", path),
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData),
   getPlot: () => ipcRenderer.invoke("getPlot"),
   onShowAttributes: (callback) => ipcRenderer.on("show-attributes", (_event, value) => callback(value)),
   getTheme: () => ipcRenderer.invoke("getSelectedTheme")
});