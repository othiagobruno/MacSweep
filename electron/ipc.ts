import fs from "node:fs";
import path from "node:path";
import {
  app,
  dialog,
  ipcMain,
  shell,
  BrowserWindow,
  type IpcMainInvokeEvent,
} from "electron";
import { scanSystemJunk } from "./services/scanner";
import { scanLargeFiles } from "./services/large-files";
import { cleanFiles, cleanFilesAsAdmin, moveToTrash } from "./services/cleaner";
import {
  findLeftovers,
  getAppIcon,
  scanApplications,
  uninstallApp,
} from "./services/apps";
import {
  getBatteryInfo,
  getCpuUsage,
  getDiskUsage,
  getMemoryUsage,
  getSystemInfo,
  getTopProcesses,
  killProcess,
} from "./services/system-info";
import { runMaintenance } from "./services/maintenance";
import {
  scanStartupItems,
  setStartupItemEnabled,
} from "./services/startup-items";
import {
  loadSettings,
  loadStats,
  saveSettings,
  updateStats,
} from "./services/settings-store";
import { diskSize, run } from "./services/exec";
import type { AppMeta, AppSettings, AppStats, CleanResult } from "../shared/types";

export const RELEASES_URL = "https://github.com/othiagobruno/cleanmymac/releases";

interface IpcHooks {
  onSettingsChanged: (previous: AppSettings, next: AppSettings) => void;
  onStatsChanged: (stats: AppStats) => void;
}

/** Only accept IPC from our own bundled pages or the Vite dev server. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? "";
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  return url.startsWith("file://") || (!!devUrl && url.startsWith(devUrl));
}

function handle<Args extends unknown[], R>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: Args) => R | Promise<R>,
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Blocked IPC call to ${channel} from untrusted sender`);
    }
    return fn(event, ...(args as Args));
  });
}

function existingPath(value: unknown): string | null {
  if (typeof value !== "string" || !path.isAbsolute(value)) return null;
  return fs.existsSync(value) ? value : null;
}

export function registerIpcHandlers(hooks: IpcHooks): void {
  const recordClean = (result: CleanResult) => {
    if (result.freedSpace > 0) {
      hooks.onStatsChanged(
        updateStats((s) => ({
          totalFreed: s.totalFreed + result.freedSpace,
          cleanCount: s.cleanCount + 1,
          lastCleanAt: new Date().toISOString(),
        })),
      );
    }
    return result;
  };

  /* Scanning */
  handle("scan:systemJunk", async (event) => {
    const results = await scanSystemJunk({
      ownCacheNames: [app.getName()],
      onProgress: (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send("scan:progress", progress);
      },
    });
    const junk = results
      .filter((r) => r.defaultSelected)
      .reduce((sum, r) => sum + r.totalSize, 0);
    hooks.onStatsChanged(
      updateStats(() => ({
        lastScanAt: new Date().toISOString(),
        lastScanJunkSize: junk,
      })),
    );
    return results;
  });
  handle("scan:largeFiles", (_e, options) => scanLargeFiles(options as never));
  handle("scan:applications", () => scanApplications());
  handle("scan:startupItems", () => scanStartupItems());

  /* Cleaning */
  handle("clean:files", async (_e, paths) => recordClean(await cleanFiles(paths)));
  handle("clean:filesAsAdmin", async (_e, paths) =>
    recordClean(await cleanFilesAsAdmin(paths)),
  );

  /* Applications */
  handle("apps:getIcon", (_e, appPath) => getAppIcon(appPath as string));
  handle("apps:leftovers", (_e, info) => findLeftovers(info as never));
  handle("apps:uninstall", async (_e, request) => {
    const result = await uninstallApp(request as never);
    if (result.success) {
      recordClean({
        success: true,
        freedSpace: result.freedSpace,
        errors: [],
        failedPaths: [],
        needsAdminPaths: [],
      });
    }
    return result;
  });

  /* System */
  handle("system:cpuUsage", () => getCpuUsage());
  handle("system:memoryUsage", () => getMemoryUsage());
  handle("system:diskUsage", () => getDiskUsage());
  handle("system:batteryInfo", () => getBatteryInfo());
  handle("system:topProcesses", (_e, limit) =>
    getTopProcesses(typeof limit === "number" ? limit : 5),
  );
  handle("system:killProcess", (_e, pid) => killProcess(pid));
  handle("system:info", () => getSystemInfo());

  /* Maintenance & startup */
  handle("maintenance:run", (_e, taskIds) => runMaintenance(taskIds));
  handle("startup:setEnabled", (_e, item, enabled) =>
    setStartupItemEnabled(item as never, Boolean(enabled)),
  );

  /* Shell */
  handle("shell:moveToTrash", (_e, paths) => moveToTrash(paths));
  handle("shell:revealInFinder", (_e, target) => {
    const p = existingPath(target);
    if (p) shell.showItemInFolder(p);
  });
  handle("shell:openPath", async (_e, target) => {
    const p = existingPath(target);
    if (p) await shell.openPath(p);
  });
  handle("shell:quickLook", async (_e, target) => {
    const p = existingPath(target);
    if (p) await run("qlmanage", ["-p", p]).catch(() => undefined);
  });
  handle("shell:openFullDiskAccessSettings", () =>
    shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
    ),
  );

  /* Settings */
  handle("settings:load", () => loadSettings());
  handle("settings:save", (_e, next) => {
    const previous = loadSettings();
    const saved = saveSettings(next);
    hooks.onSettingsChanged(previous, saved);
  });
  handle("settings:chooseFolder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = {
      properties: ["openDirectory", "showHiddenFiles"] as Array<
        "openDirectory" | "showHiddenFiles"
      >,
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  /* App */
  handle("app:meta", async (): Promise<AppMeta> => {
    const dataPath = app.getPath("userData");
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      dataPath,
      dataSize: await diskSize(dataPath),
    };
  });
  handle("app:stats", () => loadStats());
  handle("app:openReleases", () => shell.openExternal(RELEASES_URL));
}
