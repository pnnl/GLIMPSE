const { contextBridge, ipcRenderer } = require("electron");

// endpoints to be used as API for communication between the renderer process and main process
contextBridge.exposeInMainWorld("glimpseAPI", {
   onShowAttributes: (callback) => {
      ipcRenderer.on("show-attributes", (_event, showBool) => callback(showBool));
      return () => ipcRenderer.removeAllListeners("show-attributes");
   },

   onUpdateData: (callback) => {
      ipcRenderer.on("update-data", (_event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners("update-data");
   },

   onShowVisOptions: (callback) => {
      ipcRenderer.on("show-vis-options", () => callback());
      return () => ipcRenderer.removeAllListeners("show-vis-options");
   },

   onExportTheme: (callback) => {
      ipcRenderer.on("export-theme", () => callback());
      return () => ipcRenderer.removeAllListeners("export-theme");
   },

   validate: (jsonFilePath) => ipcRenderer.invoke("validate", jsonFilePath),
   getThemeJsonData: (path) => ipcRenderer.invoke("getThemeJsonData", path),
   exportTheme: (themeData) => ipcRenderer.send("exportTheme", themeData),

   onExtract: (callback) => {
      ipcRenderer.on("extract", () => callback());
      return () => ipcRenderer.removeAllListeners("extract");
   },

   onGetMetrics: (callback) => {
      ipcRenderer.on("getGraphMetrics", () => callback());
      return () => ipcRenderer.removeAllListeners("getMetrics");
   },

   getStats: (dataObject) => ipcRenderer.invoke("getStats", dataObject),
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData),
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths),
   getTheme: () => ipcRenderer.invoke("getSelectedTheme"),
   getConfig: () => ipcRenderer.invoke("getConfig"),

   getEmbeddingsPlot: (callback) => {
      ipcRenderer.on("embeddings_plot", (e, buffer) => callback(buffer))
      return () => ipcRenderer.removeAllListeners("embeddings_plot");
   }
});