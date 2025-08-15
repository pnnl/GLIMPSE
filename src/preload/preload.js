import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// Custom APIs for renderer
const api = {
   getFilePaths: () => ipcRenderer.invoke("get-file-paths"),
   onShowAttributes: (callback) => {
      ipcRenderer.on("show-attributes", (_, showBool) => callback(showBool));
      return () => ipcRenderer.removeAllListeners("show-attributes");
   },
   onUpdateData: (callback) => {
      ipcRenderer.on("update-data", (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners("update-data");
   },
   onAddNodeEvent: (callback) => {
      ipcRenderer.on("add-node", (_, newNodeData) => callback(newNodeData));
      return () => ipcRenderer.removeAllListeners("add-node");
   },
   onAddEdgeEvent: (callback) => {
      ipcRenderer.on("add-edge", (_, newEdgeData) => callback(newEdgeData));
      return () => ipcRenderer.removeAllListeners("add-edge");
   },
   onDeleteNodeEvent: (callback) => {
      ipcRenderer.on("delete-node", (_, nodeID) => callback(nodeID));
      return () => ipcRenderer.removeAllListeners("delete-node");
   },
   onDeleteEdgeEvent: (callback) => {
      ipcRenderer.on("delete-edge", (_, edgeID) => callback(edgeID));
      return () => ipcRenderer.removeAllListeners("delete-edge");
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
   readJsonFile: (filepath) => ipcRenderer.invoke("read-json-file", filepath),
   getThemeJsonData: (path) => ipcRenderer.invoke("getThemeJsonData", path),
   exportTheme: (themeData) => ipcRenderer.send("exportTheme", themeData),
   onExtract: (callback) => {
      ipcRenderer.on("export-data", () => callback());
      return () => ipcRenderer.removeAllListeners("export-data");
   },
   onGetMetrics: (callback) => {
      ipcRenderer.on("getGraphMetrics", () => callback());
      return () => ipcRenderer.removeAllListeners("getGraphMetrics");
   },
   exportCIM: (CIMobjs) => ipcRenderer.send("exportCIM", CIMobjs),
   updateCimObjAttributes: (updates) => ipcRenderer.send("update-cim-ob-attrs", updates),
   exportCoordinates: (data) => ipcRenderer.send("exportCoordinates", data),
   json2glm: (jsonData) => ipcRenderer.send("json2glm", jsonData),
   glm2json: (paths) => ipcRenderer.invoke("glm2json", paths),
   cimToGS: (paths) => ipcRenderer.invoke("cimToGS", paths),
   getTheme: () => ipcRenderer.invoke("getSelectedTheme"),
   getConfig: () => ipcRenderer.invoke("getConfig"),
   openObjectStudio: (obj) => ipcRenderer.invoke("open-object-studio", obj),
   validateTheme: (jsonFilePath) => ipcRenderer.invoke("validate-theme", jsonFilePath),
   getImgUrl: () => ipcRenderer.invoke("get-img"),
   getEmbeddingsPlot: (callback) => {
      ipcRenderer.on("embeddings_plot", (_, buffer) => callback(buffer));
      return () => ipcRenderer.removeAllListeners("embeddings_plot");
   },
   onLoadObjects: (callback) => {
      ipcRenderer.on("load-objects", (_, graphData) => callback(graphData));
      return () => ipcRenderer.removeAllListeners("load-objects");
   }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
   try {
      contextBridge.exposeInMainWorld("electron", electronAPI);
      contextBridge.exposeInMainWorld("glimpseAPI", api);
   } catch (error) {
      console.error(error);
   }
} else {
   window.Electron = electronAPI;
   window.glimpseAPI = api;
}
