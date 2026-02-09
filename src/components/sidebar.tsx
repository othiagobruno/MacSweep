import {
  Zap,
  Trash2,
  FileSearch,
  Activity,
  Package,
  Wrench,
  Sparkles,
  HardDrive,
  Power,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Page, DiskUsage } from "../types";
import { formatBytes } from "../utils";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  diskUsage: DiskUsage | null;
}

const navItems: Array<{
  id: Page;
  labelKey: string;
  icon: React.ReactNode;
}> = [
  {
    id: "smart-scan",
    labelKey: "sidebar.smartScan",
    icon: <Zap size={20} />,
  },
  {
    id: "system-junk",
    labelKey: "sidebar.systemJunk",
    icon: <Trash2 size={20} />,
  },
  {
    id: "large-files",
    labelKey: "sidebar.largeFiles",
    icon: <FileSearch size={20} />,
  },
  {
    id: "performance",
    labelKey: "sidebar.performance",
    icon: <Activity size={20} />,
  },
  {
    id: "uninstaller",
    labelKey: "sidebar.uninstaller",
    icon: <Package size={20} />,
  },
  {
    id: "maintenance",
    labelKey: "sidebar.maintenance",
    icon: <Wrench size={20} />,
  },
  {
    id: "startup-items",
    labelKey: "sidebar.startupItems",
    icon: <Power size={20} />,
  },
  {
    id: "settings",
    labelKey: "sidebar.settings",
    icon: <Settings size={20} />,
  },
];

export function Sidebar({ currentPage, onNavigate, diskUsage }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles size={20} />
          </div>
          <span className="sidebar-logo-text">MacSweep</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">{t("sidebar.features")}</div>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{t(item.labelKey)}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-disk-info">
          <div className="sidebar-disk-label">
            <span>
              <HardDrive size={12} style={{ marginRight: 4 }} />
              {t("sidebar.macintoshHD")}
            </span>
            <span>
              {diskUsage
                ? t("sidebar.freeSpace", { space: formatBytes(diskUsage.free) })
                : "..."}
            </span>
          </div>
          <div className="sidebar-disk-bar">
            <div
              className="sidebar-disk-fill"
              style={{
                width: `${diskUsage?.percentUsed ?? 0}%`,
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
