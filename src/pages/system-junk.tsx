import { useState } from "react";
import {
  Trash2,
  Search,
  Check,
  FolderOpen,
  FileText,
  Download,
  Clock,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  File,
  Minus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionNotice } from "../components/action-notice";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PulseLoader, ScanningLines } from "../components/loaders";
import { formatBytes } from "../utils";
import { useAppState } from "../contexts/app-state-context";
import type { SystemJunkResult } from "../types";

const categoryIcons: Record<string, React.ReactNode> = {
  "User Cache": <FolderOpen size={18} />,
  "System Logs": <FileText size={18} />,
  "Temporary Files": <Clock size={18} />,
  "Old Downloads": <Download size={18} />,
  "Xcode Derived Data": <FolderOpen size={18} />,
  "Homebrew Cache": <FolderOpen size={18} />,
};

export function SystemJunk() {
  const { t } = useTranslation();
  const {
    systemJunk: {
      isScanning,
      setIsScanning,
      results,
      setResults,
      selected,
      setSelected,
      isCleaning,
      setIsCleaning,
      cleaned,
      setCleaned,
    },
  } = useAppState();

  const [showCleanConfirm, setShowCleanConfirm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  // selected now stores individual file paths
  const allFilePaths = results.flatMap((r) => r.files.map((f) => f.path));

  async function scanSystemJunkResults() {
    if (window.electronAPI) {
      const junkResults = await window.electronAPI.scan.systemJunk();
      return junkResults.filter((category) => category.files.length > 0);
    }

    await new Promise((r) => setTimeout(r, 2000));
    return getMockData();
  }

  async function handleScan() {
    setIsScanning(true);
    setCleaned(false);
    setFeedback(null);

    try {
      const junkResults = await scanSystemJunkResults();
      setResults(junkResults);
      // Select all files by default
      const allPaths = junkResults.flatMap((r) => r.files.map((f) => f.path));
      setSelected(new Set(allPaths));
      setCleaned(junkResults.length === 0);
    } catch {
      const mock = getMockData();
      setResults(mock);
      setSelected(new Set(mock.flatMap((r) => r.files.map((f) => f.path))));
      setCleaned(mock.length === 0);
    }

    setIsScanning(false);
  }

  function toggleExpand(category: string) {
    const next = new Set(expanded);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpanded(next);
  }

  function toggleFile(path: string) {
    const next = new Set(selected);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelected(next);
  }

  function toggleCategory(category: string) {
    const cat = results.find((r) => r.category === category);
    if (!cat) return;

    const catPaths = cat.files.map((f) => f.path);
    const allSelected = catPaths.every((p) => selected.has(p));
    const next = new Set(selected);

    if (allSelected) {
      catPaths.forEach((p) => next.delete(p));
    } else {
      catPaths.forEach((p) => next.add(p));
    }
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === allFilePaths.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilePaths));
    }
  }

  function getCategoryState(cat: SystemJunkResult) {
    const catPaths = cat.files.map((f) => f.path);
    const selectedCount = catPaths.filter((p) => selected.has(p)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === catPaths.length) return "all";
    return "partial";
  }

  const selectedTotal = results
    .flatMap((r) => r.files)
    .filter((f) => selected.has(f.path))
    .reduce((sum, f) => sum + f.size, 0);

  async function handleClean() {
    setShowCleanConfirm(false);
    setIsCleaning(true);
    setCleaned(false);
    setFeedback(null);

    const selectedPaths = Array.from(selected);

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.clean.files(selectedPaths);

        if (result.failedPaths.length > 0) {
          await window.electronAPI.shell.forceDelete(result.failedPaths);
        }

        const refreshedResults = await scanSystemJunkResults();
        const remainingPaths = new Set(
          refreshedResults.flatMap((category) =>
            category.files.map((file) => file.path),
          ),
        );
        const remainingSelected = selectedPaths.filter((path) =>
          remainingPaths.has(path),
        );

        setResults(refreshedResults);
        setSelected(new Set(remainingSelected));
        setCleaned(refreshedResults.length === 0);
        window.dispatchEvent(new Event("macsweep:disk-usage-refresh"));

        if (remainingSelected.length === 0) {
          setFeedback({
            tone: "success",
            message:
              refreshedResults.length === 0
                ? t("systemJunk.cleanSuccess")
                : t("systemJunk.cleanSuccessWithRemaining"),
          });
        } else if (remainingSelected.length < selectedPaths.length) {
          setFeedback({
            tone: "warning",
            message: t("systemJunk.cleanPartial"),
          });
        } else {
          setFeedback({
            tone: "error",
            message: t("systemJunk.cleanFailed"),
          });
        }
      } catch {
        setFeedback({
          tone: "error",
          message: t("systemJunk.cleanFailed"),
        });
      }
    } else {
      const nextResults = results
        .map((category) => {
          const files = category.files.filter((file) => !selected.has(file.path));
          return {
            ...category,
            files,
            totalSize: files.reduce((sum, file) => sum + file.size, 0),
          };
        })
        .filter((category) => category.files.length > 0);

      setResults(nextResults);
      setSelected(new Set());
      setCleaned(nextResults.length === 0);
      setFeedback({
        tone: "success",
        message:
          nextResults.length === 0
            ? t("systemJunk.cleanSuccess")
            : t("systemJunk.cleanSuccessWithRemaining"),
      });
    }

    setIsCleaning(false);
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">{t("systemJunk.title")}</h1>
          <p className="page-subtitle">{t("systemJunk.subtitle")}</p>
        </div>

        {feedback && (
          <ActionNotice tone={feedback.tone} message={feedback.message} />
        )}

        {results.length === 0 && !isScanning && !cleaned && (
          <div className="scan-container">
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <Search size={36} />
                  {t("common.scan")}
                </button>
              </div>
              <p className="scan-status">{t("systemJunk.scanStatus")}</p>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="scan-container fade-in" style={{ minHeight: 300 }}>
            <PulseLoader label={t("systemJunk.scanning")} size="lg" />
            <ScanningLines />
          </div>
        )}

        {cleaned && (
          <div className="scan-container fade-in">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckCircle2 size={64} style={{ color: "var(--success)" }} />
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>
                {t("systemJunk.allClean")}
              </h2>
              <p className="scan-status">{t("systemJunk.junkRemoved")}</p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setCleaned(false);
                  handleScan();
                }}
              >
                {t("common.scanAgain")}
              </button>
            </div>
          </div>
        )}

        {results.length > 0 && !isScanning && (
          <div className="fade-in">
            <div className="file-tree">
              {[...results]
                .sort(
                  (a, b) =>
                    b.files.reduce((sum, file) => sum + file.size, 0) -
                    a.files.reduce((sum, file) => sum + file.size, 0),
                )
                .map((cat) => {
                  const state = getCategoryState(cat);
                  const isOpen = expanded.has(cat.category);
                  const categorySize = cat.files.reduce(
                    (sum, file) => sum + file.size,
                    0,
                  );
                  const catSelectedSize = cat.files
                    .filter((f) => selected.has(f.path))
                    .reduce((sum, f) => sum + f.size, 0);

                  return (
                    <div key={cat.category} className="file-tree-group">
                      <div className="file-tree-category">
                        <div className="file-tree-category-left">
                          <div
                            className={`checkbox ${
                              state === "all"
                                ? "checked"
                                : state === "partial"
                                  ? "indeterminate"
                                  : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(cat.category);
                            }}
                          >
                            {state === "all" && <Check size={12} />}
                            {state === "partial" && <Minus size={12} />}
                          </div>
                          <div className="result-row-icon">
                            {categoryIcons[cat.category] || (
                              <Trash2 size={18} />
                            )}
                          </div>
                          <div
                            style={{ cursor: "pointer", flex: 1 }}
                            onClick={() => toggleExpand(cat.category)}
                          >
                            <h4
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                marginBottom: 2,
                              }}
                            >
                              {cat.category}
                            </h4>
                            <p
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {t("systemJunk.items", {
                                count: cat.files.length,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="file-tree-category-right">
                          <span className="result-size">
                            {state === "all"
                              ? formatBytes(categorySize)
                              : state === "partial"
                                ? formatBytes(catSelectedSize)
                                : formatBytes(categorySize)}
                          </span>
                          <div
                            className={`file-tree-chevron ${isOpen ? "rotated" : ""}`}
                            onClick={() => toggleExpand(cat.category)}
                            style={{ cursor: "pointer" }}
                          >
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </div>

                      <div
                        className={`file-tree-children ${isOpen ? "open" : ""}`}
                      >
                        <div className="file-tree-children-inner">
                          {cat.files
                            .sort((a, b) => b.size - a.size)
                            .map((file) => (
                              <div
                                key={file.path}
                                className={`file-tree-file ${selected.has(file.path) ? "selected" : ""}`}
                                onClick={() => toggleFile(file.path)}
                              >
                                <div className="file-tree-file-left">
                                  <div
                                    className={`checkbox ${selected.has(file.path) ? "checked" : ""}`}
                                  >
                                    {selected.has(file.path) && (
                                      <Check size={10} />
                                    )}
                                  </div>
                                  <File
                                    size={14}
                                    className="file-tree-file-icon"
                                  />
                                  <div className="file-tree-file-info">
                                    <span className="file-tree-file-name">
                                      {file.name}
                                    </span>
                                    <span className="file-tree-path">
                                      {file.path}
                                    </span>
                                  </div>
                                </div>
                                <span className="file-tree-file-size">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && !isScanning && (
        <div className="page-actions-bar">
          <div className="toolbar">
            <div className="toolbar-left">
              <div
                className={`checkbox ${
                  selected.size === allFilePaths.length
                    ? "checked"
                    : selected.size > 0
                      ? "indeterminate"
                      : ""
                }`}
                onClick={toggleAll}
              >
                {selected.size === allFilePaths.length && <Check size={12} />}
                {selected.size > 0 && selected.size < allFilePaths.length && (
                  <Minus size={12} />
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {t("systemJunk.filesSelectedInfo", {
                  selected: selected.size,
                  total: allFilePaths.length,
                })}
                {selected.size > 0 && ` (${formatBytes(selectedTotal)})`}
              </span>
            </div>
            <div className="toolbar-right">
              <button
                className="btn btn-primary"
                disabled={selected.size === 0 || isCleaning}
                onClick={() => setShowCleanConfirm(true)}
              >
                {isCleaning ? (
                  <PulseLoader label={t("common.cleaning")} size="sm" />
                ) : (
                  <>
                    <Sparkles size={16} />{" "}
                    {t("systemJunk.cleanSize", {
                      size: formatBytes(selectedTotal),
                    })}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showCleanConfirm}
        title={t("systemJunk.confirmTitle")}
        message={t("systemJunk.confirmMessage", {
          size: formatBytes(selectedTotal),
          count: selected.size,
        })}
        confirmLabel={t("common.clean")}
        variant="warning"
        onConfirm={handleClean}
        onCancel={() => setShowCleanConfirm(false)}
      />
    </div>
  );
}

function getMockData(): SystemJunkResult[] {
  return [
    {
      category: "User Cache",
      files: Array.from({ length: 25 }, (_, i) => ({
        path: `/Users/user/Library/Caches/item${i}`,
        size: Math.random() * 100 * 1024 * 1024,
        name: `cache-${i}`,
      })),
      totalSize: 2.3 * 1024 * 1024 * 1024,
    },
    {
      category: "System Logs",
      files: Array.from({ length: 12 }, (_, i) => ({
        path: `/var/log/item${i}`,
        size: Math.random() * 50 * 1024 * 1024,
        name: `log-${i}`,
      })),
      totalSize: 380 * 1024 * 1024,
    },
    {
      category: "Temporary Files",
      files: Array.from({ length: 8 }, (_, i) => ({
        path: `/tmp/item${i}`,
        size: Math.random() * 200 * 1024 * 1024,
        name: `tmp-${i}`,
      })),
      totalSize: 920 * 1024 * 1024,
    },
    {
      category: "Old Downloads",
      files: Array.from({ length: 6 }, (_, i) => ({
        path: `/Users/user/Downloads/old${i}`,
        size: Math.random() * 500 * 1024 * 1024,
        name: `download-${i}`,
      })),
      totalSize: 1.8 * 1024 * 1024 * 1024,
    },
  ];
}
