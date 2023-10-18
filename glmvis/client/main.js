const { app, BrowserWindow, utilityProcess } = require("electron");
const path = require("path");
const makeWindow = () => {
   const win = new BrowserWindow({
      width: 1800,
      height: 1000,
      backgroundColor: "white",
      webPreferences: {
         nodeIntegration: false,
         worldSafeExecuteJavaScript: true,
         contextIsolation: true,
      }
   })
   // preload: path.join(__dirname, 'preload.js')
   
   win.loadFile("./public/index.html");
}

utilityProcess.fork(path.join(__dirname, "..", "backend", "server.js"));

// require("electron-reload")(__dirname, {
//    electron: path.join(__dirname, "node_modules", ".bin", "electron")
// });

app.once("ready", () => {
   makeWindow();

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