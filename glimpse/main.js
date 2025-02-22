const {
   app,
   BrowserWindow,
   ipcMain,
   dialog,
   Menu,
   globalShortcut,
   nativeImage,
   Notification,
} = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const { io } = require("socket.io-client");
const fs = require("fs");
const Ajv = require("ajv");
// const kill = require("tree-kill");
// const log = require('electron-log');
// const { autoUpdater } = require("electron-updater");

if (!app.isPackaged) {
   require("electron-reload")(__dirname, {
      electron: path.join(__dirname, "node_modules", ".bin", "electron"),
   });
}

const jsonUploadSchema = require("./schemas/json_upload.schema.json");
const themeUploadSchema = require("./schemas/theme_upload.schema.json");
// const { kill } = require("process");
const socket = io("http://127.0.0.1:5051");
const isMac = process.platform === "darwin";
let mainWindow = null;
let splashWindow = null;
let rootDir = __dirname;

if (app.isPackaged) rootDir = process.resourcesPath;

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

   if (includeS_files.length === 0) return true; // add this line
   else if (included_files.sort().toString() !== includeS_files.sort().toString()) return false;
   else return true;
};

const glm2json = async (filePaths) => {
   const res = await fetch("http://127.0.0.1:5051/glm2json", {
      method: "POST",
      headers: {
         "content-type": "application/json",
      },
      body: JSON.stringify(filePaths),
   });

   if (res.ok) {
      const output = await res.json();
      const valid = checkIncludes(output);

      if (!valid) {
         return { alert: "One or more include files are missing!" };
      }
      return output;
   } else {
      console.log(res.status);
      console.log(res);
   }
};

const validateThemeFile = (filepath) => {
   const ajv = new Ajv();
   const validate = ajv.compile(themeUploadSchema);
   const themeData = JSON.parse(fs.readFileSync(filepath, { encoding: "utf-8" }));
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
   const plotFileData = fs.readFileSync(plotFilename);
   return plotFileData;
};

const validateJson = (filePaths) => {
   const ajv = new Ajv();
   const validate = ajv.compile(jsonUploadSchema);
   const data = {};
   const nodeLinkDataKeys = ["directed", "multigraph", "graph", "nodes", "edges"];
   let valid = true;
   // let edgesKeyName = null;

   for (const filePath of filePaths) {
      const fileData = JSON.parse(fs.readFileSync(filePath, { encoding: "utf-8" }));

      if (nodeLinkDataKeys.every((key) => key in fileData)) {
         data[path.basename(filePath)] = {
            objects: [],
         };

         for (const node of fileData.nodes) {
            let objectType = null;

            if ("type" in node && typeof node.type === "object") {
               objectType = node.type.join("-");
            } else if ("type" in node) {
               objectType = node.type;
            } else {
               objectType = "node";
            }

            data[path.basename(filePath)].objects.push({
               objectType: objectType,
               elementType: "node",
               attributes: node,
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
                  ...rest,
               },
            });
         }
      } else {
         valid = validate(fileData);
         if (!valid) break;
         else data[path.basename(filePath)] = fileData;
      }
   }

   if (!valid) {
      const errorMessage = ajv.errorsText(validate.errors, { dataVar: "jsonData" });
      return JSON.stringify({ error: errorMessage });
   }

   console.log("Upload is valid !!");

   return JSON.stringify(data);
};

const exportThemeFile = async (themeData) => {
   const filename = "custom.theme.json";
   let dir2save = await dialog.showOpenDialog({ properties: ["openDirectory"] });

   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   fs.writeFileSync(path.join(dir2save, filename), themeData);
};

const json2glmFunc = async (jsonData) => {
   // have the user choose where to store the files
   let dir2save = await dialog.showOpenDialog({ properties: ["openDirectory"] });
   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   const parsedData = JSON.parse(jsonData);

   Object.keys(parsedData).forEach((filename) => {
      delete Object.assign(parsedData, {
         [filename.replace(".json", ".glm")]: parsedData[filename],
      })[filename];
   });

   const sendObj = {
      saveDir: dir2save,
      data: parsedData,
   };

   const res = await fetch("http://127.0.0.1:5051/json2glm", {
      method: "POST",
      headers: {
         "content-type": "application/json",
      },
      body: JSON.stringify(sendObj),
   });

   if (res.ok)
      new Notification({
         title: "Export Notification",
         body: "GLM files saved at: " + dir2save,
      }).show();
};

