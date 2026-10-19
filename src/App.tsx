import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./components/sidebar";
import { ErrorBoundary } from "./components/error-boundary";
import { ToastProvider } from "./components/toast";
import { SmartScan } from "./pages/smart-scan";
import { SystemJunk } from "./pages/system-junk";
import { LargeFiles } from "./pages/large-files";
import { Performance } from "./pages/performance";
import { Uninstaller } from "./pages/uninstaller";
import { Maintenance } from "./pages/maintenance";
import { StartupItems } from "./pages/startup-items";
import { Settings } from "./pages/settings";
import { SettingsProvider } from "./contexts/settings-context";
import { NavigationContext } from "./contexts/navigation-context";
import { usePolling } from "./hooks/use-polling";
import { api, isElectron } from "./lib/api";
import { DISK_REFRESH_EVENT } from "./lib/events";
import { moduleStyle } from "./lib/modules";
import type { AppStats, DiskUsage, Page } from "./types";

const PAGE_COMPONENTS: Record<Page, ComponentType> = {
  "smart-scan": SmartScan,
  "system-junk": SystemJunk,
  "large-files": LargeFiles,
  performance: Performance,
  uninstaller: Uninstaller,
  maintenance: Maintenance,
  "startup-items": StartupItems,
  settings: Settings,
};

function AppShell() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<Page>("smart-scan");
  // Pages mount on first visit and then stay mounted, so their state
  // (scan results, selections) survives navigation.
  const [visited, setVisited] = useState<Set<Page>>(() => new Set(["smart-scan"]));
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page);
    setVisited((prev) => (prev.has(page) ? prev : new Set(prev).add(page)));
  }, []);

  const refreshDisk = useCallback(async () => {
    setDiskUsage(await api.system.diskUsage());
  }, []);

  usePolling(refreshDisk, 30_000);

  useEffect(() => {
    const onRefresh = () => void refreshDisk();
    window.addEventListener(DISK_REFRESH_EVENT, onRefresh);
    const offNavigate = api.app.onNavigate(navigate);
    const offStats = api.app.onStatsChanged(setStats);
    void api.app.stats().then(setStats);
    return () => {
      window.removeEventListener(DISK_REFRESH_EVENT, onRefresh);
      offNavigate();
      offStats();
    };
  }, [navigate, refreshDisk]);

  const navigation = useMemo(() => ({ currentPage, navigate }), [currentPage, navigate]);

  return (
    <NavigationContext.Provider value={navigation}>
      <div className="app-layout">
        <Sidebar
          currentPage={currentPage}
          onNavigate={navigate}
          diskUsage={diskUsage}
          junkBadge={stats?.lastScanJunkSize ?? 0}
        />
        <main
          className="main-content"
          data-module={currentPage}
          style={moduleStyle(currentPage) as React.CSSProperties}
        >
          <div className="ambient" aria-hidden="true">
            <span className="ambient-blob a" />
            <span className="ambient-blob b" />
            <span className="ambient-blob c" />
          </div>
          {!isElectron && <div className="preview-banner">{t("common.previewMode")}</div>}
          {(Object.keys(PAGE_COMPONENTS) as Page[]).map((page) => {
            if (!visited.has(page)) return null;
            const PageComponent = PAGE_COMPONENTS[page];
            return (
              <section
                key={page}
                className="page-slot"
                hidden={currentPage !== page}
                aria-hidden={currentPage !== page}
              >
                <ErrorBoundary>
                  <PageComponent />
                </ErrorBoundary>
              </section>
            );
          })}
        </main>
      </div>
    </NavigationContext.Provider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </SettingsProvider>
  );
}
