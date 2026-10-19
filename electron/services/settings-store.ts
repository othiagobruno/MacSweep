import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { app } from "electron";
import type { AppSettings, AppStats, ThemeId } from "../../shared/types";
import { DEFAULT_SETTINGS, languageFromLocale } from "../../shared/defaults";

const LEGACY_SETTINGS_PATH = path.join(os.homedir(), ".macsweep-settings.json");

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function statsPath(): string {
  return path.join(app.getPath("userData"), "stats.json");
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, file); // atomic replace, never leaves a half-written file
  } catch {
    // Disk full or read-only home; settings stay in memory for this session.
  }
}

const THEMES: ThemeId[] = ["dark", "darker", "light", "system"];

/** Coerce untrusted input into a valid settings object. */
export function sanitizeSettings(input: unknown): AppSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const bool = (k: keyof AppSettings) =>
    typeof raw[k] === "boolean" ? (raw[k] as boolean) : (d[k] as boolean);
  const int = (k: keyof AppSettings, min: number, max: number) => {
    const n = Number(raw[k]);
    return Number.isFinite(n)
      ? Math.min(max, Math.max(min, Math.round(n)))
      : (d[k] as number);
  };

  return {
    language: typeof raw.language === "string" ? raw.language : d.language,
    launchAtLogin: bool("launchAtLogin"),
    autoScanInterval: int("autoScanInterval", 0, 30),
    notifications: bool("notifications"),
    showInMenuBar: bool("showInMenuBar"),
    minFileSize: int("minFileSize", 1, 10_000),
    scanDepth: int("scanDepth", 1, 20),
    excludedFolders: Array.isArray(raw.excludedFolders)
      ? raw.excludedFolders.filter((f): f is string => typeof f === "string")
      : d.excludedFolders,
    skipSystemFiles: bool("skipSystemFiles"),
    scanHiddenFiles: bool("scanHiddenFiles"),
    theme: THEMES.includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : d.theme,
    accentColor:
      typeof raw.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(raw.accentColor)
        ? raw.accentColor
        : d.accentColor,
    compactSidebar: bool("compactSidebar"),
    animationsEnabled: bool("animationsEnabled"),
  };
}

let cachedSettings: AppSettings | null = null;

export function loadSettings(): AppSettings {
  if (cachedSettings) return cachedSettings;
  let raw = readJson(settingsPath());
  if (!raw) {
    // Migrate from the pre-1.1 location in the home folder.
    raw = readJson(LEGACY_SETTINGS_PATH);
    if (raw) {
      writeJson(settingsPath(), sanitizeSettings(raw));
      fs.promises.unlink(LEGACY_SETTINGS_PATH).catch(() => {});
    }
  }
  // First launch: follow the macOS language when we support it.
  cachedSettings = sanitizeSettings(
    raw ?? { language: languageFromLocale(app.getLocale()) },
  );
  return cachedSettings;
}

export function saveSettings(settings: unknown): AppSettings {
  cachedSettings = sanitizeSettings(settings);
  writeJson(settingsPath(), cachedSettings);
  return cachedSettings;
}

/* ── Stats ─────────────────────────────────────────── */

const EMPTY_STATS: AppStats = {
  totalFreed: 0,
  cleanCount: 0,
  lastScanAt: null,
  lastCleanAt: null,
  lastScanJunkSize: 0,
};

export function loadStats(): AppStats {
  return { ...EMPTY_STATS, ...(readJson(statsPath()) as Partial<AppStats> | null) };
}

export function updateStats(patch: (stats: AppStats) => Partial<AppStats>): AppStats {
  const current = loadStats();
  const next = { ...current, ...patch(current) };
  writeJson(statsPath(), next);
  return next;
}
