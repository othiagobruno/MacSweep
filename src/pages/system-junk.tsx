import { useState } from "react";
import { CheckCircle2, RotateCcw, Search, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "../components/checkbox";
import { ConfirmDialog } from "../components/confirm-dialog";
import { JunkTree } from "../components/file-tree";
import { FullDiskAccessNotice } from "../components/full-disk-access-notice";
import { PulseLoader } from "../components/loaders";
import {
  ActionBar,
  PageHeader,
  ScanHero,
  ScanningState,
} from "../components/page";
import { useToast } from "../components/toast";
import { useCleaner } from "../hooks/use-cleaner";
import { api } from "../lib/api";
import { formatBytes, sumBy } from "../utils";
import type { SystemJunkResult } from "../types";

type Phase = "idle" | "scanning" | "results";

export function SystemJunk() {
  const { t } = useTranslation();
  const toast = useToast();
  const { clean, isCleaning, dialog } = useCleaner();

  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<SystemJunkResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const categories = results.filter((c) => c.files.length > 0);
  const accessDenied = results.some((c) => c.accessDenied);
  const allFiles = categories.flatMap((c) => c.files);
  const selectedSize = sumBy(
    allFiles.filter((f) => selected.has(f.path)),
    (f) => f.size,
  );

  async function scan(keepSelection?: Set<string>) {
    setPhase("scanning");
    try {
      const junk = await api.scan.systemJunk();
      setResults(junk);
      const paths = junk.flatMap((c) => c.files.map((f) => f.path));
      setSelected(
        keepSelection
          ? new Set(paths.filter((p) => keepSelection.has(p)))
          : new Set(
              junk
                .filter((c) => c.defaultSelected)
                .flatMap((c) => c.files.map((f) => f.path)),
            ),
      );
    } catch {
      toast.show({ tone: "error", title: t("errors.scanFailed") });
    }
    setPhase("results");
  }

  function toggleFile(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleCategory(cat: SystemJunkResult) {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = cat.files.every((f) => next.has(f.path));
      for (const f of cat.files) {
        if (all) next.delete(f.path);
        else next.add(f.path);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      selected.size === allFiles.length
        ? new Set()
        : new Set(allFiles.map((f) => f.path)),
    );
  }

  async function handleClean() {
    setShowConfirm(false);
    const paths = Array.from(selected);
    const { freed, failed } = await clean(paths);

    if (failed.length === 0) {
      toast.show({
        tone: "success",
        title: t("systemJunk.cleanSuccess", { size: formatBytes(freed) }),
      });
    } else if (freed > 0) {
      toast.show({
        tone: "warning",
        title: t("systemJunk.cleanSuccess", { size: formatBytes(freed) }),
        message: t("systemJunk.cleanPartial", { count: failed.length }),
      });
    } else {
      toast.show({ tone: "error", title: t("systemJunk.cleanFailed") });
    }
    // Re-scan so the list reflects what is really left on disk.
    await scan(new Set(failed));
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <PageHeader
          title={t("systemJunk.title")}
          subtitle={t("systemJunk.subtitle")}
          actions={
            phase === "results" && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => scan()}
                disabled={isCleaning}
              >
                <RotateCcw size={14} />
                {t("common.rescan")}
              </button>
            )
          }
        />

        {phase === "idle" && (
          <ScanHero
            icon={<Search size={36} />}
            label={t("common.scan")}
            hint={t("systemJunk.scanStatus")}
            onScan={() => scan()}
          />
        )}

        {phase === "scanning" && (
          <ScanningState label={t("systemJunk.scanning")} />
        )}

        {phase === "results" && (
          <div className="fade-in">
            {accessDenied && <FullDiskAccessNotice />}

            {categories.length === 0 ? (
              <div className="scan-container" style={{ minHeight: 280 }}>
                <CheckCircle2 size={64} style={{ color: "var(--success)" }} />
                <h2 className="success-title">{t("systemJunk.allClean")}</h2>
                <p className="scan-status">{t("systemJunk.junkRemoved")}</p>
              </div>
            ) : (
              <>
                <div className="search-bar">
                  <Search size={18} />
                  <input
                    type="search"
                    placeholder={t("systemJunk.filterPlaceholder")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <JunkTree
                  categories={categories}
                  selected={selected}
                  filter={filter}
                  onToggleFile={toggleFile}
                  onToggleCategory={toggleCategory}
                />
              </>
            )}
          </div>
        )}
      </div>

      {phase === "results" && categories.length > 0 && (
        <ActionBar>
          <div className="toolbar-left">
            <Checkbox
              checked={selected.size === allFiles.length}
              indeterminate={
                selected.size > 0 && selected.size < allFiles.length
              }
              onChange={toggleAll}
              label={t("common.selectAll")}
            />
            <span className="toolbar-info">
              {t("systemJunk.filesSelectedInfo", {
                selected: selected.size,
                total: allFiles.length,
              })}
            </span>
          </div>
          <div className="toolbar-right">
            <button
              className="btn btn-primary"
              disabled={selected.size === 0 || isCleaning}
              onClick={() => setShowConfirm(true)}
            >
              {isCleaning ? (
                <PulseLoader label={t("common.cleaning")} size="sm" />
              ) : (
                <>
                  <Sparkles size={16} />
                  {t("systemJunk.cleanSize", {
                    size: formatBytes(selectedSize),
                  })}
                </>
              )}
            </button>
          </div>
        </ActionBar>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title={t("systemJunk.confirmTitle")}
        message={t("systemJunk.confirmMessage", {
          size: formatBytes(selectedSize),
          count: selected.size,
        })}
        confirmLabel={t("common.clean")}
        onConfirm={handleClean}
        onCancel={() => setShowConfirm(false)}
      />
      {dialog}
    </div>
  );
}
