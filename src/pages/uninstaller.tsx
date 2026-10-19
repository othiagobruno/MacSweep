import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Lock,
  ChevronRight,
  FolderSearch,
  Package,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "../components/checkbox";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PulseLoader } from "../components/loaders";
import {
  EmptyState,
  PageHeader,
  ScanHero,
  ScanningState,
} from "../components/page";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import { requestDiskRefresh } from "../lib/events";
import { daysSince, formatBytes, shortenPath, sumBy } from "../utils";
import type { AppInfo, AppLeftover } from "../types";

type Phase = "idle" | "scanning" | "results";
type SortKey = "size" | "name" | "unused";

const UNUSED_DAYS = 90;

interface Expanded {
  app: AppInfo;
  leftovers: AppLeftover[] | null;
  selected: Set<string>;
}

export function Uninstaller() {
  const { t } = useTranslation();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [expanded, setExpanded] = useState<Expanded | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function scan() {
    setPhase("scanning");
    setExpanded(null);
    try {
      setApps(await api.scan.applications());
    } catch {
      toast.show({ tone: "error", title: t("errors.scanFailed") });
    }
    setPhase("results");
  }

  // Load icons progressively after the list renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const app of apps) {
        if (cancelled) return;
        if (app.path in icons) continue;
        const icon = await api.apps.getIcon(app.path).catch(() => null);
        if (!cancelled) setIcons((prev) => ({ ...prev, [app.path]: icon }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps]);

  const visibleApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.bundleId ?? "").toLowerCase().includes(q),
    );
    return filtered.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "unused") {
        const da = daysSince(a.lastUsed) ?? Infinity;
        const db = daysSince(b.lastUsed) ?? Infinity;
        return db - da;
      }
      return b.size - a.size;
    });
  }, [apps, search, sortKey]);

  async function toggleApp(app: AppInfo) {
    if (expanded?.app.path === app.path) {
      setExpanded(null);
      return;
    }
    setExpanded({ app, leftovers: null, selected: new Set() });
    const leftovers = await api.apps.leftovers(app).catch(() => []);
    setExpanded((prev) =>
      prev?.app.path === app.path
        ? {
            app,
            leftovers,
            // Protected items can't be removed without Full Disk Access.
            selected: new Set(
              leftovers.filter((l) => !l.protected).map((l) => l.path),
            ),
          }
        : prev,
    );
  }

  function toggleLeftover(path: string) {
    setExpanded((prev) => {
      if (!prev) return prev;
      const selected = new Set(prev.selected);
      if (selected.has(path)) selected.delete(path);
      else selected.add(path);
      return { ...prev, selected };
    });
  }

  const selectedLeftovers =
    expanded?.leftovers?.filter((l) => expanded.selected.has(l.path)) ?? [];
  const totalToRemove =
    (expanded?.app.size ?? 0) + sumBy(selectedLeftovers, (l) => l.size);

  async function uninstall() {
    setConfirming(false);
    if (!expanded) return;
    const { app } = expanded;
    setRemoving(app.path);
    try {
      const result = await api.apps.uninstall({
        appPath: app.path,
        bundleId: app.bundleId,
        leftoverPaths: selectedLeftovers.map((l) => l.path),
      });
      if (result.success) {
        setApps((prev) => prev.filter((a) => a.path !== app.path));
        setExpanded(null);
        requestDiskRefresh();
        toast.show({
          tone: "success",
          title: t("uninstaller.success", { name: app.name }),
          message: t("uninstaller.successDesc", {
            size: formatBytes(result.freedSpace),
          }),
        });
      } else if (result.cancelled) {
        toast.show({ tone: "info", title: t("errors.adminCancelled") });
      } else {
        toast.show({
          tone: "error",
          title: t("uninstaller.failed", { name: app.name }),
          message: result.errors[0],
        });
      }
    } finally {
      setRemoving(null);
    }
  }

  function usageBadge(app: AppInfo) {
    const days = daysSince(app.lastUsed);
    if (days === null)
      return (
        <span className="tag tag-muted">{t("uninstaller.neverOpened")}</span>
      );
    if (days >= UNUSED_DAYS)
      return (
        <span className="tag tag-warning">
          {t("uninstaller.unused", { days })}
        </span>
      );
    return null;
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        {phase !== "idle" && (
          <PageHeader
            title={t("uninstaller.title")}
            subtitle={t("uninstaller.subtitle")}
            actions={
              phase === "results" && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={scan}
                  disabled={removing !== null}
                >
                  <RotateCcw size={14} />
                  {t("common.rescan")}
                </button>
              )
            }
          />
        )}

        {phase === "idle" && <ScanHero page="uninstaller" onScan={scan} />}

        {phase === "scanning" && (
          <ScanningState page="uninstaller" label={t("uninstaller.scanning")} />
        )}

        {phase === "results" && (
          <div className="fade-in">
            <div className="filter-row">
              <div className="search-bar search-bar-inline">
                <Search size={16} />
                <input
                  type="search"
                  placeholder={t("uninstaller.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="chip-group">
                {(["size", "name", "unused"] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    className={`chip ${sortKey === key ? "active" : ""}`}
                    aria-pressed={sortKey === key}
                    onClick={() => setSortKey(key)}
                  >
                    {t(
                      `uninstaller.sort${key[0].toUpperCase()}${key.slice(1)}`,
                    )}
                  </button>
                ))}
              </div>
            </div>

            <p className="list-caption">
              {t("uninstaller.applications", { count: visibleApps.length })} ·{" "}
              {formatBytes(sumBy(visibleApps, (a) => a.size))}
            </p>

            {visibleApps.length === 0 ? (
              <EmptyState
                icon={<Package size={48} />}
                title={t("uninstaller.noApps")}
                message={t("uninstaller.tryDifferent")}
              />
            ) : (
              <div className="results-container">
                {visibleApps.map((app) => {
                  const isOpen = expanded?.app.path === app.path;
                  const icon = icons[app.path];
                  return (
                    <div
                      key={app.path}
                      className={`app-row ${isOpen ? "open" : ""}`}
                    >
                      <button
                        className="result-row app-row-head"
                        onClick={() => toggleApp(app)}
                        aria-expanded={isOpen}
                      >
                        <div className="result-row-left">
                          <div
                            className={`result-row-icon ${icon ? "has-image" : ""}`}
                          >
                            {icon ? (
                              <img src={icon} alt="" width={36} height={36} />
                            ) : (
                              <Box size={20} />
                            )}
                          </div>
                          <div className="result-row-info">
                            <h4>
                              {app.name}
                              {app.version && (
                                <span className="app-version">
                                  {app.version}
                                </span>
                              )}
                            </h4>
                            <p className="mono-path">
                              {app.bundleId ?? shortenPath(app.path)}
                            </p>
                          </div>
                        </div>
                        <div className="result-row-right">
                          {usageBadge(app)}
                          <span className="result-size">
                            {formatBytes(app.size)}
                          </span>
                          <ChevronRight
                            size={16}
                            className={`file-tree-chevron ${isOpen ? "rotated" : ""}`}
                          />
                        </div>
                      </button>

                      {isOpen && expanded && (
                        <div className="app-row-detail fade-in">
                          <div className="leftover-row static">
                            <Checkbox
                              checked
                              disabled
                              onChange={() => undefined}
                              label={app.name}
                            />
                            <span className="leftover-kind">
                              {t("uninstaller.appBundle")}
                            </span>
                            <span className="leftover-path" title={app.path}>
                              {shortenPath(app.path)}
                            </span>
                            <span className="leftover-size">
                              {formatBytes(app.size)}
                            </span>
                          </div>

                          <div className="leftover-title">
                            {t("uninstaller.leftovers")}
                          </div>
                          {expanded.leftovers === null ? (
                            <PulseLoader
                              label={t("uninstaller.findingLeftovers")}
                              size="sm"
                            />
                          ) : expanded.leftovers.length === 0 ? (
                            <p className="leftover-empty">
                              {t("uninstaller.noLeftovers")}
                            </p>
                          ) : (
                            expanded.leftovers.map((l) => (
                              <div
                                key={l.path}
                                className="leftover-row"
                                onClick={() => toggleLeftover(l.path)}
                              >
                                <Checkbox
                                  checked={expanded.selected.has(l.path)}
                                  onChange={() => toggleLeftover(l.path)}
                                  label={l.path}
                                />
                                <span className="leftover-kind">
                                  {t(`uninstaller.kinds.${l.kind}`)}
                                </span>
                                <span className="leftover-path" title={l.path}>
                                  {shortenPath(l.path)}
                                </span>
                                <button
                                  className="icon-btn"
                                  title={t("common.revealInFinder")}
                                  aria-label={t("common.revealInFinder")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void api.shell.revealInFinder(l.path);
                                  }}
                                >
                                  <FolderSearch size={14} />
                                </button>
                                {l.protected ? (
                                  <button
                                    className="tag tag-muted leftover-protected"
                                    title={t("errors.fullDiskAccessDesc")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void api.shell.openFullDiskAccessSettings();
                                    }}
                                  >
                                    <Lock size={10} />
                                    {t("uninstaller.protected")}
                                  </button>
                                ) : (
                                  <span className="leftover-size">
                                    {formatBytes(l.size)}
                                  </span>
                                )}
                              </div>
                            ))
                          )}

                          <div className="app-row-actions">
                            <span className="toolbar-info">
                              {t("uninstaller.total", {
                                size: formatBytes(totalToRemove),
                              })}
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={
                                removing !== null || expanded.leftovers === null
                              }
                              onClick={() => setConfirming(true)}
                            >
                              {removing === app.path ? (
                                <PulseLoader size="sm" />
                              ) : (
                                <>
                                  <Trash2 size={14} />
                                  {t("uninstaller.uninstall")}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirming && expanded !== null}
        title={t("uninstaller.confirmTitle", {
          name: expanded?.app.name ?? "",
        })}
        message={t("uninstaller.confirmMessage", {
          name: expanded?.app.name ?? "",
          count: selectedLeftovers.length,
          size: formatBytes(totalToRemove),
        })}
        confirmLabel={t("uninstaller.uninstall")}
        variant="danger"
        onConfirm={uninstall}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
