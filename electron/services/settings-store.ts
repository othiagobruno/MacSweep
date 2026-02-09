import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SETTINGS_PATH = path.join(os.homedir(), ".macsweep-settings.json");

export interface AppSettings {
  language: string;
  launchAtLogin: boolean;
  autoScanInterval: number;
  notifications: boolean;
  showInMenuBar: boolean;
  minFileSize: number;
  scanDepth: number;
  excludedFolders: string[];
  skipSystemFiles: boolean;
  scanHiddenFiles: boolean;
  theme: "dark" | "darker" | "system";
  accentColor: string;
  compactSidebar: boolean;
  animationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  launchAtLogin: false,
  autoScanInterval: 7,
  notifications: true,
  showInMenuBar: true,
  minFileSize: 50,
  scanDepth: 5,
  excludedFolders: ["/System", "/Library", "/usr"],
  skipSystemFiles: true,
  scanHiddenFiles: false,
  theme: "dark",
  accentColor: "#6c5ce7",
  compactSidebar: false,
  animationsEnabled: true,
};

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      // Merge with defaults to handle newly added keys
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Corrupted file — return defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  } catch {
    // Silently fail — user home might be read-only (unlikely)
  }
}
