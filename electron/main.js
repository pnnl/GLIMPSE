const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const SERVER_PORT = Number(process.env.FLASK_PORT) || 5052;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const DEV_URL = process.env.ELECTRON_START_URL;

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let quitting = false;
// A crash loop should not restart forever; one recovery is the useful case.
const MAX_SERVER_RESTARTS = 1;
let restartsUsed = 0;

const notifyRenderer = (channel) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel);
    }
};

app.commandLine.appendSwitch("enable-unsafe-swiftshader");

const isWSL =
    process.platform === "linux" &&
    (process.env.WSL_DISTRO_NAME !== undefined || fs.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop"));
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
        if (quitting) return;

        // A parse can OOM the backend, and quitting outright costs the user the
        // loaded model and every unsaved edit. Try once to bring it back with the
        // window still open before giving up.
        if (restartsUsed < MAX_SERVER_RESTARTS) {
            restartsUsed += 1;
            console.warn(`[server] exited (code ${code}, signal ${signal}) — restarting.`);
            notifyRenderer("backend-restarting");

            startServer();
            waitForServer()
                .then(() => notifyRenderer("backend-restarted"))
                .catch((err) => {
                    dialog.showErrorBox(
                        "GLIMPSE backend stopped",
                        `The local server exited and could not be restarted.\n\n${err.message}`,
                    );
                    app.quit();
                });
            return;
        }

        dialog.showErrorBox(
            "GLIMPSE backend stopped",
            `The local server exited unexpectedly (code: ${code}, signal: ${signal}) and has already ` +
                `been restarted ${MAX_SERVER_RESTARTS} time(s). GLIMPSE will close.`,
        );
        app.quit();
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
                // Any listener on 5052 answers here, so check that it is actually
                // GLIMPSE before adopting it — otherwise an unrelated process on
                // the port races the spawn and either one can win.
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    if (body.length < 2048) body += chunk;
                });
                res.on("end", () => {
                    let isGlimpse;
                    try {
                        isGlimpse = String(JSON.parse(body).api || "").includes("GLIMPSE");
                    } catch {
                        isGlimpse = false;
                    }
                    if (isGlimpse) {
                        resolve();
                    } else {
                        reject(
                            new Error(
                                `Port ${SERVER_PORT} is already in use by another application. ` +
                                    "Close it and start GLIMPSE again.",
                            ),
                        );
                    }
                });
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

const createSplashWindow = () => {
    const logoPath = DEV_URL
        ? path.join(__dirname, "..", "public", "GLIMPSE_logo.png")
        : path.join(__dirname, "..", "dist", "GLIMPSE_logo.png");
    const logoUrl = `file://${logoPath.replace(/\\/g, "/")}`;

    splashWindow = new BrowserWindow({
        width: 600,
        height: 340,
        frame: false,
        resizable: false,
        center: true,
        alwaysOnTop: true,
        backgroundColor: "#041422",
        webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    splashWindow.loadFile(path.join(__dirname, "splash.html"), {
        query: { logoUrl },
    });

    splashWindow.on("closed", () => {
        splashWindow = null;
    });
};

const createWindow = () => {
    const iconPath = path.join(__dirname, "..", "build", "icon.png");

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
    });

    // A renderer crash otherwise leaves a blank window with nothing said. The GPU
    // process dying is the realistic cause here — this app is WebGL-heavy.
    mainWindow.webContents.on("render-process-gone", (event, details) => {
        if (quitting) return;
        console.error("[renderer] gone:", details.reason);

        const response = dialog.showMessageBoxSync(mainWindow, {
            type: "error",
            title: "GLIMPSE stopped responding",
            message: `The GLIMPSE window crashed (${details.reason}).`,
            detail: "Reloading starts fresh. Any unsaved model edits will be lost.",
            buttons: ["Reload", "Quit"],
            defaultId: 0,
            cancelId: 1,
        });

        if (response === 0) mainWindow.reload();
        else app.quit();
    });

    mainWindow.on("unresponsive", () => {
        if (quitting) return;
        const choice = dialog.showMessageBoxSync(mainWindow, {
            type: "warning",
            title: "GLIMPSE is not responding",
            message: "The window has stopped responding.",
            detail: "It may be working through a large model. Wait, or reload and lose unsaved edits.",
            buttons: ["Wait", "Reload"],
            defaultId: 0,
            cancelId: 0,
        });
        if (choice === 1) mainWindow.reload();
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url);
        return { action: "deny" };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
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
        createSplashWindow();

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
    app.quit();
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
