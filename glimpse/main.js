const {
   app,
   BrowserWindow,
   ipcMain,
   dialog,
   Menu,
   globalShortcut
} = require("electron");
const { execSync, spawn, execFile } = require("child_process");
const path = require("path");
const { io } = require("socket.io-client");
const fs = require("fs");
const Ajv = require("ajv");
require("electron-reload")(__dirname, {
   electron: path.join(__dirname, "node_modules", ".bin", "electron")
});
const jsonSchema = fs.readFileSync(path.join(__dirname,"upload.schema.json"), {"encoding": "utf-8"});
const socket = io("http://127.0.0.1:5000");
const isMac = process.platform === "darwin";

const rootDir = __dirname;
// const rootDir = process.resourcesPath;

let win = null;

const checkIncludes = ( jsonData ) => {
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
}

const glm2json = async (filePaths) => {
   const res = await fetch("http://127.0.0.1:5000/glm2json", {
      method: "POST",
      headers: {
         "content-type": "application/json"
      },
      body: JSON.stringify(filePaths)
   });

   if (res.ok) {
      const output = await res.json();

      const valid = checkIncludes(output);
      if (!valid) {
         return {"alert": "One or more include files are missing!"};
      }
      return output;
   }
}

const readThemeFile = (filepath) => {
   return fs.readFileSync(path.join(rootDir, "themes", filepath), {encoding: "utf-8"});
}

const export2cim = async (CIMobjs) => {
   let dir2save = await dialog.showOpenDialog({"properties": ["openDirectory"]});

   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   const res = await fetch("http://127.0.0.1:5000/add2cim", {
      method: "POST",
      headers: {
         "content-type": "application/json"
      },
      body: JSON.stringify({savepath: dir2save, data: CIMobjs})
   });

   if (res.ok) {
      console.log(res.ok);
   }
}

const exportThemeFile = async (themeData) => {
   const filename = "GLIMPSE_theme_export.json";
   let dir2save = await dialog.showOpenDialog({"properties": ["openDirectory"]});

   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   console.log(dir2save);

   fs.writeFileSync(path.join(dir2save, filename), JSON.stringify(themeData, null, 3));   
}

const getGraphStats = async (data) => {
   const res = await fetch("http://127.0.0.1:5000/getstats", {
      method: "POST",
      headers: {
         "content-type": "application/json"
      },
      body: data
   });

   if (res.ok) {
      return await res.json();
   }
}

const sendPlot = () => {
   return fs.readFileSync(path.join(__dirname, "figs", "plot.png"));
}

const validateJson = (filePaths) => {
   const ajv = new Ajv();
   const validate = ajv.compile(JSON.parse(jsonSchema));
   const data = {};
   const nodeLinkDataKeys = ["directed", "multigraph", "graph", "nodes", "edges"];
   let valid = true;

   for (const filePath of filePaths) {
      const fileData = JSON.parse(fs.readFileSync(filePath, {"encoding":"utf-8"}));
      
      if (nodeLinkDataKeys.every(key => key in fileData)) {
         data[path.basename(filePath)] = {
            "objects": []
         };

         for (const node of fileData.nodes) {
            data[path.basename(filePath)].objects.push({
               "objectType": node.type,
               "elementType": "node",
               "attributes": node
            });
         }

         for (const edge of fileData.edges) {
            const {source, target, key, ...rest} = edge;

            data[path.basename(filePath)].objects.push({
               "objectType": edge.type,
               "elementType": "edge",
               "attributes":{
                  "id": `${source}-${target}-${key}`,
                  "from": source,
                  "to": target,
                  ...rest
               }
            });
         }
      }
      else {
         valid = validate(fileData);
         if (!valid)
            break;
         else
            data[path.basename(filePath)] = fileData;
      }
   }

   if (!valid) {
      const errorMessage = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
      return {"error": errorMessage};
   }

   return data;
}

const json2glmFunc = async (jsonData) => {
   // have the user choose where to store the files
   let dir2save = await dialog.showOpenDialog({"properties": ["openDirectory"]});
   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   console.log(dir2save);

   const parsedData = JSON.parse(jsonData);
   const json2glmArg = process.platform == "darwin" ? "json2glm" : "json2glm.exe";
   
   // for each json file data, make a json file and turn it to a glm file
   for (const file of Object.keys(parsedData)) {
      const newFilename = file.split(".")[0] + ".glm";
      const args = `${json2glmArg} --path-to-file ${path.join(dir2save, file)} > ${path.join(dir2save, newFilename)}`;

      fs.writeFileSync(path.join(dir2save, file), JSON.stringify(parsedData[file], null, 3));
      execSync(args);
      fs.rmSync(path.join(dir2save, file));
   }
}

const getCIM = async (filepath) => {
   const res = await fetch("http://127.0.0.1:5000/getcim", {
      method: "POST",
      headers: {
         "content-type": "application/json"
      },
      body: JSON.stringify([filepath])
   });

   if (res.ok) {
      return await res.json();
   }
   else {
      console.log(res.text())
   }
}

