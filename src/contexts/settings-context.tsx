import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import i18n from "../i18n";

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

/* ── Theme CSS variable maps ──────────────────────── */

const THEME_VARS: Record<string, Record<string, string>> = {
  dark: {
    "--bg-primary": "#0a0a0f",
    "--bg-secondary": "#12121a",
    "--bg-tertiary": "#1a1a26",
    "--bg-card": "rgba(26, 26, 42, 0.6)",
    "--bg-card-hover": "rgba(32, 32, 52, 0.8)",
  },
  darker: {
    "--bg-primary": "#020204",
    "--bg-secondary": "#08080e",
    "--bg-tertiary": "#0f0f18",
    "--bg-card": "rgba(12, 12, 22, 0.8)",
    "--bg-card-hover": "rgba(18, 18, 32, 0.9)",
  },
  system: {
    "--bg-primary": "#0a0a0f",
    "--bg-secondary": "#12121a",
    "--bg-tertiary": "#1a1a26",
    "--bg-card": "rgba(26, 26, 42, 0.6)",
    "--bg-card-hover": "rgba(32, 32, 52, 0.8)",
  },
};

/* Derive accent gradient from a hex color */
function hexToAccentVars(hex: string) {
  return {
    "--accent-primary": hex,
    "--accent-secondary": lighten(hex, 30),
    "--accent-gradient": `linear-gradient(135deg, ${hex} 0%, ${lighten(hex, 30)} 100%)`,
    "--shadow-glow": `0 4px 20px ${hex}33`,
  };
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ── Context ──────────────────────────────────────── */

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetToDefaults: () => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount
  useEffect(() => {
    async function load() {
      try {
        if (window.electronAPI?.settings) {
          const data = await window.electronAPI.settings.load();
          setSettings((prev) => ({ ...prev, ...data }) as AppSettings);
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem("macsweep-settings");
          if (stored) {
            const parsed = JSON.parse(stored);
            setSettings((prev) => ({
              ...prev,
              ...parsed,
            }));
          }
        }
      } catch {
        // Use defaults
      }
      setIsLoaded(true);
    }
    load();
  }, []);

  // Apply CSS vars whenever settings change
  useEffect(() => {
    if (!isLoaded) return;
    const root = document.documentElement;

    // Theme
    const themeVars = THEME_VARS[settings.theme] || THEME_VARS.dark;
    for (const [prop, val] of Object.entries(themeVars)) {
      root.style.setProperty(prop, val);
    }

    // Accent color
    const accentVars = hexToAccentVars(settings.accentColor);
    for (const [prop, val] of Object.entries(accentVars)) {
      root.style.setProperty(prop, val);
    }

    // Language
    if (i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language);
    }

    // Animations
    if (!settings.animationsEnabled) {
      root.classList.add("no-animations");
    } else {
      root.classList.remove("no-animations");
    }

    // Compact sidebar
    if (settings.compactSidebar) {
      root.classList.add("compact-sidebar");
    } else {
      root.classList.remove("compact-sidebar");
    }
  }, [settings, isLoaded]);

  // Debounced save
  const persistSettings = useCallback((newSettings: AppSettings) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (window.electronAPI?.settings) {
          window.electronAPI.settings.save(
            newSettings as unknown as Record<string, unknown>,
          );
        } else {
          localStorage.setItem(
            "macsweep-settings",
            JSON.stringify(newSettings),
          );
        }
      } catch {
        // Silently fail
      }
    }, 300);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persistSettings(next);

        // Side effects for specific settings
        if (key === "launchAtLogin" && window.electronAPI?.settings) {
          window.electronAPI.settings.setLoginItem(value as boolean);
        }
        if (key === "showInMenuBar" && window.electronAPI?.settings) {
          window.electronAPI.settings.setTrayVisible(value as boolean);
        }

        return next;
      });
    },
    [persistSettings],
  );

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings],
  );

  const resetToDefaults = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    persistSettings(defaults);

    // Reset system integrations
    if (window.electronAPI?.settings) {
      window.electronAPI.settings.setLoginItem(defaults.launchAtLogin);
      window.electronAPI.settings.setTrayVisible(defaults.showInMenuBar);
    }
  }, [persistSettings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        resetToDefaults,
        isLoaded,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
