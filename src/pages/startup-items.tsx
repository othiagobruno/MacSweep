import { useState } from "react";
import { Power, Search, Check, Shield, User } from "lucide-react";
import { PulseLoader, ScanningLines } from "../components/loaders";
import { useAppState } from "../contexts/app-state-context";
import type { StartupItem } from "../types";

interface StartupItemWithIcon extends StartupItem {
  iconDataUrl?: string | null;
}

/**
 * Truncate a long path keeping the start and end visible.
 */
function truncatePath(p: string, maxLen = 60): string {
  if (!p || p.length <= maxLen) return p;
  const start = p.slice(0, 25);
  const end = p.slice(-30);
  return `${start}…${end}`;
}

export function StartupItems() {
  const {
    startupItems: {
      isScanning,
      setIsScanning,
      items,
      setItems,
      search,
      setSearch,
      scanned,
      setScanned,
    },
  } = useAppState();

  const [togglingPaths, setTogglingPaths] = useState<Set<string>>(new Set());

  async function handleScan() {
    setIsScanning(true);

    try {
      let results: StartupItem[];
      if (window.electronAPI) {
        results = await window.electronAPI.scan.startupItems();
      } else {
        await new Promise((r) => setTimeout(r, 2000));
        results = getMockItems();
      }
      setItems(results.map((i) => ({ ...i, iconDataUrl: null })));
      setScanned(true);

      // Load icons in background for items with appPath
      if (window.electronAPI?.app?.getIcon) {
        for (const item of results) {
          if (!item.appPath) continue;
          try {
            const icon = await window.electronAPI.app.getIcon(item.appPath);
            setItems((prev: StartupItemWithIcon[]) =>
              prev.map((i: StartupItemWithIcon) =>
                i.path === item.path ? { ...i, iconDataUrl: icon } : i,
              ),
            );
          } catch {
            // skip
          }
        }
      }
    } catch {
      setItems(getMockItems());
      setScanned(true);
    }

    setIsScanning(false);
  }

  async function toggleEnabled(item: StartupItemWithIcon) {
    if (togglingPaths.has(item.path)) return;

    setTogglingPaths((prev) => new Set(prev).add(item.path));

    try {
      if (window.electronAPI) {
        const result = item.isEnabled
          ? await window.electronAPI.startup.disableItem(item.path)
          : await window.electronAPI.startup.enableItem(item.path);

        if (result.success) {
          setItems((prev: StartupItemWithIcon[]) =>
            prev.map((i: StartupItemWithIcon) =>
              i.path === item.path ? { ...i, isEnabled: !i.isEnabled } : i,
            ),
          );
        }
      } else {
        // Mock mode
        setItems((prev: StartupItemWithIcon[]) =>
          prev.map((i: StartupItemWithIcon) =>
            i.path === item.path ? { ...i, isEnabled: !i.isEnabled } : i,
          ),
        );
      }
    } catch {
      // failed
    }

    setTogglingPaths((prev) => {
      const next = new Set(prev);
      next.delete(item.path);
      return next;
    });
  }

  const filteredItems = (items as StartupItemWithIcon[]).filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.programPath.toLowerCase().includes(search.toLowerCase()),
  );

  const enabledCount = filteredItems.filter((i) => i.isEnabled).length;

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">Startup Items</h1>
          <p className="page-subtitle">
            Manage programs that launch when your Mac starts up
          </p>
        </div>

        {!scanned && !isScanning && (
          <div className="scan-container">
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <Power size={36} />
                  Scan
                </button>
              </div>
              <p className="scan-status">List all startup and login items</p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="scan-container fade-in" style={{ minHeight: 300 }}>
            <PulseLoader label="Scanning startup items..." size="lg" />
            <ScanningLines />
          </div>
        )}

        {scanned && !isScanning && (
          <div className="fade-in">
            <div className="search-bar">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search startup items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <Power size={48} />
                <h3>No startup items found</h3>
                <p>Try a different search term</p>
              </div>
            ) : (
              <div className="results-container">
                {filteredItems.map((item) => (
                  <div
                    key={item.path}
                    className="result-row"
                    style={{
                      opacity: item.isEnabled ? 1 : 0.6,
                    }}
                  >
                    <div className="result-row-left">
                      <div
                        className="result-row-icon"
                        style={{
                          background: item.iconDataUrl
                            ? "transparent"
                            : item.kind === "LaunchDaemon"
                              ? "rgba(255, 107, 129, 0.15)"
                              : "rgba(108, 92, 231, 0.15)",
                          overflow: "hidden",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        {item.iconDataUrl ? (
                          <img
                            src={item.iconDataUrl}
                            alt={item.name}
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: "contain",
                            }}
                          />
                        ) : item.kind === "LaunchDaemon" ? (
                          <Shield
                            size={20}
                            style={{
                              color: "var(--danger)",
                            }}
                          />
                        ) : (
                          <User
                            size={20}
                            style={{
                              color: "var(--accent-secondary)",
                            }}
                          />
                        )}
                      </div>
                      <div className="result-row-info">
                        <h4>{item.name}</h4>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 2,
                          }}
                        >
                          <span
                            className={`startup-kind-badge ${
                              item.kind === "LaunchDaemon" ? "daemon" : "agent"
                            }`}
                          >
                            {item.kind === "LaunchDaemon" ? "Daemon" : "Agent"}
                          </span>
                          <span
                            className="startup-path-truncated"
                            title={item.programPath || item.path}
                          >
                            {truncatePath(item.programPath || item.path)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="result-row-right">
                      <div
                        className={`startup-toggle ${item.isEnabled ? "on" : "off"} ${togglingPaths.has(item.path) ? "toggling" : ""}`}
                        onClick={() => toggleEnabled(item)}
                      >
                        <div className="startup-toggle-thumb" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {scanned && !isScanning && filteredItems.length > 0 && (
        <div className="page-actions-bar">
          <div className="toolbar">
            <div className="toolbar-left">
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {filteredItems.length} startup items • {enabledCount} enabled
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getMockItems(): StartupItemWithIcon[] {
  return [
    {
      name: "Docker Helper",
      path: "~/Library/LaunchAgents/com.docker.helper.plist",
      programPath: "/Applications/Docker.app/Contents/MacOS/com.docker.helper",
      kind: "LaunchAgent",
      isEnabled: true,
      appPath: "/Applications/Docker.app",
      iconDataUrl: null,
    },
    {
      name: "Google Software Update",
      path: "~/Library/LaunchAgents/com.google.keystone.agent.plist",
      programPath:
        "/Library/Google/GoogleSoftwareUpdate/GoogleSoftwareUpdate.bundle/Contents/Resources/GoogleSoftwareUpdateAgent.app/Contents/MacOS/GoogleSoftwareUpdateAgent",
      kind: "LaunchAgent",
      isEnabled: true,
      appPath: null,
      iconDataUrl: null,
    },
    {
      name: "Spotify Web Helper",
      path: "~/Library/LaunchAgents/com.spotify.webhelper.plist",
      programPath: "/Applications/Spotify.app/Contents/MacOS/SpotifyWebHelper",
      kind: "LaunchAgent",
      isEnabled: true,
      appPath: "/Applications/Spotify.app",
      iconDataUrl: null,
    },
    {
      name: "Creative Cloud Helper",
      path: "/Library/LaunchAgents/com.adobe.AdobeCreativeCloud.plist",
      programPath:
        "/Applications/Utilities/Adobe Creative Cloud/ACC/Creative Cloud Helper.app/Contents/MacOS/Creative Cloud Helper",
      kind: "LaunchAgent",
      isEnabled: true,
      appPath:
        "/Applications/Utilities/Adobe Creative Cloud/ACC/Creative Cloud Helper.app",
      iconDataUrl: null,
    },
    {
      name: "Microsoft Update Assistant",
      path: "/Library/LaunchAgents/com.microsoft.update.agent.plist",
      programPath:
        "/Library/Application Support/Microsoft/MAU2.0/Microsoft AutoUpdate.app/Contents/MacOS/Microsoft Update Assistant.app/Contents/MacOS/Microsoft Update Assistant",
      kind: "LaunchAgent",
      isEnabled: false,
      appPath:
        "/Library/Application Support/Microsoft/MAU2.0/Microsoft AutoUpdate.app",
      iconDataUrl: null,
    },
    {
      name: "Installer OS Message Tracing",
      path: "/Library/LaunchDaemons/com.apple.installer.osmessagetracing.plist",
      programPath: "/usr/sbin/osmessagetracing",
      kind: "LaunchDaemon",
      isEnabled: true,
      appPath: null,
      iconDataUrl: null,
    },
    {
      name: "CCC Scheduled Task",
      path: "/Library/LaunchDaemons/com.bombich.ccc.scheduledtask.plist",
      programPath:
        "/Library/PrivilegedHelperTools/com.bombich.ccc.scheduledtask",
      kind: "LaunchDaemon",
      isEnabled: true,
      appPath: null,
      iconDataUrl: null,
    },
    {
      name: "VirtualBox Startup",
      path: "/Library/LaunchDaemons/org.virtualbox.startup.plist",
      programPath:
        "/Library/Application Support/VirtualBox/LaunchDaemons/VirtualBoxStartup.sh",
      kind: "LaunchDaemon",
      isEnabled: false,
      appPath: null,
      iconDataUrl: null,
    },
  ];
}
