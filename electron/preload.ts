import { contextBridge, ipcRenderer } from "electron";

export interface SystemJunkResult {
  category: string;
  files: Array<{ path: string; size: number; name: string }>;
  totalSize: number;
}

export interface LargeFile {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  extension: string;
}

export interface AppInfo {
  name: string;
  path: string;
  size: number;
  icon?: string;
}

export interface CpuUsage {
  user: number;
  system: number;
  idle: number;
  total: number;
}

export interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
  mount: string;
}

export interface MaintenanceResult {
  success: boolean;
  message: string;
}

export interface CleanResult {
  success: boolean;
  freedSpace: number;
  errors: string[];
}

export interface StartupItem {
  name: string;
  path: string;
  programPath: string;
  kind: "LaunchAgent" | "LaunchDaemon";
  isEnabled: boolean;
  appPath: string | null;
}

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
