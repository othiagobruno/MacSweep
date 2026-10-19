import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { TrayAPI } from "../shared/api";

const trayAPI: TrayAPI = {
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
  settings: {
    load: () => ipcRenderer.invoke("settings:load"),
  },
  tray: {
    openMainWindow: (page) => ipcRenderer.invoke("tray:openMainWindow", page),
    resize: (height) => ipcRenderer.invoke("tray:resize", height),
    quit: () => ipcRenderer.invoke("tray:quit"),
    onShow: (callback) => {
      const listener = (_event: IpcRendererEvent) => callback();
      ipcRenderer.on("tray:show", listener);
      return () => ipcRenderer.removeListener("tray:show", listener);
    },
  },
};

contextBridge.exposeInMainWorld("electronAPI", trayAPI);
