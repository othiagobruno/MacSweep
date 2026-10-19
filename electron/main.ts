import {
  app,
  BrowserWindow,
  Menu,
  nativeTheme,
  nativeImage,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import path from "node:path";
import { registerIpcHandlers, RELEASES_URL } from "./ipc";
import { createTray, destroyTray } from "./tray";
import { startScheduler } from "./scheduler";
import { loadSettings } from "./services/settings-store";
import type { AppStats, Page } from "../shared/types";

process.env.DIST = path.join(__dirname, "../dist");

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const isDev = Boolean(VITE_DEV_SERVER_URL);

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, "assets", "icon.png")
  : path.join(__dirname, "..", "assets", "icon.png");

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    icon: iconPath,
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 640,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 20 },
    // Native translucent sidebar; the page area paints its own background.
    vibrancy: "sidebar",
    visualEffectState: "followWindow",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // macOS convention: closing the window keeps the app (and tray) alive.
  win.on("close", (event) => {
    if (!isQuitting && process.platform === "darwin") {
      event.preventDefault();
      win.hide();
    }
  });
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Never navigate away from the app or open new Electron windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isDev || !url.startsWith(VITE_DEV_SERVER_URL!)) event.preventDefault();
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(process.env.DIST!, "index.html"));
  }
  return win;
}

/** Show (creating if needed) the main window, optionally on a given page. */
export function showMainWindow(page?: Page): void {
  let win = getMainWindow();
  if (!win) {
    win = mainWindow = createWindow();
    if (page) {
      win.webContents.once("did-finish-load", () =>
        win?.webContents.send("app:navigate", page),
      );
    }
  } else if (page) {
    win.webContents.send("app:navigate", page);
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function broadcastStats(stats: AppStats): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("app:statsChanged", stats);
  }
}

function buildMenu(): void {
  const nav = (page: Page, label: string, accelerator: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => showMainWindow(page),
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        nav("settings", "Settings…", "CmdOrCtrl+,"),
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "Go",
      submenu: [
        nav("smart-scan", "Smart Scan", "CmdOrCtrl+1"),
        nav("system-junk", "System Junk", "CmdOrCtrl+2"),
        nav("large-files", "Large Files", "CmdOrCtrl+3"),
        nav("performance", "Performance", "CmdOrCtrl+4"),
        nav("uninstaller", "Uninstaller", "CmdOrCtrl+5"),
        nav("maintenance", "Maintenance", "CmdOrCtrl+6"),
        nav("startup-items", "Startup Items", "CmdOrCtrl+7"),
      ],
    },
    {
      label: "View",
      submenu: [
        ...(isDev
          ? ([{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }] as MenuItemConstructorOptions[])
          : []),
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "MacSweep Releases", click: () => void shell.openExternal(RELEASES_URL) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Keep native chrome (vibrancy, menus, dialogs) in sync with the app theme. */
function applyNativeTheme(): void {
  const { theme } = loadSettings();
  nativeTheme.themeSource =
    theme === "light" ? "light" : theme === "system" ? "system" : "dark";
}

function applySystemIntegrations(): void {
  const settings = loadSettings();
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, openAsHidden: true });
  }
  if (settings.showInMenuBar) {
    createTray({ openMainWindow: showMainWindow });
  } else {
    destroyTray();
  }
}

// Only one instance: a second launch just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => showMainWindow());

  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: "MacSweep",
      applicationVersion: app.getVersion(),
      copyright: `© ${new Date().getFullYear()} MacSweep`,
    });

    if (process.platform === "darwin" && !app.isPackaged) {
      const dockIcon = nativeImage.createFromPath(iconPath);
      if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
    }

    registerIpcHandlers({
      onSettingsChanged: (previous, next) => {
        if (previous.theme !== next.theme) applyNativeTheme();
        if (
          previous.launchAtLogin !== next.launchAtLogin ||
          previous.showInMenuBar !== next.showInMenuBar
        ) {
          applySystemIntegrations();
        }
      },
      onStatsChanged: broadcastStats,
    });

    buildMenu();
    applyNativeTheme();

    // Launched hidden at login: stay in the menu bar until summoned.
    const openedAtLogin = app.getLoginItemSettings().wasOpenedAsHidden;
    if (!openedAtLogin) showMainWindow();
    applySystemIntegrations();

    startScheduler({
      onOpenSmartScan: () => showMainWindow("smart-scan"),
      onStatsChanged: broadcastStats,
    });
  });
}
