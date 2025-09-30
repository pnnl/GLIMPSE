const {
   app,
   shell,
   BrowserWindow,
   ipcMain,
   dialog,
   Menu,
   globalShortcut,
   nativeImage,
   Notification
} = require("electron");
const { electronApp, optimizer, is } = require("@electron-toolkit/utils");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const path = require("path");
const Ajv = require("ajv");
const axios = require("axios");
// const log = require('electron-log');
// const { autoUpdater } = require("electron-updater");

const jsonUploadSchema = require("../../schemas/json_upload.schema.json");
const themeUploadSchema = require("../../schemas/theme_upload.schema.json");
const socket = io("http://127.0.0.1:5051");
const isMac = process.platform === "darwin";
let mainWindow = null;
let splashWindow = null;
let studioWindow = null;

//------------------ for debugging ------------------
// autoUpdater.logger = log;
// autoUpdater.logger.transports.file.level = 'info';
// log.info('App starting...');
//---------------------------------------------------
// const sendStatusToWindow = (text) => {
//    console.log(text);
// }
// autoUpdater.on('checking-for-update', () => {
//    sendStatusToWindow('Checking for update...');
// });
// autoUpdater.on('update-available', (info) => {
//    sendStatusToWindow('Update available.');
// });
// autoUpdater.on('update-not-available', (info) => {
//    sendStatusToWindow('Update not available.');
// });
// autoUpdater.on('error', (err) => {
//    sendStatusToWindow('Error in auto-updater. ' + err);
// });
// autoUpdater.on('download-progress', (progressObj) => {
//    let log_message = "Download speed: " + progressObj.bytesPerSecond;
//    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
//    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
//    sendStatusToWindow(log_message);
// });
// autoUpdater.on('update-downloaded', (info) => {
//    sendStatusToWindow('Update downloaded');
// });

const checkIncludes = (jsonData) => {
   const included_files = [];
   const includeS_files = [];

   Object.keys(jsonData).forEach((fileName) => {
      if (jsonData[fileName]["includes"].length === 0) {
         included_files.push(fileName);
      }
   });

   Object.keys(jsonData).forEach((fileName) => {
      if (jsonData[fileName]["includes"].length > 0) {
         jsonData[fileName]["includes"].forEach((include) => {
            includeS_files.push(include.value.split(".")[0] + ".json");
         });
      }
   });

   if (includeS_files.length === 0)
      return true; // add this line
   else if (included_files.sort().toString() !== includeS_files.sort().toString()) return false;
   else return true;
};

const glm2json = async (filePaths) => {
   const resPormise = axios.post("http://127.0.1:5051/glm2json", JSON.stringify(filePaths), {
      headers: { "Content-Type": "application/json" }
   });

   const { status, statusText, data } = await resPormise;

   if (status === 200) {
      const output = data;
      const valid = checkIncludes(output);

      if (!valid) {
         return { alert: "one or more include files are missing!" };
      }
      return output;
   } else {
      console.log(status);
      console.log(statusText);
   }
};

const cimToGS = async (filePaths) => {
   const resPromise = axios.post("http://127.0.0.1:5051/cimg-to-GS", JSON.stringify(filePaths), {
      headers: { "Content-Type": "application/json" }
   });

   try {
      const { status, data } = await resPromise;
      console.log("status: ", status);
      return data;
   } catch (error) {
      console.error("error: ", error);
      return { alert: "Something went wrong with the CIM XML file upload." };
   }
};

const validateThemeFile = (filepath) => {
   const ajv = new Ajv();
   const validate = ajv.compile(themeUploadSchema);
   const themeData = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));
   const valid = validate(themeData);

   if (valid) {
      console.log("custom theme file is valid !!");
      return themeData;
   } else {
      const errorMsg = ajv.errorsText(validate.errors, { dataVar: "jsonData" });
      return { error: errorMsg };
   }
};

const sendPlot = () => {
   const plotFilename = path.join(__dirname, "figs", "plot.png");
   const plotFileData = readFileSync(plotFilename);
   return plotFileData;
};

