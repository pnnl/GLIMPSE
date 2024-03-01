const {
   app,
   BrowserWindow,
   ipcMain,
   dialog,
   Menu,
} = require("electron");
const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const Ajv = require("ajv");
const jsonSchema = require("./upload.schema.json");

require("electron-reload")(__dirname, {
   electron: path.join(__dirname, "node_modules", ".bin", "electron")
});

const isMac = process.platform === "darwin";

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

const createJsonFile = (filename, data) => {
   fs.writeFileSync(filename, data);
}

const readJsonFile = (filepath) => {
   return fs.readFileSync(filepath).toString();
}

const getGraphStats = async (data) => {
   console.log(typeof data);
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
   const validate = ajv.compile(jsonSchema);
   const data = {};
   const nodeLinkDataKeys = ["directed", "multigraph", "graph", "nodes", "edges"];
   let valid = true;

   for (const filePath of filePaths) {
      const fileData = JSON.parse(fs.readFileSync(filePath).toString());
      
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

   return JSON.stringify(data);
}

const exportThemeFile = async (themeData) => {
   const filename = "GLIMPSE_theme_export.json";
   let dir2save = await dialog.showOpenDialog({"properties": ["openDirectory"]});

   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   console.log(dir2save);

   console.log(themeData);

   createJsonFile(path.join(dir2save, filename), themeData);   
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
      const args = `${json2glmArg} --path-to-file ${path.join(dir2save, file)} >> ${path.join(dir2save, newFilename)}`;

      createJsonFile(path.join(dir2save, file), JSON.stringify(parsedData[file]));
      execSync(args);
      fs.rmSync(path.join(dir2save, file));
   }
}

const makeWindow = () => {
   const win = new BrowserWindow({
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
            isMac ? {role: "close"} : {role: "quit"}
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
   ipcMain.handle("glm2json", (e, paths) => glm2json(paths));
   ipcMain.handle("getStats", (e, dataObject) => getGraphStats(dataObject));
   ipcMain.handle("getPlot", () => sendPlot());
   ipcMain.handle("validate", (e, jsonFilePath) => validateJson(jsonFilePath));
   ipcMain.handle("getCIM", () => cimGraphData);
   ipcMain.handle("getJsonData", (e, path) => readJsonFile(path));
   ipcMain.on("json2glm", (e, jsonData) => json2glmFunc(jsonData));
   ipcMain.on("exportTheme", (e, themeData) => exportThemeFile(themeData));

   win.loadFile("./renderer/public/index.html");

   
   const python = spawn('py', ['./local-server/server.py']);
   python.stdout.on('data', function (data) {
      console.log("data: ", data.toString('utf8'));
   });

   python.stderr.on('data', (data) => {
      console.log(`log: ${data}`); // when error
   });

   win.show();
}

app.whenReady().then(() => {
   makeWindow();
});

app.on('window-all-closed', () => {
   if (process.platform !== 'darwin') {
      app.quit();
   }
});

app.on('activate', () => {
   // On macOS it's common to re-create a window in the app when the
   // dock icon is clicked and there are no other windows open.
   if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
   }
});