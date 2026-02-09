import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  scanSystemJunk,
  scanLargeFiles,
  scanApplications,
} from "./services/scanner";
import { cleanFiles } from "./services/cleaner";
import {
  getCpuUsage,
  getMemoryUsage,
  getDiskUsage,
  getBatteryInfo,
  getTopProcesses,
  killProcess,
} from "./services/system-info";
import {
  freeRam,
  flushDns,
  rebuildSpotlight,
  repairPermissions,
} from "./services/maintenance";
import { createTray, destroyTray } from "./tray";
import {
  scanStartupItems,
  disableStartupItem,
  enableStartupItem,
} from "./services/startup-items";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./services/settings-store";

const execFileAsync = promisify(execFile);

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");

let win: BrowserWindow | null;

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST!, "index.html"));
  }
}

/**
 * Extract an app icon using macOS native tools (sips),
 * bypassing Electron's nativeImage to avoid Chromium
 * NOTREACHED crashes.
 */
async function getAppIconDataUrl(appPath: string): Promise<string | null> {
  try {
    const infoPlistPath = path.join(appPath, "Contents", "Info.plist");

    // Read icon filename from Info.plist using defaults
    const { stdout: iconNameRaw } = await execFileAsync("defaults", [
      "read",
      infoPlistPath,
      "CFBundleIconFile",
    ]);

    let iconFile = iconNameRaw.trim();
    if (!iconFile.endsWith(".icns")) {
      iconFile += ".icns";
    }

    const icnsPath = path.join(appPath, "Contents", "Resources", iconFile);

    // Verify the icns file exists
    await fs.promises.access(icnsPath);

    // Convert to PNG using sips (macOS built-in)
    const tmpFile = path.join(
      os.tmpdir(),
      `cmm_icon_${Date.now()}_${Math.random().toString(36).slice(2)}.png`,
    );

    await execFileAsync("sips", [
      "-s",
      "format",
      "png",
      "-z",
      "64",
      "64",
      icnsPath,
      "--out",
      tmpFile,
    ]);

    const pngBuffer = await fs.promises.readFile(tmpFile);
    // Cleanup temp file
    fs.promises.unlink(tmpFile).catch(() => {});

    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// IPC Handlers
ipcMain.handle("scan:systemJunk", async () => {
  return await scanSystemJunk();
});

ipcMain.handle(
  "scan:largeFiles",
  async (
    _event,
    options?: {
      minSizeMB?: number;
      maxDepth?: number;
      excludedFolders?: string[];
      scanHidden?: boolean;
    },
  ) => {
    return await scanLargeFiles(options ?? {});
  },
);

ipcMain.handle("scan:applications", async () => {
  return await scanApplications();
});

ipcMain.handle("clean:files", async (_event, filePaths: string[]) => {
  return await cleanFiles(filePaths);
});

ipcMain.handle("system:cpuUsage", async () => {
  return await getCpuUsage();
});

ipcMain.handle("system:memoryUsage", async () => {
  return getMemoryUsage();
});

ipcMain.handle("system:diskUsage", async () => {
  return await getDiskUsage();
});

ipcMain.handle("system:batteryInfo", async () => {
  return await getBatteryInfo();
});

ipcMain.handle("system:topProcesses", async () => {
  return await getTopProcesses();
});

ipcMain.handle("system:killProcess", async (_event, pid: number) => {
  return await killProcess(pid);
});

ipcMain.handle("maintenance:freeRam", async () => {
  return await freeRam();
});

ipcMain.handle("maintenance:flushDns", async () => {
  return await flushDns();
});

ipcMain.handle("maintenance:rebuildSpotlight", async () => {
  return await rebuildSpotlight();
});

ipcMain.handle("maintenance:repairPermissions", async () => {
  return await repairPermissions();
});

ipcMain.handle("shell:moveToTrash", async (_event, filePath: string) => {
  return shell.trashItem(filePath);
});

ipcMain.handle(
  "shell:forceDelete",
  async (
    _event,
    filePaths: string[],
  ): Promise<{ success: boolean; errors: string[] }> => {
    const errors: string[] = [];

    // Build a single rm command for all paths
    const escapedPaths = filePaths.map((p) => `"${p.replace(/"/g, '\\"')}"`);
    const rmCommand = `rm -rf ${escapedPaths.join(" ")}`;

    try {
      await execFileAsync("osascript", [
        "-e",
        `do shell script "${rmCommand.replace(/"/g, '\\"')}" with administrator privileges`,
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // User cancelled the auth dialog
      if (msg.includes("-128")) {
        return {
          success: false,
          errors: ["Authorization cancelled by user"],
        };
      }
      errors.push(msg);
    }

    return { success: errors.length === 0, errors };
  },
);

ipcMain.handle("app:getIcon", async (_event, appPath: string) => {
  return await getAppIconDataUrl(appPath);
});

ipcMain.handle("scan:startupItems", async () => {
  return await scanStartupItems();
});

ipcMain.handle("startup:disableItem", async (_event, plistPath: string) => {
  return await disableStartupItem(plistPath);
});

ipcMain.handle("startup:enableItem", async (_event, plistPath: string) => {
  return await enableStartupItem(plistPath);
});

// === SETTINGS ===
ipcMain.handle("settings:load", async () => {
  return loadSettings();
});

ipcMain.handle("settings:save", async (_event, settings: AppSettings) => {
  saveSettings(settings);
  return { success: true };
});

ipcMain.handle("settings:setLoginItem", async (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  });
  return { success: true };
});

ipcMain.handle("settings:setTrayVisible", async (_event, visible: boolean) => {
  if (visible) {
    if (win) createTray(win);
  } else {
    destroyTray();
  }
  return { success: true };
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray(win);
});
