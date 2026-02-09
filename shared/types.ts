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

export type Page =
  | "smart-scan"
  | "system-junk"
  | "large-files"
  | "performance"
  | "uninstaller"
  | "maintenance"
  | "startup-items"
  | "settings";
