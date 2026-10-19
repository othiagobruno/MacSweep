/* ── Junk ──────────────────────────────────────────── */

export type JunkCategoryId =
  | "userCache"
  | "userLogs"
  | "tempFiles"
  | "trash"
  | "oldDownloads"
  | "xcode"
  | "devCaches";

export interface JunkItem {
  path: string;
  name: string;
  size: number;
}

export interface SystemJunkResult {
  id: JunkCategoryId;
  files: JunkItem[];
  totalSize: number;
  /** Whether items of this category should be pre-selected after a scan. */
  defaultSelected: boolean;
  /** Set when macOS denied read access (Full Disk Access is required). */
  accessDenied?: boolean;
}

export interface ScanProgress {
  /** 0–100 */
  progress: number;
  categoryId?: JunkCategoryId;
}

export interface CleanResult {
  success: boolean;
  freedSpace: number;
  errors: string[];
  failedPaths: string[];
  /** Subset of failedPaths that failed with a permission error. */
  needsAdminPaths: string[];
}

/* ── Large files ───────────────────────────────────── */

export type FileKind =
  | "video"
  | "audio"
  | "image"
  | "archive"
  | "diskImage"
  | "document"
  | "other";

export interface LargeFile {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  lastAccessed: string;
  extension: string;
  kind: FileKind;
}

export interface LargeFileScanOptions {
  minSizeMB?: number;
  maxDepth?: number;
  excludedFolders?: string[];
  scanHidden?: boolean;
  skipSystemFiles?: boolean;
}

export interface TrashResult {
  moved: string[];
  failed: string[];
}

/* ── Applications ──────────────────────────────────── */

export interface AppInfo {
  name: string;
  path: string;
  size: number;
  bundleId: string | null;
  version: string | null;
  lastUsed: string | null;
}

export type LeftoverKind =
  | "support"
  | "cache"
  | "preferences"
  | "logs"
  | "savedState"
  | "webData"
  | "launchAgent";

export interface AppLeftover {
  path: string;
  size: number;
  kind: LeftoverKind;
}

export interface UninstallRequest {
  appPath: string;
  bundleId: string | null;
  leftoverPaths: string[];
}

export interface UninstallResult {
  success: boolean;
  freedSpace: number;
  cancelled: boolean;
  errors: string[];
}

/* ── System ────────────────────────────────────────── */

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
  app: number;
  wired: number;
  compressed: number;
  cached: number;
  /** 0–100, derived from kern.memorystatus_level. */
  pressure: number;
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
  mount: string;
}

export interface BatteryInfo {
  cycleCount: number;
  maxCapacity: number;
  designCapacity: number;
  currentCapacity: number;
  percentCharge: number;
  isCharging: boolean;
  isFullyCharged: boolean;
  condition: "normal" | "fair" | "replaceSoon";
  temperature: number;
  healthPercent: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  memoryBytes: number;
}

export interface SystemInfo {
  model: string;
  chip: string;
  osVersion: string;
  hostname: string;
  uptime: number;
  cores: number;
  totalMemory: number;
}

export interface KillResult {
  success: boolean;
  error?: string;
}

/* ── Maintenance ───────────────────────────────────── */

export type MaintenanceTaskId =
  | "freeRam"
  | "flushDns"
  | "rebuildSpotlight"
  | "repairPermissions"
  | "rebuildLaunchServices"
  | "thinSnapshots";

export interface MaintenanceResult {
  taskId: MaintenanceTaskId;
  success: boolean;
  cancelled: boolean;
  /** Optional human-readable detail, e.g. amount of memory reclaimed. */
  detail?: string;
  error?: string;
}

/* ── Startup items ─────────────────────────────────── */

export interface StartupItem {
  name: string;
  label: string;
  path: string;
  programPath: string;
  kind: "LaunchAgent" | "LaunchDaemon";
  scope: "user" | "system";
  isEnabled: boolean;
  appPath: string | null;
}

export interface ToggleResult {
  success: boolean;
  cancelled: boolean;
  error?: string;
}

/* ── Settings & app ────────────────────────────────── */

export type ThemeId = "dark" | "darker" | "light" | "system";

export interface AppSettings {
  language: string;
  launchAtLogin: boolean;
  /** Days between background scans; 0 disables auto-scan. */
  autoScanInterval: number;
  notifications: boolean;
  showInMenuBar: boolean;
  minFileSize: number;
  scanDepth: number;
  excludedFolders: string[];
  skipSystemFiles: boolean;
  scanHiddenFiles: boolean;
  theme: ThemeId;
  accentColor: string;
  compactSidebar: boolean;
  animationsEnabled: boolean;
}

export interface AppStats {
  totalFreed: number;
  cleanCount: number;
  lastScanAt: string | null;
  lastCleanAt: string | null;
  lastScanJunkSize: number;
}

export interface AppMeta {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  dataPath: string;
  dataSize: number;
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

export const PAGES: Page[] = [
  "smart-scan",
  "system-junk",
  "large-files",
  "performance",
  "uninstaller",
  "maintenance",
  "startup-items",
  "settings",
];