const validateJson = (filePaths) => {
   const ajv = new Ajv();
   const validator = ajv.compile(jsonUploadSchema);
   const data = {};
   const nodeLinkDataKeys = ["directed", "multigraph", "graph", "nodes", "edges"];
   let valid = true;
   // let edgesKeyName = null;

   for (const filePath of filePaths) {
      const fileData = JSON.parse(readFileSync(filePath, { encoding: "utf-8" }));

      if (nodeLinkDataKeys.every((key) => key in fileData)) {
         data[path.basename(filePath)] = {
            objects: []
         };

         for (const node of fileData.nodes) {
            let objectType = null;

            if ("type" in node && typeof node.type === "object") {
               objectType = node.type.path.join("-");
            } else if ("type" in node) {
               objectType = node.type;
            } else {
               objectType = "node";
            }

            data[path.basename(filePath)].objects.push({
               objectType: objectType,
               elementType: "node",
               attributes: node
            });
         }

         for (const edge of fileData.edges) {
            const { source, target, key, ...rest } = edge;

            data[path.basename(filePath)].objects.push({
               objectType: "type" in edge ? edge.type : "edge",
               elementType: "edge",
               attributes: {
                  id: `${source}-${target}-${key}`,
                  from: source,
                  to: target,
                  ...rest
               }
            });
         }
      } else {
         valid = validator(fileData);
         if (!valid) break;
         else data[path.basename(filePath)] = fileData;
      }
   }

   if (!valid) {
      const errorMessage = ajv.errorsText(validator.errors, { dataVar: "jsonData" });
      return JSON.stringify({ error: errorMessage });
   }

   console.log(`Files: ${filePaths} are valid!`);

   return JSON.stringify(data);
};

const exportThemeFile = async (themeData) => {
   const filename = "custom.theme.json";
   let dir2save = await dialog.showOpenDialog({ properties: ["openDirectory"] });

   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   writeFileSync(path.join(dir2save, filename), themeData);
};

const json2glmFunc = async (jsonData) => {
   // have the user choose where to store the files
   let dir2save = await dialog.showOpenDialog({ properties: ["openDirectory"] });
   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   const parsedData = JSON.parse(jsonData);

   Object.keys(parsedData).forEach((filename) => {
      delete Object.assign(parsedData, {
         [filename.replace(".json", ".glm")]: parsedData[filename]
      })[filename];
   });

   const sendObj = {
      saveDir: dir2save,
      data: parsedData
   };

   const resPromise = axios.post("http://127.0.0.1:5051/json2glm", JSON.stringify(sendObj), {
      headers: { "Content-Type": "application/json" }
   });

   const { status } = await resPromise;
   if (status === 200)
      new Notification({
         title: "Export Notification",
         body: "GLM files saved at: " + dir2save
      }).show();
};

const getFilePaths = async () => {
   const fileSelectionPromise = dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      defaultPath: app.isPackaged
         ? path.join(process.resourcesPath, "data")
         : path.join(__dirname, "..", "..", "data")
   });

   const fileSelection = await fileSelectionPromise;

   if (fileSelection.canceled) return null;

   return fileSelection.filePaths;
};

const exportCIM = async (CIMobjs) => {
   const dialogPromise = dialog.showOpenDialog({ properties: ["openDirectory"] });
   let selectedDir = await dialogPromise;

   if (selectedDir.canceled) return null;
   selectedDir = selectedDir.filePaths[0];

   const cimData2Export = JSON.stringify({
      ...JSON.parse(CIMobjs),
      savepath: selectedDir
   });

   console.log("cimData2Export: ", cimData2Export);

   const resPromise = axios.post("http://127.0.0.1:5051/export-cim", cimData2Export, {
      headers: { "Content-Type": "application/json" }
   });
   const { status, statusText } = await resPromise;

   if (status === 204) {
      console.log(statusText);
      new Notification({
         title: "Export Notification",
         body: "CIM file saved at: " + selectedDir
      }).show();
   }
};

const exportCIMcoordinates = async (data) => {
   console.log(typeof data);
   const fileDialogPromise = dialog.showOpenDialog({ properties: ["openDirectory"] });
   let saveDir = await fileDialogPromise;

   if (saveDir.canceled) return null;
   saveDir = saveDir.filePaths[0];

   data.filepath = path.join(
      saveDir,
      `${path.basename(data.filepath).split(".")[0]}_w_coordinates.xml`
   );

   const responsePromise = axios.post(
      "http://127.0.1:5051/export-cim-coordinates",
      JSON.stringify(data),
      {
         headers: { "Content-Type": "application/json" }
      }
   );

   try {
      const { status, statusText } = await responsePromise;
      console.log(status, statusText);
      new Notification({
         title: "Export Notification",
         body: "CIM file with coordinates saved at: " + saveDir
      }).show();
   } catch (error) {
      console.error(error);
   }
};

const handleUpdateCimObjAttributes = async (updates) => {
   console.log("updates: ", updates);
   const responsePromise = axios.post(
      "http://127.0.0.1:5051/update-cim-attrs",
      JSON.stringify(updates),
      { headers: { "Content-Type": "application/json" } }
   );

   const response = await responsePromise;
   if (response.status === 204) {
      console.log("CIM object attributes updated successfully.");
   } else {
      console.error("Failed to update CIM object attributes:", response.statusText);
   }
};