const makeWindow = () => {
   mainWindow = new BrowserWindow({
      width: 1500,
      height: 900,
      minWidth: 1250,
      minHeight: 750,
      icon: "./assets/GLIMPSE_color_icon.ico",
      backgroundColor: "white",
      autoHideMenuBar: false,
      show: false,
      webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
         enableRemoteModule: false,
         preload: path.join(__dirname, "preload.js"),
      },
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
               click: () => mainWindow.webContents.send("extract"),
            },
         ],
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
                    { role: "window" },
                 ]
               : [{ role: "close" }]),
         ],
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
            { role: "togglefullscreen" },
         ],
      },
      {
         label: "Themes",
         id: "themes-menu-item",
         submenu: [
            {
               label: "Export Theme File",
               type: "normal",
               click: () => mainWindow.webContents.send("export-theme"),
            },
            { type: "separator" },
            {
               label: "Power Grid [default]",
               id: "power-grid-theme",
               type: "radio",
               checked: true,
            },
            {
               label: "Custom",
               id: "custom-theme",
               type: "radio",
            },
         ],
      },
      {
         label: "Graph View",
         submenu: [
            {
               label: "show attributes",
               click: () => mainWindow.webContents.send("show-attributes", true),
            },
            {
               label: "hide attributes",
               click: () => mainWindow.webContents.send("show-attributes", false),
            },
         ],
      },
      {
         label: "Tools",
         submenu: [
            {
               label: "Embeddings",
               click: () => mainWindow.webContents.send("embeddings_plot", sendPlot()),
            },
            {
               label: "Graph Metrics",
               click: () => mainWindow.webContents.send("getGraphMetrics"),
            },
         ],
      },
   ]);

   Menu.setApplicationMenu(menu);

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
      const configFilepath = path.join(rootDir, "config", "appConfig.json");
      const configFileContent = fs.readFileSync(configFilepath, { encoding: "utf-8" });
      return configFileContent;
   });

   ipcMain.handle("glm2json", (e, paths) => glm2json(paths));

   ipcMain.handle("getPlot", () => sendPlot());

   ipcMain.handle("validate", (e, jsonFilePath) => validateJson(jsonFilePath));

   ipcMain.handle("getThemeJsonData", (e, filepath) => {
      const themeFilepath = path.join(rootDir, "themes", filepath);
      const themeFileData = fs.readFileSync(themeFilepath, { encoding: "utf-8" });
      return JSON.parse(themeFileData);
   });

   ipcMain.handle("read-json-file", (e, filepath) => {
      const jsonFileData = fs.readFileSync(filepath, { encoding: "utf-8" });
      return JSON.parse(jsonFileData);
   });
   ipcMain.handle("validate-theme", (e, filepath) => validateThemeFile(filepath));

   ipcMain.on("json2glm", (e, jsonData) => json2glmFunc(jsonData));

   ipcMain.on("exportTheme", (e, themeData) => exportThemeFile(themeData));

   mainWindow.loadFile(path.join(__dirname, "renderer", "public", "index.html"));
};

const makeSplashWindow = () => {
   splashWindow = new BrowserWindow({
      width: 500,
      height: 300,
      backgroundColor: "white",
      transparent: true,
      frame: false,
      alwaysOnTop: false,
      resizable: false,
      movable: true,
      roundedCorners: true,
      icon: path.join(__dirname, "assets", "GLIMPSE_color_icon.ico"),
   });

   splashWindow.loadFile(path.join(__dirname, "splash_window", "splash-window.html"));
   splashWindow.center();
};

const initiateServer = () => {
   let serverProcess = null;
   const serverExecutableName =
      process.platform === "linux" || process.platform === "darwin" ? "server" : "server.exe";

   const serverExecutablePath = path.join(rootDir, "local-server", "server", serverExecutableName);

   if (fs.existsSync(serverExecutablePath)) {
      serverProcess = spawn(serverExecutablePath);
      serverProcess.stdout.on("data", (data) => {
         console.log(data.toString("utf8"));
      });
      serverProcess.stderr.on("data", (data) => {
         console.error(`Server error: ${data}`);
      });
   } else {
      serverProcess = spawn("python", [path.join(__dirname, "local-server", "server.py")]);
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
         serverProcess.kill("SIGTERM");
         serverProcess = null;
      }
   });
};

app.whenReady()
   .then(() => {
      makeSplashWindow();
      globalShortcut.register("ctrl+p", () => mainWindow.webContents.send("show-vis-options"));
      initiateServer();
   })
   .then(() => {
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

app.on("activate", () => {
   // On macOS it's common to re-create a window in the app when the
   // dock icon is clicked and there are no other windows open.
   if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
   }
});
