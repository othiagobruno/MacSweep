import {
  Activity,
  FileSearch,
  Package,
  Power,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Page } from "../types";

export interface ModuleTheme {
  icon: LucideIcon;
  /** Gradient stops for the page background and the module icon tile. */
  from: string;
  to: string;
  /** Bright highlight used for glows, progress rings and primary buttons. */
  glow: string;
}

/**
 * Every feature lives in its own color world, the way CleanMyMac does it.
 * The values are applied as CSS variables on the main area and sidebar tiles.
 */
export const MODULES: Record<Page, ModuleTheme> = {
  "smart-scan": {
    icon: Sparkles,
    from: "#0f8b8d",
    to: "#5b2bb5",
    glow: "#4ef2d0",
  },
  "system-junk": {
    icon: Trash2,
    from: "#0e9f6e",
    to: "#1d5fb8",
    glow: "#5cf5a8",
  },
  "large-files": {
    icon: FileSearch,
    from: "#e0662f",
    to: "#8a2470",
    glow: "#ffb067",
  },
  performance: {
    icon: Activity,
    from: "#7b3fe4",
    to: "#c2286f",
    glow: "#ff7ad9",
  },
  uninstaller: {
    icon: Package,
    from: "#1f7ae0",
    to: "#3a2fa8",
    glow: "#6cc8ff",
  },
  maintenance: {
    icon: Wrench,
    from: "#5f4bd8",
    to: "#1c8fb8",
    glow: "#8fd3ff",
  },
  "startup-items": {
    icon: Power,
    from: "#d83a6a",
    to: "#6a2bb0",
    glow: "#ff8fb1",
  },
  // Settings showcases the user's chosen accent color instead of its own.
  settings: {
    icon: Settings,
    from: "#3a4256",
    to: "#1d2130",
    glow: "var(--user-accent, #c3cbe0)",
  },
};

export function moduleStyle(page: Page): Record<string, string> {
  const m = MODULES[page];
  return {
    "--module-from": m.from,
    "--module-to": m.to,
    "--module-glow": m.glow,
  };
}