const makeStudioWindow = (graphData) => {
   studioWindow = new BrowserWindow({
      autoHideMenuBar: true,
      webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
         sandbox: false,
         preload: path.join(__dirname, "..", "preload", "preload.js")
      }
   });

   // Load portal.html
   if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      studioWindow.webContents.openDevTools();
      studioWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/object-studio/studio.html`);
   } else {
      studioWindow.loadFile(path.join(__dirname, "..", "renderer", "object-studio", "studio.html"));
   }

   if (graphData) {
      studioWindow.webContents.on("did-finish-load", () => {
         studioWindow.webContents.send("load-objects", graphData);
      });
   }

   studioWindow.on("close", () => {
      studioWindow = null;
   });
};

const establishIpcHandlers = () => {
   ipcMain.handle("getSelectedTheme", () => {
      const themeMenuItems =
         Menu.getApplicationMenu().getMenuItemById("themes-menu-item").submenu.items;
      let themeMenuItemID = null;

      for (const item of themeMenuItems) {
         if (item.checked) {
            themeMenuItemID = item.id;
            break;
         }
      }

      return themeMenuItemID;
   });

   ipcMain.handle("getConfig", () => {
      let configFilePath = null;

      if (app.isPackaged)
         configFilePath = path.join(process.resourcesPath, "config", "appConfig.json");
      else configFilePath = path.join(__dirname, "..", "..", "config", "appConfig.json");

      return JSON.stringify(require(configFilePath));
   });

   ipcMain.handle("getThemeJsonData", (_, filepath) => {
      let themeFilePath = null;

      if (app.isPackaged) themeFilePath = path.join(process.resourcesPath, "themes", filepath);
      else themeFilePath = path.join(__dirname, "..", "..", "themes", filepath);

      const themeFileData = readFileSync(themeFilePath, { encoding: "utf-8" });
      return JSON.parse(themeFileData);
   });

   ipcMain.handle("get-img", async () => {
      try {
         const fileSelection = await dialog.showOpenDialog({ properties: ["openFiles"] });
         if (fileSelection.canceled) return;

         const fullPath = path.resolve(fileSelection.filePaths[0]);
         const imageBuffer = readFileSync(fullPath);
         const base64Image = imageBuffer.toString("base64");
         const mimeType =
            path.extname(fullPath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
         return `data:${mimeType};base64,${base64Image}`;
      } catch (error) {
         throw new Error(`Failed to load image: ${error.message}`);
      }
   });

   ipcMain.handle("read-json-file", (_, filepath) => {
      const jsonFileData = readFileSync(filepath, { encoding: "utf-8" });
      return JSON.parse(jsonFileData);
   });

   ipcMain.handle("get-file-paths", () => getFilePaths());
   ipcMain.handle("glm2json", (_, paths) => glm2json(paths));
   ipcMain.handle("cimToGS", (_, paths) => cimToGS(paths));
   ipcMain.handle("getPlot", () => sendPlot());
   ipcMain.handle("validate", (_, jsonFilePath) => validateJson(jsonFilePath));
   ipcMain.handle("validate-theme", (_, filepath) => validateThemeFile(filepath));
   ipcMain.handle("open-object-studio", (_, graphData) => {
      if (!studioWindow) makeStudioWindow(graphData);
      else {
         studioWindow.webContents.send("load-objects", graphData);
         studioWindow.show();
      }
   });
   ipcMain.handle("save-studio-changes", (_, changes) =>
      mainWindow.webContents.send("changes-from-studio", changes)
   );
   ipcMain.on("json2glm", (_, jsonData) => json2glmFunc(jsonData));
   ipcMain.on("exportTheme", (_, themeData) => exportThemeFile(themeData));
   ipcMain.on("exportCIM", (_, CimObjs) => exportCIM(CimObjs));
   ipcMain.on("exportCoordinates", (_, data) => exportCIMcoordinates(data));
   ipcMain.on("update-cim-ob-attrs", (_, updates) => handleUpdateCimObjAttributes(updates));
};

const makeWindow = () => {
   mainWindow = new BrowserWindow({
      width: 1500,
      height: 900,
      minWidth: 1250,
      minHeight: 750,
      icon: "../resources/GLIMPSE_color_icon.ico",
      backgroundColor: "white",
      autoHideMenuBar: false,
      show: false,
      webPreferences: {
         webgl: true,
         sandbox: false,
         nodeIntegration: false,
         contextIsolation: true,
         enableRemoteModule: false,
         preload: path.join(__dirname, "..", "preload", "preload.js")
      }
   });

   mainWindow.webContents.on("will-navigate", (event, url) => {
      event.preventDefault(); // Prevent the Electron app from navigating
      shell.openExternal(url); // Open the URL in the default browser
   });

   mainWindow.setIcon(
      nativeImage.createFromPath(path.join(__dirname, "assets", "GLIMPSE_color_icon.ico"))
   );

   const menu = Menu.buildFromTemplate([
      {
         label: "File",
         submenu: [
            isMac ? { role: "close" } : { role: "quit" },
            {
               label: "Export",
               click: () => mainWindow.webContents.send("export-data")
            }
         ]
      },
      {
         label: "Window",
         submenu: [
            { role: "minimize" },
            { role: "zoom" },
            ...(isMac
               ? [
                    { type: "separator" },
                    { role: "front" },
                    { type: "separator" },
                    { role: "window" }
                 ]
               : [{ role: "close" }])
         ]
      },
      {
         label: "View",
         submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" }
         ]
      },
      {
         label: "Themes",
         id: "themes-menu-item",
         submenu: [
            {
               label: "Export Theme File",
               type: "normal",
               click: () => mainWindow.webContents.send("export-theme")
            },
            { type: "separator" },
            {
               label: "Power Grid [default]",
               id: "power-grid-theme",
               type: "radio",
               checked: true
            },
            {
               label: "Custom",
               id: "custom-theme",
               type: "radio"
            }
         ]
      },
      {
         label: "Graph View",
         submenu: [
            {
               label: "Filter Attributes",
               click: () => mainWindow.webContents.send("filter-attributes", true)
            },
            {
               label: "Show Attributes",
               click: () => mainWindow.webContents.send("show-attributes", true)
            },
            {
               label: "Hide Attributes",
               click: () => mainWindow.webContents.send("show-attributes", false)
            }
         ]
      },
      {
         label: "Tools",
         submenu: [
            {
               label: "Graph Metrics",
               click: () => mainWindow.webContents.send("getGraphMetrics")
            }
         ]
      }
   ]);

   Menu.setApplicationMenu(menu);

   establishIpcHandlers();

   mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
   });

   // HMR for renderer base on electron-vite cli.
   // Load the remote URL for development or the local html file for production.
   if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
   } else {
      mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
   }
};

const makeSplashWindow = () => {
   splashWindow = new BrowserWindow({
      width: 500,
      height: 300,
      backgroundColor: "white",
      frame: false,
      alwaysOnTop: false,
      resizable: false,
      movable: true,
      show: false,
      roundedCorners: true,
      icon: path.join(__dirname, "..", "..", "resources", "GLIMPSE_color_icon.ico")
   });

   splashWindow.loadFile(path.join(__dirname, "..", "..", "splash_window", "splash-window.html"));
   splashWindow.webContents.on("did-finish-load", () => splashWindow.show());
   splashWindow.center();
};

const initiateServer = () => {
   let serverProcess = null;
   let serverExecutablePath = null;
   const serverExecutableName =
      process.platform === "linux" || process.platform === "darwin" ? "server" : "server.exe";

   if (app.isPackaged)
      serverExecutablePath = path.join(
         process.resourcesPath,
         "local-server",
         "server",
         serverExecutableName
      );
   else
      serverExecutablePath = path.join(
         __dirname,
         "..",
         "..",
         "local-server",
         "server",
         serverExecutableName
      );

   if (existsSync(serverExecutablePath)) {
      serverProcess = spawn(serverExecutablePath);
      serverProcess.stdout.on("data", (data) => {
         console.log(data.toString("utf8"));
      });
      serverProcess.stderr.on("data", (data) => {
         console.error(`Server error: ${data}`);
      });
   } else {
      serverProcess = spawn("python", [
         path.join(__dirname, "..", "..", "local-server", "server_2.py")
      ]);
      serverProcess.stdout.on("data", (data) => {
         console.log("data: ", data.toString("utf8"));
         // console.log("data: ", data);
      });
      serverProcess.stderr.on("data", (data) => {
         console.log(`log: ${data}`); // when error
      });
   }

   app.on("before-quit", () => {
      if (serverProcess) {
         serverProcess.kill();
         serverProcess = null;
      }
   });
};

app.whenReady().then(() => {
   makeSplashWindow();
   globalShortcut.register("ctrl+p", () => mainWindow.webContents.send("show-vis-options"));
   initiateServer();

   app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
   });

   socket.on("connect", () => {
      console.log("connected to socket server!!");
      splashWindow.close();
      makeWindow();
      mainWindow.show();
   });

   socket.on("update-data", (data) => mainWindow.webContents.send("update-data", data));
   socket.on("add-node", (data) => mainWindow.webContents.send("add-node", data));
   socket.on("add-edge", (data) => mainWindow.webContents.send("add-edge", data));
   socket.on("delete-node", (nodeID) => mainWindow.webContents.send("delete-node", nodeID));
   socket.on("delete-edge", (edgeID) => mainWindow.webContents.send("delete-edge", edgeID));

   // autoUpdater.checkForUpdatesAndNotify();
   app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
         makeWindow();
         mainWindow.show();
      }
   });
});

// app.on("before-quit", () => kill(process.pid));

app.on("window-all-closed", () => {
   app.quit();
});
