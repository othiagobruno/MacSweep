import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { ElectronAPI, Unsubscribe } from "../shared/api";

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const electronAPI: ElectronAPI = {
  scan: {
    systemJunk: () => ipcRenderer.invoke("scan:systemJunk"),
    largeFiles: (options) => ipcRenderer.invoke("scan:largeFiles", options),
    applications: () => ipcRenderer.invoke("scan:applications"),
    startupItems: () => ipcRenderer.invoke("scan:startupItems"),
    onProgress: (callback) => subscribe("scan:progress", callback),
  },
  clean: {
    files: (paths) => ipcRenderer.invoke("clean:files", paths),
    filesAsAdmin: (paths) => ipcRenderer.invoke("clean:filesAsAdmin", paths),
  },
  apps: {
    getIcon: (appPath) => ipcRenderer.invoke("apps:getIcon", appPath),
    leftovers: (app) => ipcRenderer.invoke("apps:leftovers", app),
    uninstall: (request) => ipcRenderer.invoke("apps:uninstall", request),
  },
  system: {
    cpuUsage: () => ipcRenderer.invoke("system:cpuUsage"),
    memoryUsage: () => ipcRenderer.invoke("system:memoryUsage"),
    diskUsage: () => ipcRenderer.invoke("system:diskUsage"),
    batteryInfo: () => ipcRenderer.invoke("system:batteryInfo"),
    topProcesses: (limit) => ipcRenderer.invoke("system:topProcesses", limit),
    killProcess: (pid) => ipcRenderer.invoke("system:killProcess", pid),
    info: () => ipcRenderer.invoke("system:info"),
  },
  maintenance: {
    run: (taskIds) => ipcRenderer.invoke("maintenance:run", taskIds),
  },
  startup: {
    setEnabled: (item, enabled) =>
      ipcRenderer.invoke("startup:setEnabled", item, enabled),
  },
  shell: {
    moveToTrash: (paths) => ipcRenderer.invoke("shell:moveToTrash", paths),
    revealInFinder: (path) => ipcRenderer.invoke("shell:revealInFinder", path),
    openPath: (path) => ipcRenderer.invoke("shell:openPath", path),
    quickLook: (path) => ipcRenderer.invoke("shell:quickLook", path),
    openFullDiskAccessSettings: () =>
      ipcRenderer.invoke("shell:openFullDiskAccessSettings"),
  },
  settings: {
    load: () => ipcRenderer.invoke("settings:load"),
    save: (settings) => ipcRenderer.invoke("settings:save", settings),
    chooseFolder: () => ipcRenderer.invoke("settings:chooseFolder"),
  },
  app: {
    meta: () => ipcRenderer.invoke("app:meta"),
    stats: () => ipcRenderer.invoke("app:stats"),
    openReleases: () => ipcRenderer.invoke("app:openReleases"),
    onNavigate: (callback) => subscribe("app:navigate", callback),
    onStatsChanged: (callback) => subscribe("app:statsChanged", callback),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
