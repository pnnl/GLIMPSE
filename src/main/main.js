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
} = require('electron');
const { optimizer, is } = require('@electron-toolkit/utils');
const { spawn } = require('child_process');
const { join, basename } = require('path');
const { io } = require('socket.io-client');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const Ajv = require('ajv');
// const log = require('electron-log');
// const { autoUpdater } = require("electron-updater");

const jsonUploadSchema = require('../../schemas/json_upload.schema.json');
const themeUploadSchema = require('../../schemas/theme_upload.schema.json');
const socket = io('http://127.0.0.1:5173');
const isMac = process.platform === 'darwin';
const rootDir = app.isPackaged ? process.resourcesPath : __dirname;
let mainWindow = null;
let splashWindow = null;

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
    if (jsonData[fileName]['includes'].length === 0) {
      included_files.push(fileName);
    }
  });

  Object.keys(jsonData).forEach((fileName) => {
    if (jsonData[fileName]['includes'].length > 0) {
      jsonData[fileName]['includes'].forEach((include) => {
        includeS_files.push(include.value.split('.')[0] + '.json');
      });
    }
  });

  if (includeS_files.length === 0)
    return true; // add this line
  else if (included_files.sort().toString() !== includeS_files.sort().toString()) return false;
  else return true;
};

const glm2json = async (filePaths) => {
  const res = await fetch('http://127.0.0.1:5173/glm2json', {
    method: 'post',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(filePaths)
  });

  if (res.ok) {
    const output = await res.json();
    const valid = checkIncludes(output);

    if (!valid) {
      return { alert: 'one or more include files are missing!' };
    }
    return output;
  } else {
    console.log(res.status);
    console.log(res);
  }
};

const cimToGS = async (filePaths) => {
  const res = await fetch('http://127.0.0.1:5173/cimg-to-GS', {
    method: 'post',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(filePaths)
  });

  if (res.ok) {
    console.log(`Status from Response : ${res.status}`);
    const gs_output = await res.json();
    return gs_output;
  } else {
    return { alert: 'Something went wrong with the CIM XML file upload.' };
  }
};

const validateThemeFile = (filepath) => {
  const ajv = new Ajv();
  const validate = ajv.compile(themeUploadSchema);
  const themeData = JSON.parse(readFileSync(filepath, { encoding: 'utf-8' }));
  const valid = validate(themeData);

  if (valid) {
    console.log('custom theme file is valid !!');
    return themeData;
  } else {
    const errorMsg = ajv.errorsText(validate.errors, { dataVar: 'jsonData' });
    return { error: errorMsg };
  }
};

const sendPlot = () => {
  const plotFilename = join(__dirname, 'figs', 'plot.png');
  const plotFileData = readFileSync(plotFilename);
  return plotFileData;
};

