const { app, dialog, Menu, MenuItem } = require("electron");
const { autoUpdater } = require("electron-updater");

// Updates are published as GitHub releases by .github/workflows/desktop-release.yml;
// the feed (owner/repo) is baked into the app as app-update.yml by electron-builder.

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let getWindow = () => null;
let beforeInstall = async () => {};
// Set while a check the user asked for from the menu is running, so that its
// outcome ("up to date", errors) is reported instead of only logged.
let manualCheck = false;
let downloading = false;
let downloadedVersion = null;
// Do not keep asking about a version the user already said "Later" to.
let dismissedVersion = null;

const showMessage = (options) => {
    const win = getWindow();
    return win && !win.isDestroyed()
        ? dialog.showMessageBox(win, options)
        : dialog.showMessageBox(options);
};

const promptInstall = async (version) => {
    const { response } = await showMessage({
        type: "info",
        title: "Update ready",
        message: `GLIMPSE ${version} is ready to install.`,
        detail:
            "Restart now to finish updating. Save your work first: unsaved model edits will be lost. " +
            "If you choose Later, the update is installed the next time you quit GLIMPSE.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
    });
    if (response !== 0) return;

    // Stop the bundled backend first so the installer can replace its files.
    await beforeInstall();
    autoUpdater.quitAndInstall();
};

const checkForUpdates = async ({ manual = false } = {}) => {
    if (downloadedVersion) {
        if (manual) await promptInstall(downloadedVersion);
        return;
    }
    if (downloading) {
        if (manual) {
            await showMessage({ type: "info", message: "An update is already downloading." });
        }
        return;
    }

    manualCheck = manual;
    try {
        await autoUpdater.checkForUpdates();
    } catch {
        // Reported by the "error" listener.
    } finally {
        manualCheck = false;
    }
};

const registerListeners = () => {
    autoUpdater.on("update-available", async (info) => {
        if (!manualCheck && dismissedVersion === info.version) return;

        const { response } = await showMessage({
            type: "info",
            title: "Update available",
            message: `GLIMPSE ${info.version} is available. You have ${app.getVersion()}.`,
            detail: "Download it now? GLIMPSE keeps working while the update downloads.",
            buttons: ["Download", "Later"],
            defaultId: 0,
            cancelId: 1,
        });
        if (response !== 0) {
            dismissedVersion = info.version;
            return;
        }

        downloading = true;
        autoUpdater.downloadUpdate().catch(() => {
            // Reported by the "error" listener.
        });
    });

    autoUpdater.on("update-not-available", () => {
        if (manualCheck) {
            showMessage({
                type: "info",
                title: "No updates",
                message: `GLIMPSE ${app.getVersion()} is the latest version.`,
            });
        }
    });

    autoUpdater.on("download-progress", (progress) => {
        const win = getWindow();
        if (win && !win.isDestroyed()) win.setProgressBar(progress.percent / 100);
    });

    autoUpdater.on("update-downloaded", (info) => {
        downloading = false;
        downloadedVersion = info.version;
        const win = getWindow();
        if (win && !win.isDestroyed()) win.setProgressBar(-1);
        promptInstall(info.version);
    });

    autoUpdater.on("error", (err) => {
        console.error("[updater]", err);
        const win = getWindow();
        if (win && !win.isDestroyed()) win.setProgressBar(-1);

        // A failed background check (offline, rate-limited) is not worth a
        // dialog; a failed download the user started, or a manual check, is.
        if (manualCheck || downloading) {
            downloading = false;
            dialog.showErrorBox("GLIMPSE update failed", err?.message ?? String(err));
        }
    });
};

const addMenuItem = () => {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    const item = new MenuItem({
        label: "Check for Updates…",
        click: () => checkForUpdates({ manual: true }),
    });

    // macOS: under the app-name menu, after "About". Elsewhere: under Help.
    const hostRole = process.platform === "darwin" ? "appmenu" : "help";
    const host = menu.items.find((m) => String(m.role).toLowerCase() === hostRole);
    if (!host?.submenu) return;

    const position = process.platform === "darwin" ? 1 : host.submenu.items.length;
    host.submenu.insert(position, item);
    Menu.setApplicationMenu(menu);
};

/**
 * Start checking GitHub releases for a newer GLIMPSE.
 *
 * @param {object} options
 * @param {() => import("electron").BrowserWindow | null} options.getWindow  window to parent dialogs on
 * @param {() => Promise<void>} options.beforeInstall  runs before quitAndInstall (stops the backend)
 */
const initAutoUpdater = (options) => {
    // Development runs have no app-update.yml, and non-AppImage Linux builds
    // (tar.gz) cannot update themselves.
    if (!app.isPackaged || !autoUpdater.isUpdaterActive()) return;

    getWindow = options.getWindow;
    beforeInstall = options.beforeInstall;

    autoUpdater.logger = console;
    // Ask before downloading: installers are large and users may be on
    // metered or restricted networks.
    autoUpdater.autoDownload = false;
    // GitHub release assets redirect to another host; GLIMPSE sets no custom
    // headers, so none need to follow the request there.
    autoUpdater.crossOriginHeaders = () => [];

    registerListeners();
    addMenuItem();

    checkForUpdates();
    setInterval(checkForUpdates, CHECK_INTERVAL_MS);
};

module.exports = { initAutoUpdater };
