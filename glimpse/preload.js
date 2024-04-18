const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   onShowAttributes: (callback) => ipcRenderer.on("show-attributes", (_event, showBool) => callback(showBool)),
   onUpdateData: (callback) => ipcRenderer.on("update-data", (_event, data) => callback(data)),
   onShowVisOptions: (callback) => ipcRenderer.on("show-vis-options", () => callback()),
   onExportTheme: (callback) => ipcRenderer.on("export-theme", () => callback()),
   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath),
   getThemeJsonData: (path) => ipcRenderer.invoke("getThemeJsonData", path),
   exportTheme: (themeData) => ipcRenderer.send("exportTheme", themeData),
   onExtract: (callback) => ipcRenderer.on("extract", () => callback()),
   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject),
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData),
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths),
   getTheme: () => ipcRenderer.invoke("getSelectedTheme"),
   getConfig: () => ipcRenderer.invoke("getConfig"),
   getPlot: () => ipcRenderer.invoke("getPlot")
});