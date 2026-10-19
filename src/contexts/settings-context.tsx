import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import i18n from "../i18n";
import { api } from "../lib/api";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import type { AppSettings, ThemeId } from "../types";

export type { AppSettings };
export { DEFAULT_SETTINGS };

/* ── Theme & accent ───────────────────────────────── */

function resolveTheme(theme: ThemeId): "dark" | "darker" | "light" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function mix(hex: string, target: number, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const channel = (shift: number) => {
    const c = (num >> shift) & 0xff;
    return Math.round(c + (target - c) * amount);
  };
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0))
    .toString(16)
    .padStart(6, "0")}`;
}

export function accentVars(
  hex: string,
  light: boolean,
): Record<string, string> {
  // In light mode the "secondary" accent is used for text, so darken it.
  const secondary = light ? mix(hex, 0, 0.2) : mix(hex, 255, 0.35);
  return {
    "--accent-primary": hex,
    "--user-accent": hex,
    "--accent-secondary": secondary,
    "--accent-gradient": `linear-gradient(135deg, ${hex} 0%, ${mix(hex, 255, 0.35)} 100%)`,
  };
}

function applyAppearance(settings: AppSettings) {
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  root.dataset.theme = theme;
  for (const [prop, val] of Object.entries(
    accentVars(settings.accentColor, theme === "light"),
  )) {
    root.style.setProperty(prop, val);
  }
  root.classList.toggle("no-animations", !settings.animationsEnabled);
  root.classList.toggle("compact-sidebar", settings.compactSidebar);
}

/* ── Context ──────────────────────────────────────── */

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
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

  useEffect(() => {
    api.settings
      .load()
      .then((data) => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => undefined)
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    applyAppearance(settings);
    if (i18n.language !== settings.language)
      void i18n.changeLanguage(settings.language);
    document.documentElement.lang = settings.language;

    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyAppearance(settings);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings, isLoaded]);

  const persist = useCallback((next: AppSettings) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // Debounced: sliders fire many changes per second.
    saveTimeoutRef.current = setTimeout(() => {
      void api.settings.save(next).catch(() => undefined);
    }, 250);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetToDefaults = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS, language: settings.language };
    setSettings(defaults);
    persist(defaults);
  }, [persist, settings.language]);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSetting, resetToDefaults, isLoaded }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context)
    throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
