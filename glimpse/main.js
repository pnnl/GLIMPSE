const { app, BrowserWindow, ipcMain } = require("electron");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const Ajv = require("ajv");
const jsonSchema = require("./upload.schema.json");
// const isDev = process.env.NODE_ENV !== "development";

// require("electron-reload")(__dirname, {
//    electron: path.join(__dirname, "node_modules", ".bin", "electron")
// });

const makeWindow = () => {
   const win = new BrowserWindow({
      width: 1800,
      height: 1000,
      backgroundColor: "white",
      show: false,
      webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
         preload: path.join(__dirname, 'preload.js')
      }
   })

   // if(isDev) {
   //    win.webContents.openDevTools();
   // }
   win.loadFile("./renderer/public/index.html");
   win.show()
}

const checkIncludes = ( jsonData ) => {

   let included_files = [];
   let includeS_files = [];
   const missingIncludesRes = {"alert": "One or more include files are missing!"};
    
   Object.keys(jsonData).forEach((fileName) => {
      if (jsonData[fileName]["includes"].length === 0)
      {
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

   if(included_files.sort().toString() !== includeS_files.sort().toString())
   {
      return missingIncludesRes;
   }
   else 
   {
      return JSON.stringify(jsonData);
   }
}

const handleFileOpen = async (filePaths) => {

   let args = `python ./py/glm2json.py`;
   for (const filePath of filePaths)
   {
      args += ` ${filePath}`;
   }

   const {stderr, stdout} = await exec(args);

   // const output = execSync(args, (error, stdout, stderr) => {
   //    if (error)
   //    {
   //       console.log(error);
   //       return;
   //    }
   //    else if (stderr)
   //    {
   //       console.log(stderr);
   //       return;
   //    }

   //    return stdout;
   // })

   if(stderr)
   {
      console.log(stderr.toString());
      return;
   }

   // Will return an alert message if include files are missing
   // otherwise it will return the stdout as a string
   return checkIncludes(JSON.parse(stdout.toString()));
}

const getGraphStats = async (data) => {

   // Create a new file
   fs.open(path.join(__dirname, "glm2jsonData.json"), 'w', (err, fd) => {
      if (err) {
         console.log("There was an error creating the file...");
         return;
      }

      // Write the json string data to the file
      fs.write(fd, data, (err) => {
         if (err) {
            console.log("There was an error writing to the file...");
            return;
         }

         // Close the file
         fs.close(fd, (err) => {
            if (err) {
               console.log("There was an error clossing the file...");
               return;
            }
         });
      });
   });

   let args = "python ./py/nx.py " + path.join(__dirname, "glm2jsonData.json"); 
   const output = execSync(args, (error, stdout, stderr) => {
      if (error)
      {
         console.log(error);
         return;
      }
      else if (stderr)
      {
         console.log(stderr);
         return;
      }

      return stdout;
   })
   fs.rmSync(path.join(__dirname, "glm2jsonData.json"));

   return output.toString();
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

   for (const filePath of filePaths)
   {
      const fileData = require(filePath);
      valid = validate(fileData);

      if (!valid) {
         break;
      }
      else
      {
         data[path.basename(filePath)] = fileData;
      }
   }

   if(!valid)
   {
      const errorMessage = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
      return {"error": errorMessage};
   }

   return JSON.stringify(data);
}

app.whenReady().then(() => {

   ipcMain.handle("openPaths", (event, paths) => handleFileOpen(paths));
   ipcMain.handle("getStats", (event, dataObject) => getGraphStats(dataObject));
   ipcMain.handle("getPlot", () => sendPlot());
   ipcMain.handle("validate", (event, jsonFilePath) => validateJson(jsonFilePath));

   makeWindow();
});

// utilityProcess.fork(path.join(__dirname, "backend", "server.js"));

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