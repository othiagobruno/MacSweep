import { useState, useEffect, useRef } from "react";
import { Cpu, MemoryStick, HardDrive, Gauge } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Area,
  AreaChart,
  Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";
import { formatBytes } from "../utils";
import type { CpuUsage, MemoryUsage, DiskUsage } from "../types";

interface ChartDataPoint {
  time: string;
  value: number;
}

export function Performance() {
  const { t } = useTranslation();
  const [cpu, setCpu] = useState<CpuUsage | null>(null);
  const [memory, setMemory] = useState<MemoryUsage | null>(null);
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [cpuHistory, setCpuHistory] = useState<ChartDataPoint[]>([]);
  const [memHistory, setMemHistory] = useState<ChartDataPoint[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 2000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  async function fetchData() {
    const now = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    try {
      if (window.electronAPI) {
        const [cpuData, memData, diskData] = await Promise.all([
          window.electronAPI.system.cpuUsage(),
          window.electronAPI.system.memoryUsage(),
          window.electronAPI.system.diskUsage(),
        ]);
        setCpu(cpuData);
        setMemory(memData);
        setDisk(diskData);

        setCpuHistory((prev) => [
          ...prev.slice(-29),
          { time: now, value: cpuData.total },
        ]);
        setMemHistory((prev) => [
          ...prev.slice(-29),
          { time: now, value: memData.percentUsed },
        ]);
      } else {
        // Mock data
        const mockCpu = {
          user: Math.random() * 40 + 10,
          system: Math.random() * 20 + 5,
          idle: 0,
          total: 0,
        };
        mockCpu.total = mockCpu.user + mockCpu.system;
        mockCpu.idle = 100 - mockCpu.total;

        const mockMem = {
          total: 16 * 1024 * 1024 * 1024,
          used: (8 + Math.random() * 4) * 1024 * 1024 * 1024,
          free: 0,
          percentUsed: 0,
        };
        mockMem.free = mockMem.total - mockMem.used;
        mockMem.percentUsed = (mockMem.used / mockMem.total) * 100;

        setCpu(mockCpu);
        setMemory(mockMem);
        setDisk({
          total: 500 * 1024 * 1024 * 1024,
          used: 320 * 1024 * 1024 * 1024,
          free: 180 * 1024 * 1024 * 1024,
          percentUsed: 64,
          mount: "/",
        });

        setCpuHistory((prev) => [
          ...prev.slice(-29),
          { time: now, value: mockCpu.total },
        ]);
        setMemHistory((prev) => [
          ...prev.slice(-29),
          { time: now, value: mockMem.percentUsed },
        ]);
      }
    } catch {
      // silently fail
    }
  }

  return (
    <div className="page-container">
      <div className="page-scrollable">
        <div className="page-header">
          <h1 className="page-title">{t("performance.title")}</h1>
          <p className="page-subtitle">{t("performance.subtitle")}</p>
        </div>

        <div className="perf-grid">
          {/* CPU Card */}
          <div className="perf-card">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <Cpu size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {t("performance.cpuUsage")}
              </span>
              <span
                className={`status-badge ${
                  (cpu?.total ?? 0) > 80
                    ? "error"
                    : (cpu?.total ?? 0) > 50
                      ? "running"
                      : "done"
                }`}
              >
                {(cpu?.total ?? 0) > 80
                  ? t("performance.high")
                  : (cpu?.total ?? 0) > 50
                    ? t("performance.medium")
                    : t("performance.low")}
              </span>
            </div>
            <div className="perf-card-value">
              {cpu ? `${cpu.total.toFixed(1)}%` : "..."}
            </div>
            <div className="perf-card-label">
              {t("performance.user")}: {cpu?.user.toFixed(1) ?? 0}% |{" "}
              {t("performance.system")}: {cpu?.system.toFixed(1) ?? 0}%
            </div>
            <div style={{ height: 120, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuHistory}>
                  <defs>
                    <linearGradient
                      id="cpuGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#6c5ce7" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6c5ce7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[0, 100]} hide />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6c5ce7"
                    strokeWidth={2}
                    fill="url(#cpuGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Memory Card */}
          <div className="perf-card">
            <div className="perf-card-header">
              <span className="perf-card-title">
                <MemoryStick
                  size={14}
                  style={{ marginRight: 6, verticalAlign: -2 }}
                />
                {t("performance.memory")}
              </span>
              <span
                className={`status-badge ${
                  (memory?.percentUsed ?? 0) > 85
                    ? "error"
                    : (memory?.percentUsed ?? 0) > 60
                      ? "running"
                      : "done"
                }`}
              >
                {memory
                  ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}`
                  : "..."}
              </span>
            </div>
            <div className="perf-card-value">
              {memory ? `${memory.percentUsed.toFixed(1)}%` : "..."}
            </div>
            <div className="perf-card-label">
              {t("performance.freeLabel")}:{" "}
              {memory ? formatBytes(memory.free) : "..."}
            </div>
            <div style={{ height: 120, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={memHistory}>
                  <defs>
                    <linearGradient
                      id="memGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#00d2a0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00d2a0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={[0, 100]} hide />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00d2a0"
                    strokeWidth={2}
                    fill="url(#memGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Disk Card */}
          <div className="perf-card" style={{ gridColumn: "span 2" }}>
            <div className="perf-card-header">
              <span className="perf-card-title">
                <HardDrive
                  size={14}
                  style={{ marginRight: 6, verticalAlign: -2 }}
                />
                {t("performance.diskUsage")}
              </span>
              <span className="status-badge idle">{disk?.mount ?? "/"}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 16,
              }}
            >
              <div>
                <div className="perf-card-value">
                  {disk ? `${disk.percentUsed.toFixed(1)}%` : "..."}
                </div>
                <div className="perf-card-label">
                  {disk
                    ? t("performance.usedOf", {
                        used: formatBytes(disk.used),
                        total: formatBytes(disk.total),
                      })
                    : "..."}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--success)",
                  }}
                >
                  {disk ? formatBytes(disk.free) : "..."}
                </div>
                <div className="perf-card-label">{t("common.available")}</div>
              </div>
            </div>
            <div className="storage-bar-container">
              <div className="storage-bar">
                <div
                  className="storage-segment"
                  style={{
                    width: `${disk?.percentUsed ?? 0}%`,
                    background:
                      "linear-gradient(90deg, #6c5ce7, #a29bfe, #74b9ff)",
                  }}
                />
              </div>
              <div className="storage-legend">
                <div className="storage-legend-item">
                  <div
                    className="storage-legend-dot"
                    style={{ background: "#6c5ce7" }}
                  />
                  {t("common.used")}
                </div>
                <div className="storage-legend-item">
                  <div
                    className="storage-legend-dot"
                    style={{ background: "var(--bg-tertiary)" }}
                  />
                  {t("performance.freeLabel")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
