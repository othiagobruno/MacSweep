import {
  Clock,
  Code2,
  Download,
  FileText,
  FolderOpen,
  Hammer,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { JunkCategoryId } from "../types";

export const JUNK_ICONS: Record<JunkCategoryId, LucideIcon> = {
  userCache: FolderOpen,
  userLogs: FileText,
  tempFiles: Clock,
  trash: Trash2,
  oldDownloads: Download,
  xcode: Hammer,
  devCaches: Code2,
};

export const JUNK_COLORS: Record<JunkCategoryId, string> = {
  userCache: "#a29bfe",
  userLogs: "#74b9ff",
  tempFiles: "#fdcb6e",
  trash: "#ff7675",
  oldDownloads: "#00d2a0",
  xcode: "#0984e3",
  devCaches: "#e17055",
};

export function JunkIcon({ id, size = 18 }: { id: JunkCategoryId; size?: number }) {
  const Icon = JUNK_ICONS[id] ?? Trash2;
  const color = JUNK_COLORS[id] ?? "var(--accent-secondary)";
  return (
    <div
      className="result-row-icon"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <Icon size={size} />
    </div>
  );
}
