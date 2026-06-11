// GLIMPSE Electron main process.
//
// In a packaged app this spawns the PyInstaller-built Flask/SocketIO server
// (bundled under resources/server/), waits for it to come up, then opens the
// window pointed at the built frontend. On quit the entire server process
// tree is terminated so no child processes are left running.
//
// In development (`npm run electron:dev`) the backend and the Vite dev server
// are started by `concurrently`, and this process only opens a window on
// ELECTRON_START_URL.

const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const SERVER_PORT = Number(process.env.FLASK_PORT) || 5052;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const DEV_URL = process.env.ELECTRON_START_URL;

let mainWindow = null;
let serverProcess = null;
let quitting = false;

// ------------------------------------------------------------------
// GPU / WebGL availability
// ------------------------------------------------------------------
// Sigma.js requires WebGL; without a usable GPU the window renders blank.
// Allow Chromium's software (SwiftShader) fallback everywhere — it is a
// no-op on machines with a working GPU. Under WSL additionally ignore the
// GPU blocklist, which wrongly rejects the WSLg/Mesa stack.
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

const isWSL =
    process.platform === "linux" &&
    (process.env.WSL_DISTRO_NAME !== undefined ||
        fs.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop"));
if (isWSL) {
    app.commandLine.appendSwitch("ignore-gpu-blocklist");
}

// ------------------------------------------------------------------
// Backend server lifecycle
// ------------------------------------------------------------------

const serverExecutablePath = () => {
    const exeName = process.platform === "win32" ? "server.exe" : "server";
    return path.join(process.resourcesPath, "server", exeName);
};

const startServer = () => {
    const exe = serverExecutablePath();

    serverProcess = spawn(exe, [], {
        cwd: path.dirname(exe),
        env: {
            ...process.env,
            FLASK_PORT: String(SERVER_PORT),
            FLASK_HOST: "127.0.0.1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        // Own process group on POSIX so the whole tree can be killed at once
        detached: process.platform !== "win32",
        windowsHide: true,
    });

    serverProcess.stdout.on("data", (data) => {
        console.log(`[server] ${data}`.trimEnd());
    });
    serverProcess.stderr.on("data", (data) => {
        console.error(`[server] ${data}`.trimEnd());
    });

    serverProcess.on("error", (err) => {
        serverProcess = null;
        dialog.showErrorBox(
            "GLIMPSE backend failed to start",
            `Could not launch the local server:\n${exe}\n\n${err.message}`,
        );
        app.quit();
    });

    serverProcess.on("exit", (code, signal) => {
        serverProcess = null;
        if (!quitting) {
            dialog.showErrorBox(
                "GLIMPSE backend stopped",
                `The local server exited unexpectedly (code: ${code}, signal: ${signal}). GLIMPSE will close.`,
            );
            app.quit();
        }
    });
};

const waitForServer = (timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
        const attempt = () => {
            if (app.isPackaged && serverProcess === null) {
                reject(new Error("The local server exited before it became ready."));
                return;
            }

            const req = http.get(SERVER_URL, (res) => {
                res.resume();
                resolve();
            });
            req.setTimeout(1000, () => req.destroy(new Error("timeout")));
            req.on("error", () => {
                if (Date.now() > deadline) {
                    reject(
                        new Error(
                            `The local server did not respond on ${SERVER_URL} within ${timeoutMs / 1000}s.`,
                        ),
                    );
                } else {
                    setTimeout(attempt, 250);
                }
            });
        };

        attempt();
    });
};

const stopServer = () => {
    const child = serverProcess;
    serverProcess = null;

    if (!child || child.exitCode !== null) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let forceKillTimer = null;

        child.once("exit", () => {
            if (forceKillTimer) clearTimeout(forceKillTimer);
            resolve();
        });

        if (process.platform === "win32") {
            // /T kills the whole process tree, /F forces termination
            spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
        } else {
            // Negative pid signals the whole process group
            try {
                process.kill(-child.pid, "SIGTERM");
            } catch {
                child.kill("SIGTERM");
            }
            forceKillTimer = setTimeout(() => {
                try {
                    process.kill(-child.pid, "SIGKILL");
                } catch {
                    // already gone
                }
            }, 3000);
        }

        // Safety net: never block quit for more than 5s
        setTimeout(resolve, 5000);
    });
};

// ------------------------------------------------------------------
// Window
// ------------------------------------------------------------------

const createWindow = () => {
    const iconPath = path.join(__dirname, "..", "build", "icon.png");

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });

    mainWindow.once("ready-to-show", () => mainWindow.show());

    // Open external links in the default browser instead of new Electron windows
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    if (DEV_URL) {
        mainWindow.loadURL(DEV_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
};

// ------------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------------

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    // Another GLIMPSE instance already owns the server; focus it instead
    app.quit();
} else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        if (app.isPackaged) {
            startServer();
            try {
                await waitForServer();
            } catch (err) {
                dialog.showErrorBox("GLIMPSE failed to start", err.message);
                quitting = true;
                await stopServer();
                app.quit();
                return;
            }
        }

        createWindow();

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

// Make sure the server is gone before the app exits
app.on("before-quit", (event) => {
    if (quitting) return;
    quitting = true;
    if (serverProcess) {
        event.preventDefault();
        stopServer().then(() => app.quit());
    }
});

// Terminal Ctrl+C / kill should also clean up the server
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => app.quit());
}
