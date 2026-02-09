import { contextBridge, ipcRenderer } from "electron";
import type {
  SystemJunkResult,
  LargeFile,
  AppInfo,
  CpuUsage,
  MemoryUsage,
  DiskUsage,
  MaintenanceResult,
  CleanResult,
  StartupItem,
} from "../shared/types";

const electronAPI = {
  window: {
    close: (): Promise<void> => ipcRenderer.invoke("window:close"),
    minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
  },
  scan: {
    systemJunk: (): Promise<SystemJunkResult[]> =>
      ipcRenderer.invoke("scan:systemJunk"),
    largeFiles: (options?: {
      minSizeMB?: number;
      maxDepth?: number;
      excludedFolders?: string[];
      scanHidden?: boolean;
    }): Promise<LargeFile[]> => ipcRenderer.invoke("scan:largeFiles", options),
    applications: (): Promise<AppInfo[]> =>
      ipcRenderer.invoke("scan:applications"),
    startupItems: (): Promise<StartupItem[]> =>
      ipcRenderer.invoke("scan:startupItems"),
  },
  clean: {
    files: (paths: string[]): Promise<CleanResult> =>
      ipcRenderer.invoke("clean:files", paths),
  },
  system: {
    cpuUsage: (): Promise<CpuUsage> => ipcRenderer.invoke("system:cpuUsage"),
    memoryUsage: (): Promise<MemoryUsage> =>
      ipcRenderer.invoke("system:memoryUsage"),
    diskUsage: (): Promise<DiskUsage> => ipcRenderer.invoke("system:diskUsage"),
  },
  maintenance: {
    freeRam: (): Promise<MaintenanceResult> =>
      ipcRenderer.invoke("maintenance:freeRam"),
    flushDns: (): Promise<MaintenanceResult> =>
      ipcRenderer.invoke("maintenance:flushDns"),
    rebuildSpotlight: (): Promise<MaintenanceResult> =>
      ipcRenderer.invoke("maintenance:rebuildSpotlight"),
    repairPermissions: (): Promise<MaintenanceResult> =>
      ipcRenderer.invoke("maintenance:repairPermissions"),
  },
  shell: {
    moveToTrash: (path: string): Promise<void> =>
      ipcRenderer.invoke("shell:moveToTrash", path),
    forceDelete: (
      paths: string[],
    ): Promise<{ success: boolean; errors: string[] }> =>
      ipcRenderer.invoke("shell:forceDelete", paths),
  },
  app: {
    getIcon: (appPath: string): Promise<string | null> =>
      ipcRenderer.invoke("app:getIcon", appPath),
  },
  startup: {
    disableItem: (
      plistPath: string,
    ): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke("startup:disableItem", plistPath),
    enableItem: (
      plistPath: string,
    ): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke("startup:enableItem", plistPath),
  },
  settings: {
    load: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke("settings:load"),
    save: (data: Record<string, unknown>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("settings:save", data),
    setLoginItem: (enabled: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("settings:setLoginItem", enabled),
    setTrayVisible: (visible: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("settings:setTrayVisible", visible),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
