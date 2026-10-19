import { useCallback, useEffect, useRef, useState } from "react";
import {
  Battery,
  BatteryCharging,
  BatteryFull,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Globe,
  HardDrive,
  Loader2,
  MemoryStick,
  Power,
  Search,
  Sparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import logoFull from "../assets/logo.png";
import { usePolling } from "./hooks/use-polling";
import { createMockApi } from "./lib/mock-api";
import { formatBytes } from "./utils";
import type {
  AppStats,
  BatteryInfo,
  CpuUsage,
  DiskUsage,
  MaintenanceTaskId,
  MemoryUsage,
  ProcessInfo,
  TrayAPI,
} from "./types";

function resolveApi(): TrayAPI {
  const bridged = (window as unknown as { electronAPI?: TrayAPI }).electronAPI;
  if (bridged) {
    // Native popover vibrancy sits behind the page in Electron.
    document.documentElement.classList.add("is-electron");
    return bridged;
  }
  // Browser preview (`npm run dev:web` → /tray.html): reuse the main mock.
  const mock = createMockApi();
  return {
    system: mock.system,
    maintenance: mock.maintenance,
    settings: mock.settings,
    app: mock.app,
    tray: {
      openMainWindow: async () => {},
      resize: async () => {},
      quit: async () => {},
      onShow: () => () => {},
    },
  };
}

const api = resolveApi();

/* ── Gauge ─────────────────────────────────────────── */

function Gauge({
  value,
  label,
  detail,
  icon,
  from,
  to,
}: {
  value: number;
  label: string;
  detail: string;
  icon: React.ReactNode;
  from: string;
  to: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 30;
  const c = 2 * Math.PI * r;
  const id = `g-${label.replace(/\W/g, "")}`;
  return (
    <div className="tw-gauge">
      <div className="tw-gauge-ring">
        <svg viewBox="0 0 72 72">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="36" cy="36" r={r} className="tw-gauge-track" />
          <circle
            cx="36"
            cy="36"
            r={r}
            className="tw-gauge-bar"
            stroke={`url(#${id})`}
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div className="tw-gauge-center">
          <span className="tw-gauge-icon" style={{ color: from }}>
            {icon}
          </span>
          <span className="tw-gauge-value">{Math.round(pct)}%</span>
        </div>
      </div>
      <span className="tw-gauge-label">{label}</span>
      <span className="tw-gauge-detail">{detail}</span>
    </div>
  );
}

/* ── Quick actions ─────────────────────────────────── */

type ActionStatus = "idle" | "running" | "done" | "error";

interface QuickAction {
  id: string;
  labelKey: string;
  runningKey: string;
  doneKey: string;
  icon: React.ReactNode;
  from: string;
  to: string;
  /** Maintenance task to run; undefined opens Smart Scan in the main window. */
  taskId?: MaintenanceTaskId;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "smart-scan",
    labelKey: "tray.smartScan",
    runningKey: "tray.smartScan",
    doneKey: "tray.smartScan",
    icon: <Sparkles size={16} />,
    from: "#0f8b8d",
    to: "#5b2bb5",
  },
  {
    id: "free-ram",
    labelKey: "tray.freeMemory",
    runningKey: "tray.freeingMemory",
    doneKey: "tray.memoryFreed",
    icon: <Zap size={16} />,
    from: "#7b3fe4",
    to: "#c2286f",
    taskId: "freeRam",
  },
  {
    id: "flush-dns",
    labelKey: "tray.flushDns",
    runningKey: "tray.flushingDns",
    doneKey: "tray.dnsFlushed",
    icon: <Globe size={16} />,
    from: "#0e9f6e",
    to: "#1d5fb8",
    taskId: "flushDns",
  },
  {
    id: "rebuild-spotlight",
    labelKey: "tray.rebuildSpotlight",
    runningKey: "tray.rebuildingSpotlight",
    doneKey: "tray.spotlightRebuilt",
    icon: <Search size={16} />,
    from: "#1f7ae0",
    to: "#3a2fa8",
    taskId: "rebuildSpotlight",
  },
];

/* ── Widget ────────────────────────────────────────── */

export function TrayApp() {
  const { t, i18n } = useTranslation();
  const [cpu, setCpu] = useState<CpuUsage | null>(null);
  const [memory, setMemory] = useState<MemoryUsage | null>(null);
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [actions, setActions] = useState<Record<string, ActionStatus>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [cpuData, memData, diskData, batteryData, procData] = await Promise.all([
      api.system.cpuUsage(),
      api.system.memoryUsage(),
      api.system.diskUsage(),
      api.system.batteryInfo(),
      api.system.topProcesses(4),
    ]);
    setCpu(cpuData);
    setMemory(memData);
    setDisk(diskData);
    setBattery(batteryData);
    setProcesses(procData);
  }, []);

  // Polling pauses automatically while the popover is hidden.
  usePolling(fetchData, 3000);

  // Follow the main window's language and refresh everything on each open.
  useEffect(() => {
    const sync = () => {
      void api.settings
        .load()
        .then((s) => {
          if (i18n.language !== s.language) void i18n.changeLanguage(s.language);
        })
        .catch(() => undefined);
      void api.app.stats().then(setStats).catch(() => undefined);
    };
    sync();
    return api.tray.onShow(() => {
      sync();
      void fetchData();
    });
  }, [i18n, fetchData]);

  // Size the native window to the content.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      void api.tray.resize(el.getBoundingClientRect().height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function handleKill(pid: number) {
    setKilling((prev) => new Set(prev).add(pid));
    try {
      const result = await api.system.killProcess(pid);
      if (result.success) setProcesses((prev) => prev.filter((p) => p.pid !== pid));
    } finally {
      setKilling((prev) => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
    }
  }

  async function handleAction(action: QuickAction) {
    if (actions[action.id] === "running") return;
    if (!action.taskId) {
      void api.tray.openMainWindow("smart-scan");
      return;
    }
    setActions((prev) => ({ ...prev, [action.id]: "running" }));
    let status: ActionStatus = "error";
    try {
      const [result] = await api.maintenance.run([action.taskId]);
      status = result?.cancelled ? "idle" : result?.success ? "done" : "error";
    } catch {
      status = "error";
    }
    setActions((prev) => ({ ...prev, [action.id]: status }));
    if (status !== "idle") {
      setTimeout(() => setActions((prev) => ({ ...prev, [action.id]: "idle" })), 3000);
    }
  }

  const cpuVal = cpu?.total ?? 0;
  const memVal = memory?.percentUsed ?? 0;
  const diskVal = disk?.percentUsed ?? 0;
  const pressure = memory?.pressure ?? 0;
  const health =
    cpuVal > 80 || pressure > 70 || diskVal > 90
      ? "bad"
      : cpuVal > 50 || pressure > 45 || diskVal > 80
        ? "fair"
        : "good";
  const healthLabel = {
    good: t("tray.good"),
    fair: t("tray.fair"),
    bad: t("tray.needsAttention"),
  }[health];
  const junk = stats?.lastScanJunkSize ?? 0;
  const maxCpu = Math.max(1, ...processes.map((p) => p.cpu));

  return (
    <div className={`tw tw-${health}`} ref={panelRef}>
      <header className="tw-header">
        <img src={logoFull} alt="MacSweep" className="tw-logo" />
        <span className="tw-status">
          <span className="tw-status-dot" />
          {healthLabel}
        </span>
      </header>

      <button className="tw-hero" onClick={() => void api.tray.openMainWindow("smart-scan")}>
        <div className="tw-hero-orb">
          <Sparkles size={20} />
        </div>
        <div className="tw-hero-text">
          <strong>{junk > 0 ? formatBytes(junk) : healthLabel}</strong>
          <span>{junk > 0 ? t("tray.junkFound") : t("tray.smartScanDesc")}</span>
        </div>
        <span className="tw-hero-cta">{t("tray.cleanUp")}</span>
      </button>

      <section className="tw-gauges">
        <Gauge
          value={cpuVal}
          label={t("tray.cpu")}
          detail={cpu ? t("tray.userPercent", { value: cpu.user.toFixed(0) }) : "—"}
          icon={<Cpu size={13} />}
          from="#b18cff"
          to="#ff7ad9"
        />
        <Gauge
          value={memVal}
          label={t("performance.memory")}
          detail={memory ? t("tray.freeSpace", { space: formatBytes(memory.free) }) : "—"}
          icon={<MemoryStick size={13} />}
          from="#4ef2d0"
          to="#1d9bf0"
        />
        <Gauge
          value={diskVal}
          label={t("tray.disk")}
          detail={disk ? t("tray.freeSpace", { space: formatBytes(disk.free) }) : "—"}
          icon={<HardDrive size={13} />}
          from="#ffb067"
          to="#ff5e8a"
        />
      </section>

      {battery && (
        <section className="tw-card tw-battery">
          <div className="tw-battery-icon">
            {battery.isCharging ? (
              <BatteryCharging size={18} />
            ) : battery.percentCharge >= 95 ? (
              <BatteryFull size={18} />
            ) : (
              <Battery size={18} />
            )}
          </div>
          <div className="tw-battery-main">
            <div className="tw-battery-top">
              <strong>{battery.percentCharge}%</strong>
              <span>
                {battery.isFullyCharged
                  ? t("tray.fullyCharged")
                  : battery.isCharging
                    ? t("tray.charging")
                    : t("tray.onBattery")}
              </span>
            </div>
            <div className="tw-bar">
              <div
                className={`tw-bar-fill ${battery.percentCharge <= 20 ? "low" : ""}`}
                style={{ width: `${battery.percentCharge}%` }}
              />
            </div>
            <div className="tw-battery-meta">
              <span>
                {t("tray.health")}{" "}
                <b className={`tone-${battery.condition}`}>{battery.healthPercent}%</b>
              </span>
              <span>
                {t("tray.cycles")} <b>{battery.cycleCount}</b>
              </span>
              <span>
                {t("tray.temp")} <b>{battery.temperature.toFixed(0)}°C</b>
              </span>
            </div>
          </div>
        </section>
      )}

      <section className="tw-section">
        <div className="tw-section-title">{t("tray.topProcesses")}</div>
        <div className="tw-card tw-processes">
          {processes.length === 0 ? (
            <div className="tw-empty">{t("tray.noProcesses")}</div>
          ) : (
            processes.map((proc) => (
              <div key={proc.pid} className="tw-process">
                <div className="tw-process-info">
                  <span className="tw-process-name" title={proc.name}>
                    {proc.name}
                  </span>
                  <div className="tw-process-bar">
                    <div style={{ width: `${(proc.cpu / maxCpu) * 100}%` }} />
                  </div>
                </div>
                <span className="tw-process-cpu">{proc.cpu.toFixed(1)}%</span>
                <span className="tw-process-mem">{formatBytes(proc.memoryBytes, 0)}</span>
                <button
                  className="tw-icon-btn"
                  onClick={() => void handleKill(proc.pid)}
                  disabled={killing.has(proc.pid)}
                  title={t("tray.terminate", { name: proc.name })}
                  aria-label={t("tray.terminate", { name: proc.name })}
                >
                  {killing.has(proc.pid) ? (
                    <Loader2 size={12} className="tw-spin" />
                  ) : (
                    <X size={12} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-title">{t("tray.quickActions")}</div>
        <div className="tw-actions">
          {QUICK_ACTIONS.map((action) => {
            const st = actions[action.id] ?? "idle";
            return (
              <button
                key={action.id}
                className={`tw-action ${st}`}
                onClick={() => void handleAction(action)}
                disabled={st === "running"}
              >
                <span
                  className="tw-action-icon"
                  style={{ background: `linear-gradient(150deg, ${action.from}, ${action.to})` }}
                >
                  {st === "running" ? (
                    <Loader2 size={16} className="tw-spin" />
                  ) : st === "done" ? (
                    <CheckCircle2 size={16} />
                  ) : st === "error" ? (
                    <XCircle size={16} />
                  ) : (
                    action.icon
                  )}
                </span>
                <span className="tw-action-label">
                  {st === "running"
                    ? t(action.runningKey)
                    : st === "done"
                      ? t(action.doneKey)
                      : st === "error"
                        ? t("tray.actionFailed")
                        : t(action.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="tw-footer">
        <button className="tw-footer-btn" onClick={() => void api.tray.openMainWindow()}>
          <ExternalLink size={13} />
          {t("tray.openMacSweep")}
        </button>
        <button className="tw-footer-btn subtle" onClick={() => void api.tray.quit()}>
          <Power size={13} />
          {t("tray.quit")}
        </button>
      </footer>
    </div>
  );
}
