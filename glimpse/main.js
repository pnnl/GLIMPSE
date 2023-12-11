const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const path = require("path");
const fs = require("fs");
const Ajv = require("ajv");
const jsonSchema = require("./upload.schema.json");
const { dir, error } = require("console");
const isDev = process.env.NODE_ENV !== "development";

// require("electron-reload")(__dirname, {
//    electron: path.join(__dirname, "node_modules", ".bin", "electron")
// });

const makeWindow = () => {
   const win = new BrowserWindow({
      width: 1800,
      height: 1000,
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
   let included_files = [];
   let includeS_files = [];
   const missingIncludesRes = {"alert": "One or more include files are missing!"};

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

   if(included_files.sort().toString() !== includeS_files.sort().toString()) {
      return missingIncludesRes;
   }
   else {
      return JSON.stringify(jsonData);
   }
}

const handleFileOpen = async (filePaths) => {

   let args = `python ./py/glm2json.py`;
   for (const filePath of filePaths) {
      args += ` ${filePath}`;
   }

   const {stderr, stdout} = await exec(args);

   if(stderr) {
      console.log(stderr.toString());
      return;
   }

   // Will return an alert message if include files are missing
   // otherwise it will return the stdout as a string
   return checkIncludes(JSON.parse(stdout.toString()));
}

const writeToJsonFile = (filename, dir, data) => {
   // Create a new json file

   fs.writeFileSync(path.join(dir, filename), data, (err) => {
     if (err) {
       console.log(err);
     } else {
       console.log('File written successfully.');
     }
   });
   
}

const getGraphStats = async (data) => {

   writeToJsonFile("glm2jsonData.json", __dirname, data);

   let args = "python ./py/nx.py " + path.join(__dirname, "glm2jsonData.json"); 
   const {stderr, stdout} = await exec(args);

   if (stderr) {
      console.log(stderr.toString());
      fs.rmSync(path.join(__dirname, "glm2jsonData.json"));
      return;
   }

   fs.rmSync(path.join(__dirname, "glm2jsonData.json"));
   return stdout.toString();
}

const sendPlot = async () => {
   const imgBuffer = fs.readFileSync(path.join(__dirname, "figs", "plot.png"));
   return imgBuffer;
}

const validateJson = (filePaths) => {
   const ajv = new Ajv();
   const validate = ajv.compile(jsonSchema);
   const data = {};
   let valid = true;

   for (const filePath of filePaths) {
      const fileData = require(filePath);
      valid = validate(fileData);

      if (!valid) {
         break;
      }
      else {
         data[path.basename(filePath)] = fileData;
      }
   }

   if(!valid) {
      const errorMessage = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
      return {"error": errorMessage};
   }

   return JSON.stringify(data);
}

const json2glm = async (jsonData) => {

   const parsedData = JSON.parse(jsonData);
   let json2glmExe = "json2glm.exe";
   if (process.platform == "darwin") json2glmExe = "json2glm";

   // have the user choose where to store the files
   let dir2Save = await dialog.showOpenDialog({"properties": ["openDirectory"]});
   if (dir2Save.canceled) return null;
   dir2Save = dir2Save.filePaths[0];
   
   console.log(dir2Save);

   // for each json file data, make a json file and turn it to a glm file
   for (const file of Object.keys(parsedData))
   {
      let newFileName = file.split(".")[0] + ".glm";
      writeToJsonFile(file, dir2Save, JSON.stringify(parsedData[file]));
      const { stderr } = await exec(`${json2glmExe} --path-to-file ${path.join(dir2Save, file)} >> ${path.join(dir2Save, newFileName)}`);

      if (stderr) {
         console.log(stderr.toString());
      }

      fs.rm(path.join(dir2Save, file), (error) => {
         if (error) console.log(error);
      });
   }
}

app.whenReady().then(() => {
   makeWindow();

   ipcMain.handle("openPaths", (event, paths) => handleFileOpen(paths));
   ipcMain.handle("getStats", (event, dataObject) => getGraphStats(dataObject));
   ipcMain.handle("getPlot", () => sendPlot());
   ipcMain.handle("validate", (event, jsonFilePath) => validateJson(jsonFilePath));
   ipcMain.on("json2glm", (event, jsonData) => json2glm(jsonData));

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