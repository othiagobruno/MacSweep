declare global {
  interface Window {
    electronAPI: {
      window: {
        close: () => Promise<void>;
        minimize: () => Promise<void>;
      };
      scan: {
        systemJunk: () => Promise<import("../shared/types").SystemJunkResult[]>;
        largeFiles: (options?: {
          minSizeMB?: number;
          maxDepth?: number;
          excludedFolders?: string[];
          scanHidden?: boolean;
        }) => Promise<import("../shared/types").LargeFile[]>;
        applications: () => Promise<import("../shared/types").AppInfo[]>;
        startupItems: () => Promise<import("../shared/types").StartupItem[]>;
      };
      clean: {
        files: (
          paths: string[],
        ) => Promise<import("../shared/types").CleanResult>;
      };
      system: {
        cpuUsage: () => Promise<import("../shared/types").CpuUsage>;
        memoryUsage: () => Promise<import("../shared/types").MemoryUsage>;
        diskUsage: () => Promise<import("../shared/types").DiskUsage>;
      };
      maintenance: {
        freeRam: () => Promise<import("../shared/types").MaintenanceResult>;
        flushDns: () => Promise<import("../shared/types").MaintenanceResult>;
        rebuildSpotlight: () => Promise<
          import("../shared/types").MaintenanceResult
        >;
        repairPermissions: () => Promise<
          import("../shared/types").MaintenanceResult
        >;
      };
      shell: {
        moveToTrash: (path: string) => Promise<void>;
        forceDelete: (
          paths: string[],
        ) => Promise<{ success: boolean; errors: string[] }>;
      };
      app: {
        getIcon: (appPath: string) => Promise<string | null>;
      };
      startup: {
        disableItem: (
          plistPath: string,
        ) => Promise<{ success: boolean; message: string }>;
        enableItem: (
          plistPath: string,
        ) => Promise<{ success: boolean; message: string }>;
      };
      settings: {
        load: () => Promise<Record<string, unknown>>;
        save: (data: Record<string, unknown>) => Promise<{ success: boolean }>;
        setLoginItem: (enabled: boolean) => Promise<{ success: boolean }>;
        setTrayVisible: (visible: boolean) => Promise<{ success: boolean }>;
      };
    };
  }
}

// Re-export all types from shared
export type {
  SystemJunkResult,
  LargeFile,
  AppInfo,
  CpuUsage,
  MemoryUsage,
  DiskUsage,
  MaintenanceResult,
  CleanResult,
  StartupItem,
  Page,
} from "../shared/types";
