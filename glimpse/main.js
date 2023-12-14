const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawnSync, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const Ajv = require("ajv");
const jsonSchema = require("./upload.schema.json");
const isDev = process.env.NODE_ENV !== "development";
if (require("electron-squirrel-startup")) app.quit();

// require("electron-reload")(__dirname, {
//    electron: path.join(__dirname, "node_modules", ".bin", "electron")
// });

const makeWindow = () => {
   const win = new BrowserWindow({
      width: 1500,
      height: 750,
      backgroundColor: "white",
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
         preload: path.join(__dirname, 'preload.js')
      }
   })

   if(isDev) {
      win.webContents.openDevTools();
   }
   win.loadFile("./renderer/public/index.html");
   win.show()
}

const checkIncludes = ( jsonData ) => {
   const included_files = [];
   const includeS_files = [];

   Object.keys(jsonData).forEach((fileName) => {
      if (jsonData[fileName]["includes"].length === 0) {
         included_files.push(fileName);
      }
   });

   Object.keys(jsonData).forEach((fileName) => {

      if (jsonData[fileName]["includes"].length > 0) 
      {
         jsonData[fileName]["includes"].forEach((include) => {
            includeS_files.push(include.value.split(".")[0] + ".json");
         });
      }
   });

   if (included_files.sort().toString() !== includeS_files.sort().toString()) {
      return false;
   }
   else {
      return true;
   }
}

const handleFileOpen = (filePaths) => {

   const args = ["./py/glm2json.py"]
   for (const filePath of filePaths) {
      args.push(filePath);
   }

   const {error, stdout} = spawnSync("python", args);

   if(error) {
      console.log(stderr.toString());
      return;
   }

   // Will return an alert message if include files are missing
   // otherwise it will return the output as a string
   const valid = checkIncludes(JSON.parse(stdout.toString()))
   if (!valid) return {"alert": "One or more include files are missing!"};
   else return stdout.toString();
}

const createJsonFile = (filename, data) => {
   fs.writeFileSync(filename, data, (err) => {
      if (err) {
         console.log(err);
      } else {
         console.log('File written successfully.');
      }
   });
}

const getGraphStats = async (data) => {
   createJsonFile(path.join(__dirname, "glm2jsonData.json"), data);

   const args = [path.join(__dirname, "py", "nx.py"), path.join(__dirname, "glm2jsonData.json")];
   const  { stdout, error } = spawnSync("python", args);

   if (error)
      console.log(error)
   else {
      fs.rmSync(path.join(__dirname, "glm2jsonData.json"))
      return stdout.toString();
   }
}

const sendPlot = () => {
   // Returns an image buffer
   return fs.readFileSync(path.join(__dirname, "figs", "plot.png"));
}

const validateJson = (filePaths) => {
   const ajv = new Ajv();
   const validate = ajv.compile(jsonSchema);
   const data = {};
   let valid = true;

   for (const filePath of filePaths) {
      const fileData = require(filePath);
      valid = validate(fileData);

      if (!valid) break;
      else data[path.basename(filePath)] = fileData;
   }

   if(!valid) {
      const errorMessage = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
      return {"error": errorMessage};
   }

   return JSON.stringify(data);
}

const json2glmFunc = async (jsonData) => {
   let newFilename;
   let args;
   // have the user choose where to store the files
   let dir2save = await dialog.showOpenDialog({"properties": ["openDirectory"]});
   if (dir2save.canceled) return null;
   dir2save = dir2save.filePaths[0];

   console.log(dir2save);

   const parsedData = JSON.parse(jsonData);
   const json2glmArg = process.platform == "darwin" ? "json2glm" : "json2glm.exe";
   
   // for each json file data, make a json file and turn it to a glm file
   for (const file of Object.keys(parsedData))
   {
      newFilename = file.split(".")[0] + ".glm";
      args = `${json2glmArg} --path-to-file ${path.join(dir2save, file)} >> ${path.join(dir2save, newFilename)}`;

      createJsonFile(path.join(dir2save, file), JSON.stringify(parsedData[file]));

      execSync(args); 

      fs.rmSync(path.join(dir2save, file));
   }
}

app.whenReady().then(() => {
   makeWindow();

   ipcMain.handle("openPaths", (event, paths) => handleFileOpen(paths));
   ipcMain.handle("getStats", (event, dataObject) => getGraphStats(dataObject));
   ipcMain.handle("getPlot", () => sendPlot());
   ipcMain.handle("validate", (event, jsonFilePath) => validateJson(jsonFilePath));
   ipcMain.on("json2glm", (event, jsonData) => json2glmFunc(jsonData));

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
});