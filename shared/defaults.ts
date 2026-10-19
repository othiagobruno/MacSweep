import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  launchAtLogin: false,
  autoScanInterval: 7,
  notifications: true,
  showInMenuBar: true,
  minFileSize: 50,
  scanDepth: 5,
  excludedFolders: [],
  skipSystemFiles: true,
  scanHiddenFiles: false,
  theme: "dark",
  accentColor: "#6c5ce7",
  compactSidebar: false,
  animationsEnabled: true,
};

export const SUPPORTED_LANGUAGES = [
  "en",
  "pt",
  "es",
  "fr",
  "de",
  "ja",
] as const;

/** Pick the best supported language for a system locale such as "pt-BR". */
export function languageFromLocale(locale: string): string {
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? base
    : "en";
}
