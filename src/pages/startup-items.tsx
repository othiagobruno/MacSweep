import { useEffect, useMemo, useState } from "react";
import {
  FolderSearch,
  Power,
  RotateCcw,
  Search,
  Shield,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "../components/checkbox";
import {
  EmptyState,
  PageHeader,
  ScanHero,
  ScanningState,
} from "../components/page";
import { useToast } from "../components/toast";
import { api } from "../lib/api";
import type { StartupItem } from "../types";

type Phase = "idle" | "scanning" | "results";
type Filter = "all" | "enabled" | "disabled";

/** Truncate a long path keeping the start and end visible. */
function truncatePath(p: string, maxLen = 60): string {
  if (!p || p.length <= maxLen) return p;
  return `${p.slice(0, 25)}…${p.slice(-30)}`;
}

export function StartupItems() {
  const { t } = useTranslation();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState<StartupItem[]>([]);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  async function scan() {
    setPhase("scanning");
    try {
      setItems(await api.scan.startupItems());
    } catch {
      toast.show({ tone: "error", title: t("errors.scanFailed") });
    }
    setPhase("results");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const item of items) {
        if (cancelled) return;
        if (!item.appPath || item.appPath in icons) continue;
        const icon = await api.apps.getIcon(item.appPath).catch(() => null);
        if (!cancelled)
          setIcons((prev) => ({ ...prev, [item.appPath!]: icon }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function setEnabled(item: StartupItem, enabled: boolean) {
    setToggling((prev) => new Set(prev).add(item.path));
    try {
      const result = await api.startup.setEnabled(item, enabled);
      if (result.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.path === item.path ? { ...i, isEnabled: enabled } : i,
          ),
        );
        toast.show({
          tone: "success",
          title: t(enabled ? "startupItems.enabled" : "startupItems.disabled", {
            name: item.name,
          }),
          duration: 2500,
        });
      } else if (result.cancelled) {
        toast.show({ tone: "info", title: t("errors.adminCancelled") });
      } else {
        toast.show({
          tone: "error",
          title: t("startupItems.toggleFailed", { name: item.name }),
          message: result.error,
        });
      }
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(item.path);
        return next;
      });
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (filter === "all" || (filter === "enabled") === item.isEnabled) &&
        (!q ||
          item.name.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q) ||
          item.programPath.toLowerCase().includes(q)),
    );
  }, [items, search, filter]);

  const enabledCount = items.filter((i) => i.isEnabled).length;

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <PageHeader
          title={t("startupItems.title")}
          subtitle={t("startupItems.subtitle")}
          actions={
            phase === "results" && (
              <button className="btn btn-sm btn-secondary" onClick={scan}>
                <RotateCcw size={14} />
                {t("common.rescan")}
              </button>
            )
          }
        />

        {phase === "idle" && (
          <ScanHero
            icon={<Power size={36} />}
            label={t("common.scan")}
            hint={t("startupItems.scanStatus")}
            onScan={scan}
          />
        )}

        {phase === "scanning" && (
          <ScanningState label={t("startupItems.scanning")} />
        )}

        {phase === "results" && (
          <div className="fade-in">
            <div className="filter-row">
              <div className="search-bar search-bar-inline">
                <Search size={16} />
                <input
                  type="search"
                  placeholder={t("startupItems.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="chip-group">
                {(["all", "enabled", "disabled"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    className={`chip ${filter === f ? "active" : ""}`}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {t(`startupItems.filter${f[0].toUpperCase()}${f.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            <p className="list-caption">
              {t("startupItems.itemsInfo", {
                count: items.length,
                enabled: enabledCount,
              })}
            </p>

            {visible.length === 0 ? (
              <EmptyState
                icon={<Power size={48} />}
                title={t("startupItems.noItems")}
                message={t("startupItems.tryDifferent")}
              />
            ) : (
              <div className="results-container">
                {visible.map((item) => {
                  const icon = item.appPath ? icons[item.appPath] : null;
                  const isDaemon = item.kind === "LaunchDaemon";
                  return (
                    <div
                      key={item.path}
                      className={`result-row ${item.isEnabled ? "" : "is-disabled"}`}
                    >
                      <div className="result-row-left">
                        <div
                          className={`result-row-icon ${icon ? "has-image" : isDaemon ? "tone-danger" : ""}`}
                        >
                          {icon ? (
                            <img src={icon} alt="" width={36} height={36} />
                          ) : isDaemon ? (
                            <Shield size={20} />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div className="result-row-info">
                          <h4>{item.name}</h4>
                          <div className="startup-meta">
                            <span
                              className={`startup-kind-badge ${isDaemon ? "daemon" : "agent"}`}
                            >
                              {isDaemon
                                ? t("startupItems.daemon")
                                : t("startupItems.agent")}
                            </span>
                            <span
                              className="startup-path-truncated"
                              title={item.programPath || item.path}
                            >
                              {truncatePath(item.programPath || item.label)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="result-row-right">
                        <button
                          className="icon-btn"
                          title={t("common.revealInFinder")}
                          aria-label={t("common.revealInFinder")}
                          onClick={() =>
                            void api.shell.revealInFinder(item.path)
                          }
                        >
                          <FolderSearch size={14} />
                        </button>
                        <Switch
                          checked={item.isEnabled}
                          busy={toggling.has(item.path)}
                          label={t("startupItems.toggleLabel", {
                            name: item.name,
                          })}
                          onChange={(value) => void setEnabled(item, value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
