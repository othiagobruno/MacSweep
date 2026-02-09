import {
  Tray,
  BrowserWindow,
  nativeImage,
  ipcMain,
  app,
  screen,
} from "electron";
import path from "node:path";

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;

const TRAY_WINDOW_WIDTH = 340;
const TRAY_WINDOW_HEIGHT = 960;

/**
 * Create a 16x16 template icon using nativeImage.
 * Draws a simple gauge/speedometer shape.
 */
function createTrayIcon(): Electron.NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);

  // Simple circle arc + needle drawn pixel-by-pixel
  const cx = 7.5;
  const cy = 8.5;
  const R = 5.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
      let a = 0;

      // Arc
      if (d >= 4 && d <= 7 && ang >= -10 && ang <= 190) {
        a = Math.max(
          a,
          Math.round(255 * Math.max(0, 1 - Math.abs(d - R) / 1.3)),
        );
      }

      // Needle at ~50 degrees
      const na = (50 * Math.PI) / 180;
      const nx2 = Math.cos(na);
      const ny2 = -Math.sin(na);
      const proj = dx * nx2 + dy * ny2;
      const perp = Math.abs(-dx * ny2 + dy * nx2);
      if (proj >= 0 && proj <= 4 && perp < 0.8 && dy <= 1) {
        a = Math.max(a, Math.round(255 * Math.max(0, 1 - perp / 0.8)));
      }

      // Center dot
      if (d < 1.3) {
        a = Math.max(a, Math.round(255 * Math.max(0, 1 - d / 1.3)));
      }

      const i = (y * size + x) * 4;
      buf[i] = 0;
      buf[i + 1] = 0;
      buf[i + 2] = 0;
      buf[i + 3] = Math.min(255, a);
    }
  }

  const img = nativeImage.createFromBuffer(buf, {
    width: size,
    height: size,
  });
  img.setTemplateImage(true);
  return img;
}

function createTrayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: TRAY_WINDOW_WIDTH,
    height: TRAY_WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "tray-preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setVisibleOnAllWorkspaces(true);

  const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}/tray.html`);
  } else {
    win.loadFile(path.join(process.env.DIST!, "tray.html"));
  }

  win.on("blur", () => {
    win.hide();
  });

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
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  // Make sure it stays within screen bounds
  const maxX = display.bounds.x + display.bounds.width - TRAY_WINDOW_WIDTH;
  const clampedX = Math.min(Math.max(x, display.bounds.x), maxX);

  trayWindow.setPosition(clampedX, y);
  trayWindow.show();
  trayWindow.focus();
}

export function createTray(mainWindow: BrowserWindow | null) {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("CleanMyMac");

  trayWindow = createTrayWindow();

  tray.on("click", (_event, bounds) => {
    if (trayWindow?.isVisible()) {
      trayWindow.hide();
    } else {
      showTrayWindow(bounds);
    }
  });

  // IPC: open main window
  ipcMain.handle("tray:openMainWindow", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // IPC: quit app
  ipcMain.handle("tray:quit", () => {
    app.quit();
  });
}

export function destroyTray() {
  trayWindow?.destroy();
  trayWindow = null;
  tray?.destroy();
  tray = null;
}
