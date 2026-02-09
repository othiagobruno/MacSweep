import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Zap,
  Globe,
  Search,
  ShieldCheck,
  ExternalLink,
  Power,
  XCircle,
  Loader2,
  CheckCircle2,
  Battery,
  BatteryCharging,
  BatteryFull,
  Heart,
  Thermometer,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface CpuUsage {
  user: number;
  system: number;
  idle: number;
  total: number;
}

interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
}

interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
  mount: string;
}

interface BatteryInfo {
  cycleCount: number;
  maxCapacity: number;
  designCapacity: number;
  currentCapacity: number;
  percentCharge: number;
  isCharging: boolean;
  isFullyCharged: boolean;
  condition: string;
  temperature: number;
  healthPercent: number;
}

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  memoryBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Circular gauge component for displaying performance metrics.
 */
function CircularGauge({
  value,
  max = 100,
  color,
  icon,
  label,
  detail,
}: {
  value: number;
  max?: number;
  color: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const filledLength = (pct / 100) * arcLength;
  const gapLength = circumference - filledLength;

  return (
    <div className="tray-gauge">
      <svg viewBox="0 0 100 100" className="tray-gauge-svg">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
          transform="rotate(135, 50, 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${filledLength} ${gapLength}`}
          strokeLinecap="round"
          transform="rotate(135, 50, 50)"
          style={{
            transition: "stroke-dasharray 0.8s ease",
            filter: `drop-shadow(0 0 4px ${color}50)`,
          }}
        />
      </svg>
      <div className="tray-gauge-inner">
        <div className="tray-gauge-icon" style={{ color }}>
          {icon}
        </div>
        <div className="tray-gauge-value">{value.toFixed(0)}%</div>
      </div>
      <div className="tray-gauge-label">{label}</div>
      <div className="tray-gauge-detail">{detail}</div>
    </div>
  );
}

type QuickActionStatus = "idle" | "running" | "done";

interface QuickAction {
  id: string;
  labelKey: string;
  runningKey: string;
  doneKey: string;
  icon: React.ReactNode;
  colorClass: string;
  apiMethod: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "free-ram",
    labelKey: "tray.freeMemory",
    runningKey: "tray.freeingMemory",
    doneKey: "tray.memoryFreed",
    icon: <Zap size={14} />,
    colorClass: "purple",
    apiMethod: "freeRam",
  },
  {
    id: "flush-dns",
    labelKey: "tray.flushDns",
    runningKey: "tray.flushingDns",
    doneKey: "tray.dnsFlushed",
    icon: <Globe size={14} />,
    colorClass: "green",
    apiMethod: "flushDns",
  },
  {
    id: "rebuild-spotlight",
    labelKey: "tray.rebuildSpotlight",
    runningKey: "tray.rebuildingSpotlight",
    doneKey: "tray.spotlightRebuilt",
    icon: <Search size={14} />,
    colorClass: "blue",
    apiMethod: "rebuildSpotlight",
  },
  {
    id: "repair-permissions",
    labelKey: "tray.repairPermissions",
    runningKey: "tray.repairingPermissions",
    doneKey: "tray.permissionsFixed",
    icon: <ShieldCheck size={14} />,
    colorClass: "orange",
    apiMethod: "repairPermissions",
  },
];

