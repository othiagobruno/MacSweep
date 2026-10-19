import { useCallback, useState } from "react";
import {
  Battery,
  BatteryCharging,
  Cpu,
  HardDrive,
  Laptop,
  MemoryStick,
  XCircle,
  Zap,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PageHeader } from "../components/page";
import { useToast } from "../components/toast";
import { useIsActivePage } from "../contexts/navigation-context";
import { usePolling } from "../hooks/use-polling";
import { api } from "../lib/api";
import { formatBytes, formatDuration, formatTime } from "../utils";
import type {
  BatteryInfo,
  CpuUsage,
  DiskUsage,
  MemoryUsage,
  ProcessInfo,
  SystemInfo,
} from "../types";

interface ChartPoint {
  time: string;
  value: number;
}

const HISTORY = 40;

function level(value: number, warn: number, danger: number) {
  return value >= danger ? "error" : value >= warn ? "running" : "done";
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{payload[0].value.toFixed(1)}%</strong>
      <span>{payload[0].payload.time}</span>
    </div>
  );
}

function UsageChart({
  data,
  color,
  id,
}: {
  data: ChartPoint[];
  color: string;
  id: string;
}) {
  return (
    <div className="perf-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: color, stopOpacity: 0.35 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: color, stopOpacity: 0 }}
              />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--border-hover)" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Performance() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const isActive = useIsActivePage("performance");

  const [cpu, setCpu] = useState<CpuUsage | null>(null);
  const [memory, setMemory] = useState<MemoryUsage | null>(null);
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [cpuHistory, setCpuHistory] = useState<ChartPoint[]>([]);
  const [memHistory, setMemHistory] = useState<ChartPoint[]>([]);
  const [toQuit, setToQuit] = useState<ProcessInfo | null>(null);

  const fetchFast = useCallback(async () => {
    const [cpuData, memData, procs] = await Promise.all([
      api.system.cpuUsage(),
      api.system.memoryUsage(),
      api.system.topProcesses(8),
    ]);
    const time = formatTime(new Date(), i18n.language);
    setCpu(cpuData);
    setMemory(memData);
    setProcesses(procs);
    setCpuHistory((prev) => [
      ...prev.slice(-(HISTORY - 1)),
      { time, value: cpuData.total },
    ]);
    setMemHistory((prev) => [
      ...prev.slice(-(HISTORY - 1)),
      { time, value: memData.percentUsed },
    ]);
  }, [i18n.language]);

  const fetchSlow = useCallback(async () => {
    const [diskData, batteryData, infoData] = await Promise.all([
      api.system.diskUsage(),
      api.system.batteryInfo(),
      api.system.info(),
    ]);
    setDisk(diskData);
    setBattery(batteryData);
    setInfo(infoData);
  }, []);

  // Only poll while this page is on screen.
  usePolling(fetchFast, 2000, isActive);
  usePolling(fetchSlow, 30_000, isActive);

  async function quitProcess() {
    const proc = toQuit;
    setToQuit(null);
    if (!proc) return;
    const result = await api.system.killProcess(proc.pid);
    if (result.success) {
      setProcesses((prev) => prev.filter((p) => p.pid !== proc.pid));
      toast.show({
        tone: "success",
        title: t("performance.quitSuccess", { name: proc.name }),
      });
    } else {
      toast.show({
        tone: "error",
        title: t("performance.quitFailed", { name: proc.name }),
        message: result.error,
      });
    }
  }

  const memSegments = memory
    ? [
        { key: "appMemory", value: memory.app, color: "var(--accent-primary)" },
        { key: "wired", value: memory.wired, color: "var(--warning)" },
        { key: "compressed", value: memory.compressed, color: "var(--danger)" },
        { key: "cached", value: memory.cached, color: "var(--info)" },
      ]
    : [];

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <PageHeader
          title={t("performance.title")}
          subtitle={t("performance.subtitle")}
        />

        <div className="perf-grid">
          {/* CPU */}
          <div className="perf-card">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <Cpu size={14} />
                {t("performance.cpuUsage")}
              </span>
              <span
                className={`status-badge ${level(cpu?.total ?? 0, 50, 80)}`}
              >
                {(cpu?.total ?? 0) >= 80
                  ? t("performance.high")
                  : (cpu?.total ?? 0) >= 50
                    ? t("performance.medium")
                    : t("performance.low")}
              </span>
            </div>
            <div className="perf-card-value">
              {cpu ? `${cpu.total.toFixed(1)}%` : "…"}
            </div>
            <div className="perf-card-label">
              {t("performance.user")} {cpu?.user.toFixed(1) ?? 0}% ·{" "}
              {t("performance.system")} {cpu?.system.toFixed(1) ?? 0}%
            </div>
            <UsageChart
              data={cpuHistory}
              color="var(--accent-primary)"
              id="cpuGradient"
            />
          </div>

          {/* Memory */}
          <div className="perf-card">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <MemoryStick size={14} />
                {t("performance.memory")}
              </span>
              <span
                className={`status-badge ${level(memory?.pressure ?? 0, 50, 75)}`}
              >
                {t("performance.pressure")}{" "}
                {memory ? `${Math.round(memory.pressure)}%` : "…"}
              </span>
            </div>
            <div className="perf-card-value">
              {memory ? `${memory.percentUsed.toFixed(1)}%` : "…"}
            </div>
            <div className="perf-card-label">
              {memory
                ? t("performance.usedOf", {
                    used: formatBytes(memory.used),
                    total: formatBytes(memory.total),
                  })
                : "…"}
            </div>
            <UsageChart
              data={memHistory}
              color="var(--success)"
              id="memGradient"
            />
          </div>

          {/* Memory breakdown */}
          {memory && (
            <div className="perf-card span-2">
              <div className="stacked-bar" aria-hidden="true">
                {memSegments.map((s) => (
                  <div
                    key={s.key}
                    className="stacked-bar-segment"
                    style={{
                      width: `${(s.value / memory.total) * 100}%`,
                      background: s.color,
                    }}
                  />
                ))}
              </div>
              <div className="storage-legend">
                {memSegments.map((s) => (
                  <div key={s.key} className="storage-legend-item">
                    <div
                      className="storage-legend-dot"
                      style={{ background: s.color }}
                    />
                    {t(`performance.${s.key}`)}{" "}
                    <strong>{formatBytes(s.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disk */}
          <div className="perf-card">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <HardDrive size={14} />
                {t("performance.diskUsage")}
              </span>
              <span
                className={`status-badge ${level(disk?.percentUsed ?? 0, 80, 90)}`}
              >
                {disk ? formatBytes(disk.free) : "…"} {t("common.free")}
              </span>
            </div>
            <div className="perf-card-value">
              {disk ? `${disk.percentUsed.toFixed(1)}%` : "…"}
            </div>
            <div className="perf-card-label">
              {disk
                ? t("performance.usedOf", {
                    used: formatBytes(disk.used),
                    total: formatBytes(disk.total),
                  })
                : "…"}
            </div>
            <div className="storage-bar" style={{ marginTop: 16 }}>
              <div
                className="storage-segment"
                style={{
                  width: `${disk?.percentUsed ?? 0}%`,
                  background: "var(--accent-gradient)",
                }}
              />
            </div>
          </div>

          {/* System info / battery */}
          <div className="perf-card">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <Laptop size={14} />
                {t("performance.systemInfo")}
              </span>
              {battery && (
                <span
                  className={`status-badge ${battery.percentCharge <= 20 ? "error" : "done"}`}
                >
                  {battery.isCharging ? (
                    <BatteryCharging size={12} />
                  ) : (
                    <Battery size={12} />
                  )}
                  {battery.percentCharge}%
                </span>
              )}
            </div>
            <dl className="info-list">
              <div>
                <dt>{t("performance.chip")}</dt>
                <dd title={info?.chip}>
                  {info
                    ? `${info.chip} · ${t("performance.cores", { count: info.cores })}`
                    : "…"}
                </dd>
              </div>
              <div>
                <dt>{t("performance.os")}</dt>
                <dd>{info?.osVersion ?? "…"}</dd>
              </div>
              <div>
                <dt>{t("performance.uptime")}</dt>
                <dd>{info ? formatDuration(info.uptime) : "…"}</dd>
              </div>
              {battery && (
                <div>
                  <dt>{t("performance.battery")}</dt>
                  <dd>
                    {t("performance.batteryHealth")} {battery.healthPercent}% ·{" "}
                    {t("performance.batteryCycles")} {battery.cycleCount}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Processes */}
          <div className="perf-card span-2">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <Zap size={14} />
                {t("performance.topProcesses")}
              </span>
            </div>
            <table className="process-table">
              <thead>
                <tr>
                  <th>{t("performance.process")}</th>
                  <th className="num">{t("performance.cpu")}</th>
                  <th className="num">{t("performance.memory")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {processes.map((proc) => (
                  <tr key={proc.pid}>
                    <td>
                      <span
                        className="process-name"
                        title={`${proc.name} (PID ${proc.pid})`}
                      >
                        {proc.name}
                      </span>
                    </td>
                    <td className="num">
                      <span className={`cpu-pill ${level(proc.cpu, 25, 60)}`}>
                        {proc.cpu.toFixed(1)}%
                      </span>
                    </td>
                    <td className="num">{formatBytes(proc.memoryBytes)}</td>
                    <td className="num">
                      <button
                        className="icon-btn danger"
                        title={t("performance.quit")}
                        aria-label={`${t("performance.quit")} ${proc.name}`}
                        onClick={() => setToQuit(proc)}
                      >
                        <XCircle size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={toQuit !== null}
        title={t("performance.quitConfirmTitle", { name: toQuit?.name ?? "" })}
        message={t("performance.quitConfirmMessage")}
        confirmLabel={t("performance.quit")}
        variant="danger"
        onConfirm={quitProcess}
        onCancel={() => setToQuit(null)}
      />
    </div>
  );
}
