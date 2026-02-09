import { useState } from "react";
import { FileSearch, Trash2, Check, ArrowUpDown, File } from "lucide-react";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PulseLoader, ScanningLines } from "../components/loaders";
import { formatBytes, formatDate, getExtColor } from "../utils";
import { useAppState } from "../contexts/app-state-context";
import type { LargeFile } from "../types";

export function LargeFiles() {
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleScan() {
    setIsScanning(true);
    setScanned(false);

    try {
      let results: LargeFile[];
      if (window.electronAPI) {
        results = await window.electronAPI.scan.largeFiles();
      } else {
        await new Promise((r) => setTimeout(r, 3000));
        results = getMockData();
      }
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

    if (window.electronAPI) {
      const paths = Array.from(selected);
      try {
        for (const p of paths) {
          await window.electronAPI.shell.moveToTrash(p);
        }
      } catch {
        // continue
      }
    }

    setFiles(files.filter((f) => !selected.has(f.path)));
    setSelected(new Set());
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">Large & Old Files</h1>
          <p className="page-subtitle">
            Find large files taking up space on your disk
          </p>
        </div>

        {!scanned && !isScanning && (
          <div className="scan-container">
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <FileSearch size={36} />
                  Scan
                </button>
              </div>
              <p className="scan-status">Find files larger than 50MB</p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="scan-container fade-in" style={{ minHeight: 300 }}>
            <PulseLoader label="Scanning for large files..." size="lg" />
            <ScanningLines />
          </div>
        )}

        {scanned && !isScanning && (
          <div className="fade-in">
            {files.length === 0 ? (
              <div className="empty-state">
                <FileSearch size={48} />
                <h3>No large files found</h3>
                <p>Your disk is well organized!</p>
              </div>
            ) : (
              <table className="file-list">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Last Modified</th>
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
                {selected.size} selected
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
                  ? "Size"
                  : sortBy === "date"
                    ? "Date"
                    : "Name"}
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={selected.size === 0}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Move to Trash?"
        message={`${selected.size} files (${formatBytes(selectedSize)}) will be moved to the Trash.`}
        confirmLabel="Move to Trash"
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
