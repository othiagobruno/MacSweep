import { useState, useEffect } from "react";
import { Sidebar } from "./components/sidebar";
import { SmartScan } from "./pages/smart-scan";
import { SystemJunk } from "./pages/system-junk";
import { LargeFiles } from "./pages/large-files";
import { Performance } from "./pages/performance";
import { Uninstaller } from "./pages/uninstaller";
import { Maintenance } from "./pages/maintenance";
import { StartupItems } from "./pages/startup-items";
import { AppStateProvider } from "./contexts/app-state-context";
import type { Page, DiskUsage } from "./types";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("smart-scan");
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);

  useEffect(() => {
    const fetchDisk = async () => {
      try {
        if (window.electronAPI) {
          const disk = await window.electronAPI.system.diskUsage();
          setDiskUsage(disk);
        }
      } catch {
        setDiskUsage({
          total: 500 * 1024 * 1024 * 1024,
          used: 320 * 1024 * 1024 * 1024,
          free: 180 * 1024 * 1024 * 1024,
          percentUsed: 64,
          mount: "/",
        });
      }
    };
    fetchDisk();
  }, []);

  return (
    <AppStateProvider>
      <div className="app-layout">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          diskUsage={diskUsage}
        />
        <main className="main-content">
          <div
            style={{
              display: currentPage === "smart-scan" ? "block" : "none",
              height: "100%",
            }}
          >
            <SmartScan />
          </div>
          <div
            style={{
              display: currentPage === "system-junk" ? "block" : "none",
              height: "100%",
            }}
          >
            <SystemJunk />
          </div>
          <div
            style={{
              display: currentPage === "large-files" ? "block" : "none",
              height: "100%",
            }}
          >
            <LargeFiles />
          </div>
          <div
            style={{
              display: currentPage === "performance" ? "block" : "none",
              height: "100%",
            }}
          >
            <Performance />
          </div>
          <div
            style={{
              display: currentPage === "uninstaller" ? "block" : "none",
              height: "100%",
            }}
          >
            <Uninstaller />
          </div>
          <div
            style={{
              display: currentPage === "maintenance" ? "block" : "none",
              height: "100%",
            }}
          >
            <Maintenance />
          </div>
          <div
            style={{
              display: currentPage === "startup-items" ? "block" : "none",
              height: "100%",
            }}
          >
            <StartupItems />
          </div>
        </main>
      </div>
    </AppStateProvider>
  );
}

export default App;