export function TrayApp() {
  const { t } = useTranslation();
  const [cpu, setCpu] = useState<CpuUsage | null>(null);
  const [memory, setMemory] = useState<MemoryUsage | null>(null);
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [killingPids, setKillingPids] = useState<Set<number>>(new Set());
  const [actionStatuses, setActionStatuses] = useState<
    Record<string, QuickActionStatus>
  >({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 3000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  async function fetchData() {
    try {
      const api = (window as any).electronAPI;
      if (!api) return;

      const [cpuData, memData, diskData, batteryData, procData] =
        await Promise.all([
          api.system.cpuUsage(),
          api.system.memoryUsage(),
          api.system.diskUsage(),
          api.system.batteryInfo?.() ?? Promise.resolve(null),
          api.system.topProcesses(),
        ]);
      setCpu(cpuData);
      setMemory(memData);
      setDisk(diskData);
      setBattery(batteryData);
      setProcesses(procData || []);
    } catch {
      // silently fail
    }
  }

  async function handleKill(pid: number) {
    setKillingPids((prev) => new Set(prev).add(pid));
    try {
      const api = (window as any).electronAPI;
      if (api) {
        await api.system.killProcess(pid);
      }
      // Remove from list immediately
      setProcesses((prev) => prev.filter((p) => p.pid !== pid));
    } catch {
      // silently fail
    } finally {
      setKillingPids((prev) => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
    }
  }

  async function handleAction(action: QuickAction) {
    const current = actionStatuses[action.id] || "idle";
    if (current === "running") return;

    setActionStatuses((prev) => ({ ...prev, [action.id]: "running" }));
    try {
      const api = (window as any).electronAPI;
      if (api && api.maintenance[action.apiMethod]) {
        await api.maintenance[action.apiMethod]();
      }
      setActionStatuses((prev) => ({ ...prev, [action.id]: "done" }));
      setTimeout(() => {
        setActionStatuses((prev) => ({ ...prev, [action.id]: "idle" }));
      }, 3000);
    } catch {
      setActionStatuses((prev) => ({ ...prev, [action.id]: "idle" }));
    }
  }

  function handleOpenMain() {
    const api = (window as any).electronAPI;
    if (api) {
      api.tray.openMainWindow();
    }
  }

  function handleQuit() {
    const api = (window as any).electronAPI;
    if (api) {
      api.tray.quit();
    }
  }

  function getOverallStatus(): { label: string; color: string } {
    const cpuVal = cpu?.total ?? 0;
    const memVal = memory?.percentUsed ?? 0;
    const diskVal = disk?.percentUsed ?? 0;

    if (cpuVal > 80 || memVal > 85 || diskVal > 90) {
      return { label: t("tray.needsAttention"), color: "#ff6b6b" };
    }
    if (cpuVal > 50 || memVal > 70 || diskVal > 80) {
      return { label: t("tray.fair"), color: "#ffa502" };
    }
    return { label: t("tray.good"), color: "#00d2a0" };
  }

  function getCpuColor(cpuPct: number): string {
    if (cpuPct > 50) return "#ff6b6b";
    if (cpuPct > 20) return "#ffa502";
    return "#00d2a0";
  }

  const status = getOverallStatus();

  return (
    <div className="tray-container">
      {/* Arrow pointer */}
      <div className="tray-arrow" />

      <div className="tray-panel">
        {/* Header */}
        <div className="tray-header">
          <div className="tray-header-left">
            <div className="tray-logo">✦</div>
            <span className="tray-brand">MacSweep</span>
          </div>
          <div
            className="tray-status-badge"
            style={{
              background: `${status.color}18`,
              color: status.color,
              borderColor: `${status.color}30`,
            }}
          >
            <div
              className="tray-status-dot"
              style={{ background: status.color }}
            />
            {status.label}
          </div>
        </div>

        {/* Gauges */}
        <div className="tray-gauges">
          <CircularGauge
            value={cpu?.total ?? 0}
            color="#6c5ce7"
            icon={<Cpu size={16} />}
            label={t("tray.cpu")}
            detail={
              cpu ? t("tray.userPercent", { value: cpu.user.toFixed(0) }) : "—"
            }
          />
          <CircularGauge
            value={memory?.percentUsed ?? 0}
            color="#00d2a0"
            icon={<MemoryStick size={16} />}
            label={t("performance.memory")}
            detail={
              memory
                ? t("tray.freeSpace", { space: formatBytes(memory.free) })
                : "—"
            }
          />
          <CircularGauge
            value={disk?.percentUsed ?? 0}
            color="#74b9ff"
            icon={<HardDrive size={16} />}
            label={t("performance.diskUsage")}
            detail={
              disk
                ? t("tray.freeSpace", { space: formatBytes(disk.free) })
                : "—"
            }
          />
        </div>

        {/* Battery Info */}
        {battery && (
          <>
            <div className="tray-divider" />
            <div className="tray-section-label">{t("tray.battery")}</div>
            <div className="tray-battery">
              <div className="tray-battery-header">
                <div className="tray-battery-icon-wrap">
                  {battery.isCharging ? (
                    <BatteryCharging size={18} />
                  ) : battery.percentCharge >= 95 ? (
                    <BatteryFull size={18} />
                  ) : (
                    <Battery size={18} />
                  )}
                </div>
                <div className="tray-battery-charge">
                  <span className="tray-battery-pct">
                    {battery.percentCharge}%
                  </span>
                  <span className="tray-battery-state">
                    {battery.isFullyCharged
                      ? t("tray.fullyCharged")
                      : battery.isCharging
                        ? t("tray.charging")
                        : t("tray.onBattery")}
                  </span>
                </div>
              </div>
              <div className="tray-battery-bar">
                <div
                  className="tray-battery-bar-fill"
                  style={{
                    width: `${battery.percentCharge}%`,
                    background:
                      battery.percentCharge > 20
                        ? "linear-gradient(90deg, #00d2a0, #00e6b0)"
                        : "linear-gradient(90deg, #ff6b6b, #ff8787)",
                  }}
                />
              </div>
              <div className="tray-battery-stats">
                <div className="tray-battery-stat">
                  <RefreshCw size={12} />
                  <span className="tray-battery-stat-label">
                    {t("tray.cycles")}
                  </span>
                  <span className="tray-battery-stat-value">
                    {battery.cycleCount}
                  </span>
                </div>
                <div className="tray-battery-stat">
                  <Heart size={12} />
                  <span className="tray-battery-stat-label">
                    {t("tray.health")}
                  </span>
                  <span
                    className="tray-battery-stat-value"
                    style={{
                      color:
                        battery.healthPercent >= 80
                          ? "#00d2a0"
                          : battery.healthPercent >= 60
                            ? "#ffa502"
                            : "#ff6b6b",
                    }}
                  >
                    {battery.healthPercent}%
                  </span>
                </div>
                <div className="tray-battery-stat">
                  <Thermometer size={12} />
                  <span className="tray-battery-stat-label">
                    {t("tray.temp")}
                  </span>
                  <span className="tray-battery-stat-value">
                    {battery.temperature.toFixed(1)}°C
                  </span>
                </div>
              </div>
              <div className="tray-battery-condition">
                <span>{t("tray.condition")}</span>
                <span
                  className="tray-battery-condition-value"
                  style={{
                    color:
                      battery.condition === "Normal"
                        ? "#00d2a0"
                        : battery.condition === "Fair"
                          ? "#ffa502"
                          : "#ff6b6b",
                  }}
                >
                  {battery.condition}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="tray-divider" />

        {/* Top Processes */}
        <div className="tray-section-label">{t("tray.topProcesses")}</div>
        <div className="tray-processes">
          {processes.length === 0 ? (
            <div className="tray-processes-empty">{t("tray.noProcesses")}</div>
          ) : (
            processes.map((proc) => (
              <div key={proc.pid} className="tray-process-row">
                <div className="tray-process-info">
                  <span className="tray-process-name">{proc.name}</span>
                  <span className="tray-process-stats">
                    <span
                      className="tray-process-cpu"
                      style={{ color: getCpuColor(proc.cpu) }}
                    >
                      {proc.cpu.toFixed(1)}% {t("tray.cpu")}
                    </span>
                    <span className="tray-process-mem">
                      {formatBytes(proc.memoryBytes)}
                    </span>
                  </span>
                </div>
                <button
                  className="tray-process-kill"
                  onClick={() => handleKill(proc.pid)}
                  disabled={killingPids.has(proc.pid)}
                  title={t("tray.terminate", { name: proc.name })}
                >
                  {killingPids.has(proc.pid) ? (
                    <Loader2 size={13} className="tray-spin" />
                  ) : (
                    <XCircle size={13} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Divider */}
        <div className="tray-divider" />

        {/* Quick Actions */}
        <div className="tray-section-label">{t("tray.quickActions")}</div>
        <div className="tray-actions">
          {QUICK_ACTIONS.map((action) => {
            const st = actionStatuses[action.id] || "idle";
            return (
              <button
                key={action.id}
                className="tray-action-btn"
                onClick={() => handleAction(action)}
                disabled={st === "running"}
              >
                <div className={`tray-action-icon ${action.colorClass}`}>
                  {st === "running" ? (
                    <Loader2 size={14} className="tray-spin" />
                  ) : st === "done" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    action.icon
                  )}
                </div>
                <span>
                  {st === "running"
                    ? t(action.runningKey)
                    : st === "done"
                      ? t(action.doneKey)
                      : t(action.labelKey)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="tray-divider" />

        {/* Footer */}
        <div className="tray-footer">
          <button className="tray-footer-btn primary" onClick={handleOpenMain}>
            <ExternalLink size={13} />
            {t("tray.openMacSweep")}
          </button>
          <button className="tray-footer-btn quit" onClick={handleQuit}>
            <Power size={13} />
            {t("tray.quit")}
          </button>
        </div>
      </div>
    </div>
  );
}
