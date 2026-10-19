import {
  Zap,
  Trash2,
  FileSearch,
  Activity,
  Package,
  Wrench,
  HardDrive,
  Power,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DiskUsage, Page } from "../types";
import { formatBytes } from "../utils";
import logoFull from "../../assets/logo.png";
import logoCompact from "../../assets/logo-icon.png";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  diskUsage: DiskUsage | null;
  /** Junk found by the most recent scan, shown as a badge. */
  junkBadge: number;
}

const navItems: Array<{ id: Page; labelKey: string; icon: LucideIcon; shortcut?: string }> = [
  { id: "smart-scan", labelKey: "sidebar.smartScan", icon: Zap, shortcut: "⌘1" },
  { id: "system-junk", labelKey: "sidebar.systemJunk", icon: Trash2, shortcut: "⌘2" },
  { id: "large-files", labelKey: "sidebar.largeFiles", icon: FileSearch, shortcut: "⌘3" },
  { id: "performance", labelKey: "sidebar.performance", icon: Activity, shortcut: "⌘4" },
  { id: "uninstaller", labelKey: "sidebar.uninstaller", icon: Package, shortcut: "⌘5" },
  { id: "maintenance", labelKey: "sidebar.maintenance", icon: Wrench, shortcut: "⌘6" },
  { id: "startup-items", labelKey: "sidebar.startupItems", icon: Power, shortcut: "⌘7" },
  { id: "settings", labelKey: "sidebar.settings", icon: Settings, shortcut: "⌘," },
];

function diskTone(percentUsed: number): string {
  if (percentUsed >= 90) return "danger";
  if (percentUsed >= 80) return "warning";
  return "";
}

export function Sidebar({ currentPage, onNavigate, diskUsage, junkBadge }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logoFull} alt="MacSweep" className="logo-full" />
          <img src={logoCompact} alt="MacSweep" className="logo-compact" />
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={t("sidebar.features")}>
        <div className="sidebar-section-title">{t("sidebar.features")}</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={item.shortcut ? `${label}  ${item.shortcut}` : label}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-item-icon">
                <Icon size={20} />
              </span>
              <span className="sidebar-item-label">{label}</span>
              {item.id === "smart-scan" && junkBadge > 0 && (
                <span className="sidebar-badge">{formatBytes(junkBadge, 0)}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-disk-info">
          <div className="sidebar-disk-label">
            <span>
              <HardDrive size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
              {t("sidebar.macintoshHD")}
            </span>
            <span>
              {diskUsage ? t("sidebar.freeSpace", { space: formatBytes(diskUsage.free) }) : "…"}
            </span>
          </div>
          <div
            className="sidebar-disk-bar"
            role="progressbar"
            aria-valuenow={Math.round(diskUsage?.percentUsed ?? 0)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`sidebar-disk-fill ${diskTone(diskUsage?.percentUsed ?? 0)}`}
              style={{ width: `${diskUsage?.percentUsed ?? 0}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
