import { useState } from "react";
import { FileSearch, Trash2, Check, ArrowUpDown, File } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionNotice } from "../components/action-notice";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PulseLoader, ScanningLines } from "../components/loaders";
import { formatBytes, formatDate, getExtColor } from "../utils";
import { useAppState } from "../contexts/app-state-context";
import { useSettings } from "../contexts/settings-context";
import type { LargeFile } from "../types";

export function LargeFiles() {
  const { t } = useTranslation();
  const {
    largeFiles: {
      isScanning,
      setIsScanning,
      files,
      setFiles,
      selected,
      setSelected,
      sortBy,
      setSortBy,
      scanned,
      setScanned,
    },
  } = useAppState();

  const { settings } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "info" | "warning" | "error";
    message: string;
  } | null>(null);

  async function scanLargeFiles() {
    if (window.electronAPI) {
      return window.electronAPI.scan.largeFiles({
        minSizeMB: settings.minFileSize,
        maxDepth: settings.scanDepth,
        excludedFolders: settings.excludedFolders,
        scanHidden: settings.scanHiddenFiles,
      });
    }

    await new Promise((r) => setTimeout(r, 3000));
    return getMockData();
  }

  async function handleScan() {
    setIsScanning(true);
    setScanned(false);
    setFeedback(null);

    try {
      const results = await scanLargeFiles();
      setFiles(results);
      setScanned(true);
    } catch {
      setFiles(getMockData());
      setScanned(true);
    }

    setIsScanning(false);
  }

  function toggleFile(path: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelected(newSelected);
  }

  function toggleAll() {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.path)));
    }
  }

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case "size":
        return b.size - a.size;
      case "name":
        return a.name.localeCompare(b.name);
      case "date":
        return (
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime()
        );
      default:
        return 0;
    }
  });

  const selectedSize = files
    .filter((f) => selected.has(f.path))
    .reduce((sum, f) => sum + f.size, 0);

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setFeedback(null);

    const paths = Array.from(selected);
    let movedCount = 0;
    let failedCount = 0;

    if (window.electronAPI) {
      for (const p of paths) {
        try {
          await window.electronAPI.shell.moveToTrash(p);
          movedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
    } else {
      movedCount = paths.length;
    }

    if (window.electronAPI) {
      try {
        setFiles(await scanLargeFiles());
      } catch {
        setFiles(files.filter((f) => !selected.has(f.path)));
      }
    } else {
      setFiles(files.filter((f) => !selected.has(f.path)));
    }

    setSelected(new Set());
    window.dispatchEvent(new Event("macsweep:disk-usage-refresh"));

    if (movedCount > 0 && failedCount === 0) {
      setFeedback({
        tone: "info",
        message: t("largeFiles.trashSuccess"),
      });
      return;
    }

    if (movedCount > 0) {
      setFeedback({
        tone: "warning",
        message: t("largeFiles.trashPartial"),
      });
      return;
    }

    setFeedback({
      tone: "error",
      message: t("largeFiles.trashFailed"),
    });
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">{t("largeFiles.title")}</h1>
          <p className="page-subtitle">{t("largeFiles.subtitle")}</p>
        </div>

        {feedback && (
          <ActionNotice tone={feedback.tone} message={feedback.message} />
        )}

        {!scanned && !isScanning && (
          <div className="scan-container">
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <FileSearch size={36} />
                  {t("common.scan")}
                </button>
              </div>
              <p className="scan-status">
                {t("largeFiles.scanStatus", { size: settings.minFileSize })}
              </p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="scan-container fade-in" style={{ minHeight: 300 }}>
            <PulseLoader label={t("largeFiles.scanning")} size="lg" />
            <ScanningLines />
          </div>
        )}

        {scanned && !isScanning && (
          <div className="fade-in">
            {files.length === 0 ? (
              <div className="empty-state">
                <FileSearch size={48} />
                <h3>{t("largeFiles.noLargeFiles")}</h3>
                <p>{t("largeFiles.diskOrganized")}</p>
              </div>
            ) : (
              <table className="file-list">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>{t("common.name")}</th>
                    <th>{t("common.size")}</th>
                    <th>{t("common.lastModified")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((file) => (
                    <tr key={file.path}>
                      <td>
                        <div
                          className={`checkbox ${selected.has(file.path) ? "checked" : ""}`}
                          onClick={() => toggleFile(file.path)}
                        >
                          {selected.has(file.path) && <Check size={12} />}
                        </div>
                      </td>
                      <td>
                        <div className="file-name">
                          <File
                            size={16}
                            style={{
                              color: getExtColor(file.extension),
                            }}
                          />
                          <span>{file.name}</span>
                          <span
                            className="file-ext-badge"
                            style={{
                              color: getExtColor(file.extension),
                            }}
                          >
                            {file.extension || "?"}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          fontWeight: 600,
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatBytes(file.size)}
                      </td>
                      <td
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "12px",
                        }}
                      >
                        {formatDate(file.lastModified)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {scanned && !isScanning && files.length > 0 && (
        <div className="page-actions-bar">
          <div className="toolbar">
            <div className="toolbar-left">
              <div
                className={`checkbox ${selected.size === files.length && files.length > 0 ? "checked" : ""}`}
                onClick={toggleAll}
              >
                {selected.size === files.length && files.length > 0 && (
                  <Check size={12} />
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {t("largeFiles.selectedInfo", { count: selected.size })}
                {selected.size > 0 && ` (${formatBytes(selectedSize)})`}
              </span>
            </div>
            <div className="toolbar-right">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  setSortBy(
                    sortBy === "size"
                      ? "date"
                      : sortBy === "date"
                        ? "name"
                        : "size",
                  )
                }
              >
                <ArrowUpDown size={14} />
                {sortBy === "size"
                  ? t("common.size")
                  : sortBy === "date"
                    ? t("common.date")
                    : t("common.name")}
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={selected.size === 0}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} />
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t("largeFiles.confirmTitle")}
        message={t("largeFiles.confirmMessage", {
          count: selected.size,
          size: formatBytes(selectedSize),
        })}
        confirmLabel={t("largeFiles.moveToTrash")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

function getMockData(): LargeFile[] {
  return [
    {
      path: "/Users/user/Downloads/movie.mp4",
      name: "movie.mp4",
      size: 4.2 * 1024 * 1024 * 1024,
      lastModified: "2025-08-15T10:30:00Z",
      extension: ".mp4",
    },
    {
      path: "/Users/user/Downloads/installer.dmg",
      name: "installer.dmg",
      size: 2.8 * 1024 * 1024 * 1024,
      lastModified: "2025-06-22T14:15:00Z",
      extension: ".dmg",
    },
    {
      path: "/Users/user/Documents/backup.zip",
      name: "backup.zip",
      size: 1.5 * 1024 * 1024 * 1024,
      lastModified: "2025-09-01T08:00:00Z",
      extension: ".zip",
    },
    {
      path: "/Users/user/Downloads/game.iso",
      name: "game.iso",
      size: 980 * 1024 * 1024,
      lastModified: "2025-04-10T16:45:00Z",
      extension: ".iso",
    },
    {
      path: "/Users/user/Videos/recording.mov",
      name: "recording.mov",
      size: 720 * 1024 * 1024,
      lastModified: "2025-11-28T09:20:00Z",
      extension: ".mov",
    },
    {
      path: "/Users/user/Downloads/photoshop.pkg",
      name: "photoshop.pkg",
      size: 580 * 1024 * 1024,
      lastModified: "2025-07-03T11:10:00Z",
      extension: ".pkg",
    },
    {
      path: "/Users/user/Documents/design.psd",
      name: "design.psd",
      size: 420 * 1024 * 1024,
      lastModified: "2025-12-15T13:30:00Z",
      extension: ".psd",
    },
    {
      path: "/Users/user/Downloads/archive.zip",
      name: "archive.zip",
      size: 350 * 1024 * 1024,
      lastModified: "2025-10-20T07:55:00Z",
      extension: ".zip",
    },
  ];
}
