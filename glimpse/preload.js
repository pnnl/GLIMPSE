const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths),

   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath),

   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject),

   getThemeJsonData: (path) => ipcRenderer.invoke("getThemeJsonData", path),

   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData),
   
   getConfig: () => ipcRenderer.invoke("getConfig"),
   
   exportTheme: (themeData) => ipcRenderer.send("exportTheme", themeData),
   
   getPlot: () => ipcRenderer.invoke("getPlot"),
   
   onExportTheme: (callback) => ipcRenderer.on("export-theme", () => callback()),
   
   onShowAttributes: (callback) => ipcRenderer.on("show-attributes", (_event, value) => callback(value)),
   
   getTheme: () => ipcRenderer.invoke("getSelectedTheme"),
   
   onUpdateData: (callback) => ipcRenderer.on("update-data", (_event, data) => callback(data)),
   
   onExtract: (callback) => ipcRenderer.on("extract", () => callback())
});