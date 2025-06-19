import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
// Custom APIs for renderer
const api = {
  getFilePaths: () => ipcRenderer.invoke('get-file-paths'),
  getFilePathsSet: (set) => ipcRenderer.invoke('get-file-paths-set', set),
  getDefaultModelFiles: () => ipcRenderer.invoke('getDefaultModelFiles'),
  onShowAttributes: (callback) => {
    ipcRenderer.on('show-attributes', (_event, showBool) => callback(showBool));
    return () => ipcRenderer.removeAllListeners('show-attributes');
  },
  onUpdateData: (callback) => {
    ipcRenderer.on('update-data', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('update-data');
  },
  onRenderComponent: (callback) => {
    ipcRenderer.on('render-component', (_, componentData) => callback(componentData));
    return () => ipcRenderer.removeListener('render-component');
  },
  onAddNodeEvent: (callback) => {
    ipcRenderer.on('add-node', (_event, newNodeData) => callback(newNodeData));
    return () => ipcRenderer.removeAllListeners('add-node');
  },
  onAddEdgeEvent: (callback) => {
    ipcRenderer.on('add-edge', (_event, newEdgeData) => callback(newEdgeData));
    return () => ipcRenderer.removeAllListeners('add-edge');
  },
  onDeleteNodeEvent: (callback) => {
    ipcRenderer.on('delete-node', (_event, nodeID) => callback(nodeID));
    return () => ipcRenderer.removeAllListeners('delete-node');
  },
  onDeleteEdgeEvent: (callback) => {
    ipcRenderer.on('delete-edge', (_event, edgeID) => callback(edgeID));
    return () => ipcRenderer.removeAllListeners('delete-edge');
  },
  onUpdateWatchItem: (callback) => {
    ipcRenderer.on('update-watch-item', (_, watchUpdateData) => {
      console.log(watchUpdateData);
      callback(watchUpdateData);
    });
    return () => ipcRenderer.removeAllListeners('update-watch-item');
  },
  onShowVisOptions: (callback) => {
    ipcRenderer.on('show-vis-options', () => callback());
    return () => ipcRenderer.removeAllListeners('show-vis-options');
  },
  onExportTheme: (callback) => {
    ipcRenderer.on('export-theme', () => callback());
    return () => ipcRenderer.removeAllListeners('export-theme');
  },
  openPortalWindow: (componentData) => ipcRenderer.send('open-portal-window', componentData),
  validate: (jsonFilePath) => ipcRenderer.invoke('validate', jsonFilePath),
  onReadJsonFile: (filepath) => ipcRenderer.invoke('read-json-file', filepath),
  getThemeJsonData: (path) => ipcRenderer.invoke('get-theme-data', path),
  exportTheme: (themeData) => ipcRenderer.send('export-theme', themeData),
  onExtract: (callback) => {
    ipcRenderer.on('extract', () => callback());
    return () => ipcRenderer.removeAllListeners('extract');
  },
  onGetMetrics: (callback) => {
    ipcRenderer.on('get-graph-metrics', () => callback());
    return () => ipcRenderer.removeAllListeners('get-graph-metrics');
  },
  json2glm: (jsonData) => ipcRenderer.send('json2glm', jsonData),
  glm2json: (paths) => ipcRenderer.invoke('glm2json', paths),
  cimToGS: (paths) => ipcRenderer.invoke('cim2GS', paths),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  validateTheme: (jsonFilePath) => ipcRenderer.invoke('validate-theme', jsonFilePath),
  getEmbeddingsPlot: (callback) => {
    ipcRenderer.on('embeddings-plot', (e, buffer) => callback(buffer));
    return () => ipcRenderer.removeAllListeners('embedding-plot');
  },
  sendNatigConfig: (config) => ipcRenderer.send('send-natig-config', config)
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('glimpseAPI', api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.Electron = electronAPI;
  window.glimpseAPI = api;
}