const validateJson = (filePaths) => {
  const ajv = new Ajv();
  const validator = ajv.compile(jsonUploadSchema);
  const data = {};
  const nodeLinkDataKeys = ['directed', 'multigraph', 'graph', 'nodes', 'edges'];
  let valid = true;
  // let edgesKeyName = null;

  for (const filePath of filePaths) {
    const fileData = JSON.parse(readFileSync(filePath, { encoding: 'utf-8' }));

    if (nodeLinkDataKeys.every((key) => key in fileData)) {
      data[basename(filePath)] = {
        objects: []
      };

      for (const node of fileData.nodes) {
        let objectType = null;

        if ('type' in node && typeof node.type === 'object') {
          objectType = node.type.join('-');
        } else if ('type' in node) {
          objectType = node.type;
        } else {
          objectType = 'node';
        }

        data[basename(filePath)].objects.push({
          objectType: objectType,
          elementType: 'node',
          attributes: node
        });
      }

      for (const edge of fileData.edges) {
        const { source, target, key, ...rest } = edge;

        data[basename(filePath)].objects.push({
          objectType: 'type' in edge ? edge.type : 'edge',
          elementType: 'edge',
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
      else data[basename(filePath)] = fileData;
    }
  }

  if (!valid) {
    const errorMessage = ajv.errorsText(validator.errors, { dataVar: 'jsonData' });
    return JSON.stringify({ error: errorMessage });
  }

  console.log(`Files: ${filePaths} are valid!`);

  return JSON.stringify(data);
};

const exportThemeFile = async (themeData) => {
  const filename = 'custom.theme.json';
  let dir2save = await dialog.showOpenDialog({ properties: ['openDirectory'] });

  if (dir2save.canceled) return null;
  dir2save = dir2save.filePaths[0];

  writeFileSync(join(dir2save, filename), themeData);
};

const json2glmFunc = async (jsonData) => {
  // have the user choose where to store the files
  let dir2save = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (dir2save.canceled) return null;
  dir2save = dir2save.filePaths[0];

  const parsedData = JSON.parse(jsonData);

  Object.keys(parsedData).forEach((filename) => {
    delete Object.assign(parsedData, {
      [filename.replace('.json', '.glm')]: parsedData[filename]
    })[filename];
  });

  const sendObj = {
    saveDir: dir2save,
    data: parsedData
  };

  const res = await fetch('http://127.0.0.1:5173/json2glm', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(sendObj)
  });

  if (res.ok)
    new Notification({
      title: 'Export Notification',
      body: 'GLM files saved at: ' + dir2save
    }).show();
};

const getFilePaths = async () => {
  const fileSelectionPromise = dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });

  const fileSelection = await fileSelectionPromise;

  if (fileSelection.canceled) return null;

  return fileSelection.filePaths;
};

const makeWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1250,
    minHeight: 750,
    icon: '../resources/GLIMPSE_color_icon.ico',
    backgroundColor: 'white',
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, '..', 'preload', 'preload.js')
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault(); // Prevent the Electron app from navigating
    shell.openExternal(url); // Open the URL in the default browser
  });

  mainWindow.setIcon(
    nativeImage.createFromPath(join(__dirname, 'assets', 'GLIMPSE_color_icon.ico'))
  );

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' },
        {
          label: 'Export',
          click: () => mainWindow.webContents.send('extract')
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }])
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
      label: 'Themes',
      id: 'themes-menu-item',
      submenu: [
        {
          label: 'Export Theme File',
          type: 'normal',
          click: () => mainWindow.webContents.send('export-theme')
        },
        { type: 'separator' },
        {
          label: 'Power Grid [default]',
          id: 'power-grid-theme',
          type: 'radio',
          checked: true
        },
        {
          label: 'Custom',
          id: 'custom-theme',
          type: 'radio'
        }
      ]
    },
    {
      label: 'Graph View',
      submenu: [
        {
          label: 'show attributes',
          click: () => mainWindow.webContents.send('show-attributes', true)
        },
        {
          label: 'hide attributes',
          click: () => mainWindow.webContents.send('show-attributes', false)
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Embeddings',
          click: () => mainWindow.webContents.send('embeddings-plot', sendPlot())
        },
        {
          label: 'Graph Metrics',
          click: () => mainWindow.webContents.send('get-graph-metrics')
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  ipcMain.handle('get-theme', () => {
    const themeMenuItems =
      Menu.getApplicationMenu().getMenuItemById('themes-menu-item').submenu.items;
    let themeMenuItemID = null;

    for (const item of themeMenuItems) {
      if (item.checked) {
        themeMenuItemID = item.id;
        break;
      }
    }

    return themeMenuItemID;
  });

  ipcMain.handle('get-file-paths', () => getFilePaths());
  ipcMain.handle('getDefaultModelFiles', async () => {
    const { join } = require('path');
    const { readdirSync } = require('fs');
    const defaultDir = join(process.cwd(), 'data/default/');
    return readdirSync(defaultDir).map(f => join(defaultDir, f));
  });

  ipcMain.handle('get-config', () =>
    JSON.stringify(require(join(rootDir, '..', '..', 'config', 'appConfig.json')))
  );

  ipcMain.handle('glm2json', (_, paths) => glm2json(paths));
  ipcMain.handle('cimg2GS', (_, paths) => cimToGS(paths));

  ipcMain.handle('validate', (_, jsonFilePath) => validateJson(jsonFilePath));

  ipcMain.handle('get-theme-data', (_, filepath) => {
    const themeFilepath = join(rootDir, '..', '..', 'themes', filepath);
    const themeFileData = readFileSync(themeFilepath, { encoding: 'utf-8' });
    return JSON.parse(themeFileData);
  });

  ipcMain.handle('read-json-file', (_, filepath) => {
    const jsonFileData = readFileSync(filepath, { encoding: 'utf-8' });
    return JSON.parse(jsonFileData);
  });

  ipcMain.handle('validate-theme', (_, filepath) => validateThemeFile(filepath));

  ipcMain.on('json2glm', (_, jsonData) => json2glmFunc(jsonData));

  ipcMain.on('export-theme', (_, themeData) => exportThemeFile(themeData));

  ipcMain.on('send-natig-config', (_, configObj) => {
    if (socket.connected) {
      socket.emit('natig-config', configObj, (ack) => console.log(ack));
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }
};

const makeSplashWindow = () => {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    backgroundColor: 'white',
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    resizable: false,
    movable: true,
    roundedCorners: true,
    icon: join(__dirname, '..', '..', 'resources', 'GLIMPSE_color_icon.ico')
  });

  splashWindow.loadFile(join(__dirname, '..', '..', 'splash_window', 'splash-window.html'));
  splashWindow.center();
};

const initiateServer = () => {
  let serverProcess = null;
  const serverExecutableName =
    process.platform === 'linux' || process.platform === 'darwin' ? 'server' : 'server.exe';

  const serverExecutablePath = join(
    rootDir,
    '..',
    '..',
    'local-server',
    'server',
    serverExecutableName
  );

  if (existsSync(serverExecutablePath)) {
    serverProcess = spawn(serverExecutablePath);
    serverProcess.stdout.on('data', (data) => {
      console.log(data.toString('utf8'));
    });
    serverProcess.stderr.on('data', (data) => {
      console.error(`Server error: ${data.toString('utf8')}`);
    });
    serverProcess.stdout.on('error', (error) => console.log(`Server error: ${error}`));
    serverProcess.stderr.on('error', (error) => console.log(`Server error: ${error}`));
  } else {
    serverProcess = spawn('python', [join(__dirname, '..', '..', 'local-server', 'server.py')]);
    serverProcess.stdout.on('data', (data) => {
      console.log('data: ', data.toString('utf8'));
      // console.log("data: ", data);
    });
    serverProcess.stderr.on('data', (data) => {
      console.log(`log: ${data}`); // when error
    });
  }

  app.on('before-quit', () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });
};

app.whenReady().then(() => {
  globalShortcut.register('ctrl+p', () => mainWindow.webContents.send('show-vis-options'));
  makeSplashWindow();
  initiateServer();

  // Set app user model id for windows
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  socket.on('connect', () => {
    console.log('connected to socket server!!');
    spawn('python', [join(__dirname, '..', '..', 'natig', 'testsocket.py')], {
      stdio: 'inherit',
      shell: true
    });

    splashWindow.close();
    makeWindow();
    mainWindow.show();

    socket.on('update-data', (data) => mainWindow.webContents.send('update-data', data));
    socket.on('add-node', (data) => mainWindow.webContents.send('add-node', data));
    socket.on('add-edge', (data) => mainWindow.webContents.send('add-edge', data));
    socket.on('delete-node', (nodeID) => mainWindow.webContents.send('delete-node', nodeID));
    socket.on('delete-edge', (edgeID) => mainWindow.webContents.send('delete-edge', edgeID));
    socket.on('update-watch-item', (watchData) => {
      mainWindow.webContents.send('update-watch-item', watchData);
    });
  });

  // autoUpdater.checkForUpdatesAndNotify();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      makeWindow();
      mainWindow.show();
    }
  });
});

// app.on("before-quit", () => kill(process.pid));

app.on('window-all-closed', () => {
  app.quit();
});
