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
import type { Page, DiskUsage } from "../types";
import { formatBytes } from "../utils";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  diskUsage: DiskUsage | null;
}

const navItems: Array<{
  id: Page;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "smart-scan",
    label: "Smart Scan",
    icon: <Zap size={20} />,
  },
  {
    id: "system-junk",
    label: "System Junk",
    icon: <Trash2 size={20} />,
  },
  {
    id: "large-files",
    label: "Large Files",
    icon: <FileSearch size={20} />,
  },
  {
    id: "performance",
    label: "Performance",
    icon: <Activity size={20} />,
  },
  {
    id: "uninstaller",
    label: "Uninstaller",
    icon: <Package size={20} />,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: <Wrench size={20} />,
  },
  {
    id: "startup-items",
    label: "Startup Items",
    icon: <Power size={20} />,
  },
];

export function Sidebar({ currentPage, onNavigate, diskUsage }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Sparkles size={20} />
          </div>
          <span className="sidebar-logo-text">CleanMyMac</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Features</div>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-disk-info">
          <div className="sidebar-disk-label">
            <span>
              <HardDrive size={12} style={{ marginRight: 4 }} />
              Macintosh HD
            </span>
            <span>
              {diskUsage ? `${formatBytes(diskUsage.free)} free` : "..."}
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
