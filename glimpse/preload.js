const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths), // working
   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath), // Working
   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject), // Working
   getJsonData: (path) => ipcRenderer.invoke("getJsonData", path),
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData), // working
   getPlot: () => ipcRenderer.invoke("getPlot"), // Working
   onShowAttributes: (callback) => ipcRenderer.on("show-attributes", (_event, value) => callback(value)), // working
   getTheme: () => ipcRenderer.invoke("getSelectedTheme") // working
});