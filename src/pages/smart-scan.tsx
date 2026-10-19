import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  HardDrive,
  MemoryStick,
  Power,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "../components/checkbox";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FullDiskAccessNotice } from "../components/full-disk-access-notice";
import { JunkIcon } from "../components/junk-meta";
import { AnimatedNumber } from "../components/animated-number";
import { PulseLoader } from "../components/loaders";
import { ModuleArt } from "../components/module-art";
import { PageHeader, ScanHero, ScanningState } from "../components/page";
import { useToast } from "../components/toast";
import { useNavigation } from "../contexts/navigation-context";
import { useCleaner } from "../hooks/use-cleaner";
import { api } from "../lib/api";
import { formatBytes, formatRelative, sumBy } from "../utils";
import type {
  AppStats,
  DiskUsage,
  JunkCategoryId,
  MemoryUsage,
  SystemJunkResult,
} from "../types";

type Phase = "idle" | "scanning" | "results" | "cleaned";

interface Health {
  memory: MemoryUsage | null;
  disk: DiskUsage | null;
  startupEnabled: number | null;
}

export function SmartScan() {
  const { t, i18n } = useTranslation();
  const { navigate } = useNavigation();
  const toast = useToast();
  const { clean, isCleaning, dialog } = useCleaner();

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [currentCategory, setCurrentCategory] = useState<JunkCategoryId | null>(
    null,
  );
  const [junk, setJunk] = useState<SystemJunkResult[]>([]);
  const [selected, setSelected] = useState<Set<JunkCategoryId>>(new Set());
  const [health, setHealth] = useState<Health>({
    memory: null,
    disk: null,
    startupEnabled: null,
  });
  const [freed, setFreed] = useState(0);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    void api.app.stats().then(setStats);
    return api.app.onStatsChanged(setStats);
  }, []);

  const cleanable = junk.filter((c) => c.files.length > 0);
  const accessDenied = junk.some((c) => c.accessDenied);
  const selectedCats = cleanable.filter((c) => selected.has(c.id));
  const selectedSize = sumBy(selectedCats, (c) => c.totalSize);
  const totalSize = sumBy(cleanable, (c) => c.totalSize);

  async function handleScan() {
    setPhase("scanning");
    setProgress(0);
    setCurrentCategory(null);
    const off = api.scan.onProgress((p) => {
      setProgress(p.progress);
      setCurrentCategory(p.categoryId ?? null);
    });

    try {
      const [junkResults, memory, disk, startup] = await Promise.all([
        api.scan.systemJunk(),
        api.system.memoryUsage().catch(() => null),
        api.system.diskUsage().catch(() => null),
        api.scan.startupItems().catch(() => null),
      ]);
      setJunk(junkResults);
      setSelected(
        new Set(junkResults.filter((c) => c.defaultSelected).map((c) => c.id)),
      );
      setHealth({
        memory,
        disk,
        startupEnabled: startup
          ? startup.filter((i) => i.isEnabled).length
          : null,
      });
      setProgress(100);
      setPhase("results");
    } catch {
      toast.show({ tone: "error", title: t("errors.scanFailed") });
      setPhase("idle");
    } finally {
      off();
    }
  }

  async function handleClean() {
    setShowConfirm(false);
    const paths = selectedCats.flatMap((c) => c.files.map((f) => f.path));
    const outcome = await clean(paths);
    setFreed(outcome.freed);
    if (outcome.failed.length > 0) {
      toast.show({ tone: "warning", title: t("smartScan.partialClean") });
    }
    setPhase("cleaned");
  }

  function toggle(id: JunkCategoryId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected =
    cleanable.length > 0 && selected.size === cleanable.length;

  const heroFooter = useMemo(() => {
    if (!stats) return null;
    const last = formatRelative(stats.lastScanAt, i18n.language);
    return (
      <div className="hero-stats">
        <span>
          {last
            ? t("smartScan.lastScan", { when: last })
            : t("smartScan.neverScanned")}
        </span>
        {stats.totalFreed > 0 && (
          <>
            <span className="hero-stats-dot" />
            <span>
              {t("smartScan.lifetimeFreed", {
                size: formatBytes(stats.totalFreed),
              })}
            </span>
          </>
        )}
      </div>
    );
  }, [stats, t, i18n.language]);

  return (
    <div className="page-container">
      <div className="page-scrollable">
        {phase === "results" && (
          <PageHeader
            title={t("smartScan.title")}
            subtitle={t("smartScan.subtitle")}
          />
        )}

        {phase === "idle" && (
          <ScanHero page="smart-scan" onScan={handleScan} footer={heroFooter} />
        )}

        {phase === "scanning" && (
          <ScanningState
            page="smart-scan"
            progress={progress}
            label={
              currentCategory
                ? t("smartScan.scanningCategory", {
                    category: t(`junk.${currentCategory}`),
                  })
                : t("smartScan.finishing")
            }
          />
        )}

        {phase === "cleaned" && (
          <div className="working-state fade-in">
            <ModuleArt page="smart-scan" size={220}>
              <CheckCircle2 size={72} strokeWidth={1.6} />
            </ModuleArt>
            <h2 className="success-title">
              {freed > 0 ? (
                <AnimatedNumber
                  value={freed}
                  format={(n) =>
                    t("smartScan.freedTitle", { size: formatBytes(n) })
                  }
                />
              ) : (
                t("smartScan.yourMacIsClean")
              )}
            </h2>
            <p className="scan-status">{t("smartScan.freedMessage")}</p>
            <button
              className="btn btn-glass"
              style={{ marginTop: 24 }}
              onClick={handleScan}
            >
              <RotateCcw size={16} />
              {t("common.scanAgain")}
            </button>
          </div>
        )}

        {phase === "results" && (
          <div className="fade-in">
            <div className="summary-cards summary-cards-4">
              <SummaryCard
                icon={<Trash2 size={20} />}
                color="var(--warning)"
                value={formatBytes(totalSize)}
                label={t("smartScan.cleanable")}
              />
              <SummaryCard
                icon={<MemoryStick size={20} />}
                color="var(--success)"
                value={
                  health.memory
                    ? `${Math.round(health.memory.percentUsed)}%`
                    : "—"
                }
                label={t("smartScan.memory")}
                detail={
                  health.memory
                    ? t("smartScan.memoryPressure", {
                        value: Math.round(health.memory.pressure),
                      })
                    : undefined
                }
                onClick={() => navigate("performance")}
              />
              <SummaryCard
                icon={<HardDrive size={20} />}
                color="var(--info)"
                value={
                  health.disk ? `${Math.round(health.disk.percentUsed)}%` : "—"
                }
                label={t("smartScan.disk")}
                detail={
                  health.disk
                    ? t("smartScan.diskFree", {
                        size: formatBytes(health.disk.free),
                      })
                    : undefined
                }
                onClick={() => navigate("large-files")}
              />
              <SummaryCard
                icon={<Power size={20} />}
                color="var(--accent-secondary)"
                value={
                  health.startupEnabled !== null
                    ? String(health.startupEnabled)
                    : "—"
                }
                label={t("smartScan.startup")}
                detail={t("smartScan.review")}
                onClick={() => navigate("startup-items")}
              />
            </div>

            {accessDenied && <FullDiskAccessNotice />}

            {cleanable.length === 0 ? (
              <div className="scan-container" style={{ minHeight: 200 }}>
                <CheckCircle2 size={48} style={{ color: "var(--success)" }} />
                <h3 style={{ marginTop: 12 }}>
                  {t("smartScan.yourMacIsClean")}
                </h3>
                <p className="scan-status">{t("smartScan.nothingFound")}</p>
              </div>
            ) : (
              <>
                <div className="results-header">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(cleanable.map((c) => c.id)),
                      )
                    }
                  >
                    {allSelected
                      ? t("common.deselectAll")
                      : t("common.selectAll")}
                  </button>
                  <span className="results-selected-info">
                    {t("smartScan.selectedInfo", {
                      selected: selectedCats.length,
                      total: cleanable.length,
                      size: formatBytes(selectedSize),
                    })}
                  </span>
                </div>

                <div className="results-container">
                  {cleanable.map((cat) => {
                    const isSelected = selected.has(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={`result-row selectable ${isSelected ? "selected" : ""}`}
                        onClick={() => toggle(cat.id)}
                      >
                        <div className="result-row-left">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggle(cat.id)}
                            label={t(`junk.${cat.id}`)}
                          />
                          <JunkIcon id={cat.id} />
                          <div className="result-row-info">
                            <h4>{t(`junk.${cat.id}`)}</h4>
                            <p>{t(`junk.${cat.id}Desc`)}</p>
                          </div>
                        </div>
                        <div className="result-row-right">
                          <span className="result-count">
                            {t("common.itemsFound", {
                              count: cat.files.length,
                            })}
                          </span>
                          <span className="result-size">
                            {formatBytes(cat.totalSize)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {phase === "results" && cleanable.length > 0 && (
        <div className="page-actions-bar">
          <div className="toolbar toolbar-center">
            <button
              className="btn btn-ghost"
              onClick={handleScan}
              disabled={isCleaning}
            >
              <RotateCcw size={16} />
              {t("common.rescan")}
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setShowConfirm(true)}
              disabled={isCleaning || selectedCats.length === 0}
            >
              {isCleaning ? (
                <PulseLoader label={t("common.cleaning")} size="sm" />
              ) : (
                <>
                  <Sparkles size={20} />
                  {t("smartScan.cleanSize", {
                    size: formatBytes(selectedSize),
                  })}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title={t("smartScan.confirmTitle")}
        message={t("smartScan.confirmMessage", {
          size: formatBytes(selectedSize),
          count: selectedCats.length,
        })}
        confirmLabel={t("common.clean")}
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
      {dialog}
    </div>
  );
}

function SummaryCard({
  icon,
  color,
  value,
  label,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  value: string;
  label: string;
  detail?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`summary-card ${onClick ? "clickable" : ""}`}
      onClick={onClick}
    >
      <div
        className="summary-card-icon"
        style={{
          color,
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
        }}
      >
        {icon}
      </div>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      {detail && <div className="summary-card-detail">{detail}</div>}
    </Tag>
  );
}
