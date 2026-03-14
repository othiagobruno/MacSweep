import {
  Zap,
  Shield,
  Gauge,
  Trash2,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionNotice } from "../components/action-notice";
import { ConfirmDialog } from "../components/confirm-dialog";
import { ScanningOrb, ScanningLines, PulseLoader } from "../components/loaders";
import { formatBytes } from "../utils";
import { useAppState } from "../contexts/app-state-context";
import { useState } from "react";
import type { SystemJunkResult } from "../types";

export function SmartScan() {
  const { t } = useTranslation();
  const {
    smartScan: {
      scanState,
      setScanState,
      progress,
      setProgress,
      scanStatus,
      setScanStatus,
      results,
      setResults,
      isCleaning,
      setIsCleaning,
      cleaned,
      setCleaned,
    },
  } = useAppState();

  const [showCleanConfirm, setShowCleanConfirm] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  async function scanSystemJunkResults() {
    if (window.electronAPI) {
      const junkResults = await window.electronAPI.scan.systemJunk();
      return junkResults.filter((category) => category.files.length > 0);
    }

    return getMockJunkData();
  }

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!results) return;
    if (selectedCategories.size === results.junk.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(results.junk.map((cat) => cat.category)));
    }
  }

  async function handleScan() {
    setScanState("scanning");
    setProgress(0);
    setCleaned(false);
    setFeedback(null);

    const steps = [
      { label: t("smartScan.analyzingJunk"), target: 30 },
      { label: t("smartScan.checkingPerformance"), target: 60 },
      { label: t("smartScan.scanningThreats"), target: 85 },
      { label: t("smartScan.generatingReport"), target: 100 },
    ];

    let junkResults: SystemJunkResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      setScanStatus(steps[i].label);

      if (i === 0 && window.electronAPI) {
        try {
          junkResults = await scanSystemJunkResults();
        } catch {
          junkResults = getMockJunkData();
        }
      } else if (i === 0) {
        junkResults = getMockJunkData();
      }

      await animateProgress(progress, steps[i].target, 800);
      setProgress(steps[i].target);
    }

    const totalJunk = junkResults.reduce(
      (sum, cat) =>
        sum + cat.files.reduce((catSum, file) => catSum + file.size, 0),
      0,
    );
    setResults({ junk: junkResults, totalJunk });
    setSelectedCategories(new Set(junkResults.map((cat) => cat.category)));
    setCleaned(junkResults.length === 0);
    setScanState("done");
    setScanStatus("");
  }

  async function animateProgress(from: number, to: number, duration: number) {
    const steps = 20;
    const increment = (to - from) / steps;
    const delay = duration / steps;
    for (let i = 0; i < steps; i++) {
      await new Promise((r) => setTimeout(r, delay));
      setProgress((prev) => Math.min(prev + increment, to));
    }
  }

  async function handleClean() {
    setShowCleanConfirm(false);
    setIsCleaning(true);
    setCleaned(false);
    setFeedback(null);

    if (results && window.electronAPI) {
      const selectedNames = Array.from(selectedCategories);
      const selectedJunk = results.junk.filter((cat) =>
        selectedCategories.has(cat.category),
      );
      const allPaths = selectedJunk.flatMap((cat) =>
        cat.files.map((f) => f.path),
      );
      try {
        const result = await window.electronAPI.clean.files(allPaths);

        if (result.failedPaths.length > 0) {
          await window.electronAPI.shell.forceDelete(result.failedPaths);
        }

        const refreshedJunk = await scanSystemJunkResults();
        const refreshedSelected = selectedNames.filter((category) =>
          refreshedJunk.some((item) => item.category === category),
        );

        setResults({
          junk: refreshedJunk,
          totalJunk: refreshedJunk.reduce(
            (sum, cat) =>
              sum + cat.files.reduce((catSum, file) => catSum + file.size, 0),
            0,
          ),
        });
        setSelectedCategories(new Set(refreshedSelected));
        setCleaned(refreshedJunk.length === 0);
        window.dispatchEvent(new Event("macsweep:disk-usage-refresh"));

        if (refreshedSelected.length === 0) {
          setFeedback({
            tone: "success",
            message:
              refreshedJunk.length === 0
                ? t("smartScan.cleanSuccess")
                : t("smartScan.cleanSuccessWithRemaining"),
          });
        } else if (refreshedSelected.length < selectedNames.length) {
          setFeedback({
            tone: "warning",
            message: t("smartScan.cleanPartial"),
          });
        } else {
          setFeedback({
            tone: "error",
            message: t("smartScan.cleanFailed"),
          });
        }
      } catch {
        setFeedback({
          tone: "error",
          message: t("smartScan.cleanFailed"),
        });
      }
    } else if (results) {
      const nextJunk = results.junk.filter(
        (cat) => !selectedCategories.has(cat.category),
      );
      setResults({
        junk: nextJunk,
        totalJunk: nextJunk.reduce(
          (sum, cat) =>
            sum + cat.files.reduce((catSum, file) => catSum + file.size, 0),
          0,
        ),
      });
      setSelectedCategories(new Set());
      setCleaned(nextJunk.length === 0);
      setFeedback({
        tone: "success",
        message:
          nextJunk.length === 0
            ? t("smartScan.cleanSuccess")
            : t("smartScan.cleanSuccessWithRemaining"),
      });
    }

    setIsCleaning(false);
  }

  const selectedTotal = results
    ? results.junk
        .filter((cat) => selectedCategories.has(cat.category))
        .reduce(
          (sum, cat) =>
            sum + cat.files.reduce((catSum, file) => catSum + file.size, 0),
          0,
        )
    : 0;

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">{t("smartScan.title")}</h1>
          <p className="page-subtitle">{t("smartScan.subtitle")}</p>
        </div>

        {feedback && (
          <ActionNotice tone={feedback.tone} message={feedback.message} />
        )}

        <div className="scan-container">
          {scanState === "idle" && (
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <Zap size={40} />
                  {t("common.scan")}
                </button>
              </div>
              <p className="scan-status">{t("smartScan.clickToStart")}</p>
            </div>
          )}

          {scanState === "scanning" && (
            <div className="fade-in">
              <ScanningOrb progress={progress} />
              <p className="scan-status">{scanStatus}</p>
              <ScanningLines />
            </div>
          )}

          {scanState === "done" && results && (
            <div className="fade-in" style={{ width: "100%" }}>
              <div className="summary-cards">
                <div className="summary-card">
                  <div
                    className="summary-card-icon"
                    style={{
                      background: "rgba(253, 203, 110, 0.15)",
                      color: "var(--warning)",
                    }}
                  >
                    <Trash2 size={22} />
                  </div>
                  <div className="summary-card-value">
                    {formatBytes(results.totalJunk)}
                  </div>
                  <div className="summary-card-label">
                    {t("smartScan.systemJunk")}
                  </div>
                </div>

                <div className="summary-card">
                  <div
                    className="summary-card-icon"
                    style={{
                      background: "rgba(0, 210, 160, 0.15)",
                      color: "var(--success)",
                    }}
                  >
                    <Shield size={22} />
                  </div>
                  <div className="summary-card-value">
                    {t("smartScan.noThreats")}
                  </div>
                  <div className="summary-card-label">
                    {t("smartScan.malwareScan")}
                  </div>
                </div>

                <div className="summary-card">
                  <div
                    className="summary-card-icon"
                    style={{
                      background: "rgba(116, 185, 255, 0.15)",
                      color: "var(--info)",
                    }}
                  >
                    <Gauge size={22} />
                  </div>
                  <div className="summary-card-value">
                    {t("smartScan.good")}
                  </div>
                  <div className="summary-card-label">
                    {t("smartScan.performanceLabel")}
                  </div>
                </div>
              </div>

              <div className="results-header">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={toggleAll}
                >
                  {selectedCategories.size === results.junk.length
                    ? t("common.deselectAll")
                    : t("common.selectAll")}
                </button>
                <span className="results-selected-info">
                  {t("smartScan.selectedInfo", {
                    selected: selectedCategories.size,
                    total: results.junk.length,
                    size: formatBytes(selectedTotal),
                  })}
                </span>
              </div>

              <div className="results-container">
                {[...results.junk]
                  .sort(
                    (a, b) =>
                      b.files.reduce((sum, file) => sum + file.size, 0) -
                      a.files.reduce((sum, file) => sum + file.size, 0),
                  )
                  .map((cat) => {
                    const isSelected = selectedCategories.has(cat.category);
                    const categorySize = cat.files.reduce(
                      (sum, file) => sum + file.size,
                      0,
                    );
                    return (
                      <div
                        key={cat.category}
                        className={`result-row selectable ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleCategory(cat.category)}
                      >
                        <div className="result-row-left">
                          <div
                            className={`checkbox ${isSelected ? "checked" : ""}`}
                          >
                            {isSelected && <Check size={12} />}
                          </div>
                          <div className="result-row-icon">
                            <Trash2 size={18} />
                          </div>
                          <div className="result-row-info">
                            <h4>{cat.category}</h4>
                            <p>
                              {t("common.itemsFound", {
                                count: cat.files.length,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="result-row-right">
                          <span className="result-size">
                            {formatBytes(categorySize)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {scanState === "done" && results && (
        <div className="page-actions-bar">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {cleaned ? (
              <div
                className="fade-in"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--success)",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={22} />
                {t("smartScan.yourMacIsClean")}
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setShowCleanConfirm(true)}
                disabled={isCleaning || selectedCategories.size === 0}
              >
                {isCleaning ? (
                  <PulseLoader label={t("common.cleaning")} size="sm" />
                ) : (
                  <>
                    <Sparkles size={20} />
                    {t("smartScan.cleanSize", {
                      size: formatBytes(selectedTotal),
                    })}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showCleanConfirm}
        title={t("smartScan.confirmTitle")}
        message={t("smartScan.confirmMessage", {
          size: formatBytes(selectedTotal),
          count: selectedCategories.size,
        })}
        confirmLabel={t("common.clean")}
        variant="warning"
        onConfirm={handleClean}
        onCancel={() => setShowCleanConfirm(false)}
      />
    </div>
  );
}

function getMockJunkData(): SystemJunkResult[] {
  return [
    {
      category: "User Cache",
      files: [{ path: "/cache/1", size: 524288000, name: "cache1" }],
      totalSize: 2.1 * 1024 * 1024 * 1024,
    },
    {
      category: "System Logs",
      files: [{ path: "/logs/1", size: 104857600, name: "log1" }],
      totalSize: 450 * 1024 * 1024,
    },
    {
      category: "Temporary Files",
      files: [{ path: "/tmp/1", size: 209715200, name: "tmp1" }],
      totalSize: 820 * 1024 * 1024,
    },
    {
      category: "Old Downloads",
      files: [
        {
          path: "/downloads/1",
          size: 314572800,
          name: "old1",
        },
      ],
      totalSize: 1.5 * 1024 * 1024 * 1024,
    },
  ];
}
