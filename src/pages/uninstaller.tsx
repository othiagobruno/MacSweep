import { useState } from "react";
import { Package, Search, Trash2, Box, Check } from "lucide-react";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PulseLoader, ScanningLines } from "../components/loaders";
import { formatBytes } from "../utils";
import { useAppState } from "../contexts/app-state-context";
import type { AppInfo } from "../types";

export function Uninstaller() {
  const {
    uninstaller: {
      isScanning,
      setIsScanning,
      apps,
      setApps,
      search,
      setSearch,
      selected,
      setSelected,
      scanned,
      setScanned,
    },
  } = useAppState();

  const [showConfirm, setShowConfirm] = useState(false);

  async function handleScan() {
    setIsScanning(true);

    try {
      let results: AppInfo[];
      if (window.electronAPI) {
        results = await window.electronAPI.scan.applications();
      } else {
        await new Promise((r) => setTimeout(r, 2000));
        results = getMockApps();
      }
      setApps(results.map((a) => ({ ...a, iconDataUrl: null })));
      setScanned(true);

      // Load icons in background
      if (window.electronAPI?.app?.getIcon) {
        for (const app of results) {
          try {
            const icon = await window.electronAPI.app.getIcon(app.path);
            setApps((prev) =>
              prev.map((a) =>
                a.path === app.path ? { ...a, iconDataUrl: icon } : a,
              ),
            );
          } catch {
            // skip
          }
        }
      }
    } catch {
      setApps(getMockApps());
      setScanned(true);
    }

    setIsScanning(false);
  }

  function toggleApp(path: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelected(newSelected);
  }

  function toggleAll() {
    if (selected.size === filteredApps.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredApps.map((a) => a.path)));
    }
  }

  const filteredApps = apps
    .filter((app) => app.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.size - a.size);

  const selectedSize = apps
    .filter((a) => selected.has(a.path))
    .reduce((sum, a) => sum + a.size, 0);

  async function handleUninstall() {
    setShowConfirm(false);

    if (window.electronAPI) {
      const paths = Array.from(selected);
      try {
        const result = await window.electronAPI.shell.forceDelete(paths);
        if (!result.success) {
          // User cancelled auth or partial failure — don't remove from list
          return;
        }
      } catch {
        return;
      }
    }

    setApps(apps.filter((a) => !selected.has(a.path)));
    setSelected(new Set());
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">Uninstaller</h1>
          <p className="page-subtitle">
            Completely remove applications and their data
          </p>
        </div>

        {!scanned && !isScanning && (
          <div className="scan-container">
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <Package size={36} />
                  Scan
                </button>
              </div>
              <p className="scan-status">List all installed applications</p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="scan-container fade-in" style={{ minHeight: 300 }}>
            <PulseLoader label="Scanning applications..." size="lg" />
            <ScanningLines />
          </div>
        )}

        {scanned && !isScanning && (
          <div className="fade-in">
            <div className="search-bar">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search applications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filteredApps.length === 0 ? (
              <div className="empty-state">
                <Package size={48} />
                <h3>No applications found</h3>
                <p>Try a different search term</p>
              </div>
            ) : (
              <div className="results-container">
                {filteredApps.map((app) => (
                  <div
                    key={app.path}
                    className="result-row"
                    onClick={() => toggleApp(app.path)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="result-row-left">
                      <div
                        className={`checkbox ${
                          selected.has(app.path) ? "checked" : ""
                        }`}
                      >
                        {selected.has(app.path) && <Check size={12} />}
                      </div>
                      <div
                        className="result-row-icon"
                        style={{
                          background: app.iconDataUrl
                            ? "transparent"
                            : undefined,
                          overflow: "hidden",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        {app.iconDataUrl ? (
                          <img
                            src={app.iconDataUrl}
                            alt={app.name}
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <Box size={20} />
                        )}
                      </div>
                      <div className="result-row-info">
                        <h4>{app.name}</h4>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          {app.path}
                        </p>
                      </div>
                    </div>
                    <div className="result-row-right">
                      <span className="result-size">
                        {formatBytes(app.size)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {scanned && !isScanning && filteredApps.length > 0 && (
        <div className="page-actions-bar">
          <div className="toolbar">
            <div className="toolbar-left">
              <div
                className={`checkbox ${
                  selected.size === filteredApps.length &&
                  filteredApps.length > 0
                    ? "checked"
                    : ""
                }`}
                onClick={toggleAll}
              >
                {selected.size === filteredApps.length &&
                  filteredApps.length > 0 && <Check size={12} />}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {filteredApps.length} applications
                {selected.size > 0 &&
                  ` • ${selected.size} selected (${formatBytes(selectedSize)})`}
              </span>
            </div>
            <div className="toolbar-right">
              {selected.size > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowConfirm(true)}
                >
                  <Trash2 size={14} />
                  Uninstall ({selected.size})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title={`Uninstall ${selected.size} application${selected.size > 1 ? "s" : ""}?`}
        message={`This will permanently delete ${selected.size} app${selected.size > 1 ? "s" : ""} (${formatBytes(selectedSize)}). Your administrator password will be required. This action cannot be undone.`}
        confirmLabel="Uninstall"
        variant="danger"
        onConfirm={handleUninstall}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

function getMockApps(): AppInfo[] {
  return [
    {
      name: "Xcode",
      path: "/Applications/Xcode.app",
      size: 12.5 * 1024 * 1024 * 1024,
    },
    {
      name: "Adobe Photoshop",
      path: "/Applications/Adobe Photoshop.app",
      size: 3.2 * 1024 * 1024 * 1024,
    },
    {
      name: "Docker",
      path: "/Applications/Docker.app",
      size: 2.8 * 1024 * 1024 * 1024,
    },
    {
      name: "Google Chrome",
      path: "/Applications/Google Chrome.app",
      size: 1.2 * 1024 * 1024 * 1024,
    },
    {
      name: "Visual Studio Code",
      path: "/Applications/Visual Studio Code.app",
      size: 890 * 1024 * 1024,
    },
    {
      name: "Slack",
      path: "/Applications/Slack.app",
      size: 650 * 1024 * 1024,
    },
    {
      name: "Spotify",
      path: "/Applications/Spotify.app",
      size: 480 * 1024 * 1024,
    },
    {
      name: "Discord",
      path: "/Applications/Discord.app",
      size: 420 * 1024 * 1024,
    },
    {
      name: "Figma",
      path: "/Applications/Figma.app",
      size: 350 * 1024 * 1024,
    },
    {
      name: "iTerm",
      path: "/Applications/iTerm.app",
      size: 120 * 1024 * 1024,
    },
    {
      name: "Notion",
      path: "/Applications/Notion.app",
      size: 280 * 1024 * 1024,
    },
    {
      name: "Postman",
      path: "/Applications/Postman.app",
      size: 510 * 1024 * 1024,
    },
  ];
}
