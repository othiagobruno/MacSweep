import { contextBridge, ipcRenderer } from "electron";

const trayAPI = {
  system: {
    cpuUsage: () => ipcRenderer.invoke("system:cpuUsage"),
    memoryUsage: () => ipcRenderer.invoke("system:memoryUsage"),
    diskUsage: () => ipcRenderer.invoke("system:diskUsage"),
    topProcesses: () => ipcRenderer.invoke("system:topProcesses"),
    killProcess: (pid: number) => ipcRenderer.invoke("system:killProcess", pid),
    batteryInfo: () => ipcRenderer.invoke("system:batteryInfo"),
  },
  maintenance: {
    freeRam: () => ipcRenderer.invoke("maintenance:freeRam"),
    flushDns: () => ipcRenderer.invoke("maintenance:flushDns"),
    rebuildSpotlight: () => ipcRenderer.invoke("maintenance:rebuildSpotlight"),
    repairPermissions: () =>
      ipcRenderer.invoke("maintenance:repairPermissions"),
  },
  tray: {
    openMainWindow: () => ipcRenderer.invoke("tray:openMainWindow"),
    quit: () => ipcRenderer.invoke("tray:quit"),
  },
};

contextBridge.exposeInMainWorld("electronAPI", trayAPI);

export type TrayAPI = typeof trayAPI;