const makeWindow = () => {
   win = new BrowserWindow({
      width: 1500,
      height: 900,
      minWidth: 1250,
      minHeight: 750,
      backgroundColor: "white",
      autoHideMenuBar: false,
      show: false,
      webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
         enableRemoteModule: false,
         preload: path.join(__dirname, 'preload.js')
      }
   });


   const menu = Menu.buildFromTemplate([
      {
         label: "File",
         "submenu": [
            isMac ? {role: "close"} : {role: "quit"},
            {
               label: "Export",
               click: () => win.webContents.send("extract")
            }
         ]
      },
      {
         label: 'Window',
         submenu: [
           { role: 'minimize' },
           { role: 'zoom' },
           ...(isMac ? [
               { type: 'separator' },
               { role: 'front' },
               { type: 'separator' },
               { role: 'window' }
            ]
            : [
               { role: 'close' }
            ])
         ]
      },
      {
         label: 'View',
         submenu: [
           { role: 'reload' },
           { role: 'forceReload' },
           { role: 'toggleDevTools' },
           { type: 'separator' },
           { role: 'resetZoom' },
           { role: 'zoomIn' },
           { role: 'zoomOut' },
           { type: 'separator' },
           { role: 'togglefullscreen' }
         ]
      },
      {
         label: "Themes",
         id: "themes-menu-item",
         "submenu": [
            {
               label: "Export Theme File",
               type: "normal",
               click: () => win.webContents.send("export-theme")
            },
            {type: "separator"},
            {
               label: "Power Grid [default]",
               id: "power-grid-theme",
               type: "radio",
               checked: true,
            },
            {
               label: "Social",
               id: "social-theme",
               type: "radio",
            },
            {
               label: "Layout",
               id: "layout-theme",
               type: "radio",
            },
            {
               label: "Fishing",
               id: "fishing-theme",
               type: "radio",
            },
            {
               label: "CIM",
               id: "cim-theme",
               type: "radio",
            }
         ]
      },
      {
         label: "Graph View",
         submenu: [
            {
               label: "show attributes",
               click: () => win.webContents.send("show-attributes", true)
            },
            {
               label: "hide attributes",
               click: () => win.webContents.send("show-attributes", false)
            }
         ]
      }
   ]);

   Menu.setApplicationMenu(menu);

   ipcMain.handle("getSelectedTheme", () => {
      for (const item of Menu.getApplicationMenu().getMenuItemById("themes-menu-item").submenu.items)
         if (item.checked)
            return item.id;
   });
   ipcMain.handle("getConfig", () => {
      return fs.readFileSync(path.join(rootDir, "config", "appConfig.json"), {"encoding": "utf-8"});
   });
   ipcMain.handle("glm2json", (event, paths) => glm2json(paths));
   ipcMain.handle("getStats", (event, dataObject) => getGraphStats(dataObject));
   ipcMain.handle("getPlot", () => sendPlot());
   ipcMain.handle("validate", (event, jsonFilePath) => validateJson(jsonFilePath));
   ipcMain.handle("getCIM", (event, cimFilePath) => getCIM(cimFilePath));
   ipcMain.handle("getThemeJsonData", (e, path) => readThemeFile(path));
   ipcMain.on("json2glm", (event, jsonData) => json2glmFunc(jsonData));
   ipcMain.on("exportTheme", (e, themeData) => exportThemeFile(themeData));
   ipcMain.on("export2CIM", (event, CIMobjs) => export2cim(CIMobjs));

   // Connect to WebSocket
   socket.on("connect", () => console.log("Connected to socket server"));
   socket.on("update-data", (data) => win.webContents.send("update-data", data));

   win.loadFile("./renderer/public/index.html");
   win.show();
}

const initiateServer = () => {
   const serverPath = path.join(__dirname, "local-server", "dist", "server.exe");
   if (fs.existsSync(serverPath)) {
      execFile(serverPath, (error, stdout, stderr) => {
         if (error) {
            throw error;
         }
         console.log(stdout);
      });
   }
   else {
      const python = spawn('python', ['./local-server/server.py']);
      python.stdout.on('data', function (data) {
         console.log("data: ", data.toString('utf8'));
      });

      python.stderr.on('data', (data) => {
         console.log(`log: ${data}`); // when error
      });
   }
}

app.whenReady().then(() => {
   globalShortcut.register("ctrl+p", () => win.webContents.send("show-vis-options"));
   initiateServer();
}).then(() => {
   // autoUpdater.checkForUpdatesAndNotify();
   makeWindow();

   app.on("before-quit", () => {
      kill(process.pid);
   });

   app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
         makeWindow();
      }
   });
});

app.on('window-all-closed', () => {
   if (process.platform !== 'darwin') {
      app.quit()
   }
});