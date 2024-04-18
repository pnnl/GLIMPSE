const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   getPlot: () => ipcRenderer.invoke("getPlot"),
   getConfig: () => ipcRenderer.invoke("getConfig"),
   getTheme: () => ipcRenderer.invoke("getSelectedTheme"),
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths),
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData),
   export2CIM: (CIMobjs) => ipcRenderer.send("export2CIM", CIMobjs),
   getCIM: (cimFilepath) => ipcRenderer.invoke("getCIM", cimFilepath),
   onExtract: (callback) => ipcRenderer.on("extract", () => callback()),
   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject),
   exportTheme: (themeData) => ipcRenderer.send("exportTheme", themeData),
   getThemeJsonData: (path) => ipcRenderer.invoke("getThemeJsonData", path),
   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath),
   onExportTheme: (callback) => ipcRenderer.on("export-theme", () => callback()),
   onShowVisOptions: (callback) => ipcRenderer.on("show-vis-options", () => callback()),
   onUpdateData: (callback) => ipcRenderer.on("update-data", (_event, data) => callback(data)),
   onShowAttributes: (callback) => ipcRenderer.on("show-attributes", (_event, value) => callback(value))
});