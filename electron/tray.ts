import {
  Tray,
  BrowserWindow,
  Menu,
  nativeImage,
  ipcMain,
  app,
  screen,
} from "electron";
import path from "node:path";
import type { Page } from "../shared/types";

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;

const TRAY_WINDOW_WIDTH = 340;
const TRAY_DEFAULT_HEIGHT = 560;

interface TrayOptions {
  openMainWindow: (page?: Page) => void;
}

/**
 * Menu bar icon: a template image (black + alpha) so macOS tints it for light
 * and dark menu bars. "@2x" is picked up automatically on Retina displays.
 * Source: assets/tray-icon.svg → `node scripts/gen-tray-icon.mjs`.
 */
function createTrayIcon(): Electron.NativeImage {
  const assets = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "..", "assets");
  const icon = nativeImage.createFromPath(
    path.join(assets, "trayTemplate.png"),
  );
  icon.setTemplateImage(true);
  return icon;
}

function createTrayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: TRAY_WINDOW_WIDTH,
    height: TRAY_DEFAULT_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Native popover material, like Control Center and other menu bar extras.
    vibrancy: "popover",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    roundedCorners: true,
    hasShadow: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "tray-preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(`${VITE_DEV_SERVER_URL}/tray.html`);
  } else {
    void win.loadFile(path.join(process.env.DIST!, "tray.html"));
  }

  win.on("blur", () => win.hide());
  return win;
}

function showTrayWindow(trayBounds: Electron.Rectangle) {
  if (!trayWindow) return;

  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  const x = Math.round(
    trayBounds.x + trayBounds.width / 2 - TRAY_WINDOW_WIDTH / 2,
  );
  const y = Math.round(trayBounds.y + trayBounds.height + 6);
  const maxX = display.workArea.x + display.workArea.width - TRAY_WINDOW_WIDTH;
  const clampedX = Math.min(Math.max(x, display.workArea.x), maxX);

  trayWindow.setPosition(clampedX, y);
  trayWindow.show();
  trayWindow.focus();
  trayWindow.webContents.send("tray:show");
}

function registerTrayIpc(options: TrayOptions) {
  ipcMain.removeHandler("tray:openMainWindow");
  ipcMain.removeHandler("tray:quit");
  ipcMain.removeHandler("tray:resize");

  ipcMain.handle("tray:openMainWindow", (_event, page?: Page) => {
    trayWindow?.hide();
    options.openMainWindow(page);
  });
  ipcMain.handle("tray:quit", () => app.quit());
  ipcMain.handle("tray:resize", (_event, height: unknown) => {
    if (!trayWindow || typeof height !== "number" || !Number.isFinite(height))
      return;
    const display = screen.getDisplayMatching(trayWindow.getBounds());
    const max = display.workArea.height - 16;
    const next = Math.min(max, Math.max(120, Math.ceil(height)));
    trayWindow.setSize(TRAY_WINDOW_WIDTH, next);
  });
}

export function createTray(options: TrayOptions) {
  if (tray) return;

  tray = new Tray(createTrayIcon());
  tray.setToolTip("MacSweep");
  trayWindow = createTrayWindow();

  tray.on("click", (_event, bounds) => {
    if (trayWindow?.isVisible()) {
      trayWindow.hide();
    } else {
      showTrayWindow(bounds);
    }
  });

  tray.on("right-click", () => {
    tray?.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: "Open MacSweep", click: () => options.openMainWindow() },
        {
          label: "Smart Scan",
          click: () => options.openMainWindow("smart-scan"),
        },
        { type: "separator" },
        { label: "Quit MacSweep", role: "quit" },
      ]),
    );
  });

  registerTrayIpc(options);
}

export function destroyTray() {
  ipcMain.removeHandler("tray:openMainWindow");
  ipcMain.removeHandler("tray:quit");
  ipcMain.removeHandler("tray:resize");
  trayWindow?.destroy();
  trayWindow = null;
  tray?.destroy();
  tray = null;
}
