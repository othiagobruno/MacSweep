import type {
  AppInfo,
  AppLeftover,
  AppMeta,
  AppSettings,
  AppStats,
  BatteryInfo,
  CleanResult,
  CpuUsage,
  DiskUsage,
  KillResult,
  LargeFile,
  LargeFileScanOptions,
  MaintenanceResult,
  MaintenanceTaskId,
  MemoryUsage,
  Page,
  ProcessInfo,
  ScanProgress,
  StartupItem,
  SystemInfo,
  SystemJunkResult,
  ToggleResult,
  TrashResult,
  UninstallRequest,
  UninstallResult,
} from "./types";

export type Unsubscribe = () => void;

/**
 * Single source of truth for the renderer ↔ main contract.
 * Implemented by electron/preload.ts and src/lib/mock-api.ts.
 */
export interface ElectronAPI {
  scan: {
    systemJunk: () => Promise<SystemJunkResult[]>;
    largeFiles: (options?: LargeFileScanOptions) => Promise<LargeFile[]>;
    applications: () => Promise<AppInfo[]>;
    startupItems: () => Promise<StartupItem[]>;
    onProgress: (callback: (progress: ScanProgress) => void) => Unsubscribe;
  };
  clean: {
    files: (paths: string[]) => Promise<CleanResult>;
    filesAsAdmin: (paths: string[]) => Promise<CleanResult>;
  };
  apps: {
    getIcon: (appPath: string) => Promise<string | null>;
    leftovers: (app: AppInfo) => Promise<AppLeftover[]>;
    uninstall: (request: UninstallRequest) => Promise<UninstallResult>;
  };
  system: {
    cpuUsage: () => Promise<CpuUsage>;
    memoryUsage: () => Promise<MemoryUsage>;
    diskUsage: () => Promise<DiskUsage>;
    batteryInfo: () => Promise<BatteryInfo | null>;
    topProcesses: (limit?: number) => Promise<ProcessInfo[]>;
    killProcess: (pid: number) => Promise<KillResult>;
    info: () => Promise<SystemInfo>;
  };
  maintenance: {
    run: (taskIds: MaintenanceTaskId[]) => Promise<MaintenanceResult[]>;
  };
  startup: {
    setEnabled: (item: StartupItem, enabled: boolean) => Promise<ToggleResult>;
  };
  shell: {
    moveToTrash: (paths: string[]) => Promise<TrashResult>;
    revealInFinder: (path: string) => Promise<void>;
    openPath: (path: string) => Promise<void>;
    quickLook: (path: string) => Promise<void>;
    openFullDiskAccessSettings: () => Promise<void>;
  };
  settings: {
    load: () => Promise<AppSettings>;
    save: (settings: AppSettings) => Promise<void>;
    chooseFolder: () => Promise<string | null>;
  };
  app: {
    meta: () => Promise<AppMeta>;
    stats: () => Promise<AppStats>;
    openReleases: () => Promise<void>;
    onNavigate: (callback: (page: Page) => void) => Unsubscribe;
    onStatsChanged: (callback: (stats: AppStats) => void) => Unsubscribe;
  };
}

/** Reduced surface exposed to the menu-bar popover. */
export interface TrayAPI {
  system: ElectronAPI["system"];
  maintenance: ElectronAPI["maintenance"];
  settings: Pick<ElectronAPI["settings"], "load">;
  tray: {
    openMainWindow: (page?: Page) => Promise<void>;
    resize: (height: number) => Promise<void>;
    quit: () => Promise<void>;
    onShow: (callback: () => void) => Unsubscribe;
  };
}
