const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   getData: (paths) => ipcRenderer.invoke("glm2json", paths), //working
   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath), // Working
   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject), //Working
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData), // working
   getPlot: () => ipcRenderer.invoke("getPlot"), //Working
   onShowAttributes: (callback) => ipcRenderer.on("show-attributes", (_event, value) => callback(value)), // working
   getCIM: () => ipcRenderer.invoke("getCIM"), // working
   export2CIM: (CIMobjs) => ipcRenderer.send("export2CIM", CIMobjs)
})