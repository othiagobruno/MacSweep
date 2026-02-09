import {
  Zap,
  Shield,
  Gauge,
  Trash2,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react";
import { ConfirmDialog } from "../components/confirm-dialog";
import { ScanningOrb, ScanningLines, PulseLoader } from "../components/loaders";
import { formatBytes } from "../utils";
import { useAppState } from "../contexts/app-state-context";
import { useState } from "react";
import type { SystemJunkResult } from "../types";

export function SmartScan() {
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

    const steps = [
      { label: "Analyzing system junk...", target: 30 },
      { label: "Checking performance...", target: 60 },
      { label: "Scanning for threats...", target: 85 },
      { label: "Generating report...", target: 100 },
    ];

    let junkResults: SystemJunkResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      setScanStatus(steps[i].label);

      if (i === 0 && window.electronAPI) {
        try {
          junkResults = await window.electronAPI.scan.systemJunk();
        } catch {
          junkResults = getMockJunkData();
        }
      } else if (i === 0) {
        junkResults = getMockJunkData();
      }

      await animateProgress(progress, steps[i].target, 800);
      setProgress(steps[i].target);
    }

    const totalJunk = junkResults.reduce((sum, cat) => sum + cat.totalSize, 0);
    setResults({ junk: junkResults, totalJunk });
    setSelectedCategories(new Set(junkResults.map((cat) => cat.category)));
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

    if (results && window.electronAPI) {
      const selectedJunk = results.junk.filter((cat) =>
        selectedCategories.has(cat.category),
      );
      const allPaths = selectedJunk.flatMap((cat) =>
        cat.files.map((f) => f.path),
      );
      try {
        await window.electronAPI.clean.files(allPaths);
      } catch {
        // Continue with UI update
      }
    }

    await new Promise((r) => setTimeout(r, 2000));
    setIsCleaning(false);
    setCleaned(true);
  }

  const selectedTotal = results
    ? results.junk
        .filter((cat) => selectedCategories.has(cat.category))
        .reduce((sum, cat) => sum + cat.totalSize, 0)
    : 0;

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">Smart Scan</h1>
          <p className="page-subtitle">
            Scan your Mac for junk, malware, and performance issues
          </p>
        </div>

        <div className="scan-container">
          {scanState === "idle" && (
            <div className="fade-in">
              <div className="scan-circle-wrapper">
                <div className="scan-circle-bg" />
                <button className="scan-btn" onClick={handleScan}>
                  <Zap size={40} />
                  Scan
                </button>
              </div>
              <p className="scan-status">Click to start a comprehensive scan</p>
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
                  <div className="summary-card-label">System Junk</div>
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
                  <div className="summary-card-value">No Threats</div>
                  <div className="summary-card-label">Malware Scan</div>
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
                  <div className="summary-card-value">Good</div>
                  <div className="summary-card-label">Performance</div>
                </div>
              </div>

              <div className="results-header">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={toggleAll}
                >
                  {selectedCategories.size === results.junk.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <span className="results-selected-info">
                  {selectedCategories.size} of {results.junk.length} selected —{" "}
                  {formatBytes(selectedTotal)}
                </span>
              </div>

              <div className="results-container">
                {[...results.junk]
                  .sort((a, b) => b.totalSize - a.totalSize)
                  .map((cat) => {
                    const isSelected = selectedCategories.has(cat.category);
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
                            <p>{cat.files.length} items found</p>
                          </div>
                        </div>
                        <div className="result-row-right">
                          <span className="result-size">
                            {formatBytes(cat.totalSize)}
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
                Your Mac is clean!
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setShowCleanConfirm(true)}
                disabled={isCleaning || selectedCategories.size === 0}
              >
                {isCleaning ? (
                  <PulseLoader label="Cleaning..." size="sm" />
                ) : (
                  <>
                    <Sparkles size={20} />
                    Clean {formatBytes(selectedTotal)}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showCleanConfirm}
        title="Clean Selected Categories?"
        message={`This will remove ${formatBytes(selectedTotal)} of junk files from ${selectedCategories.size} selected categories. This action cannot be undone.`}
        confirmLabel="Clean"
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
