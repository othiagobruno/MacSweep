import os from "node:os";
import { tryRun } from "./exec";
import type {
  BatteryInfo,
  CpuUsage,
  DiskUsage,
  KillResult,
  MemoryUsage,
  ProcessInfo,
  SystemInfo,
} from "../../shared/types";

/* ── CPU ───────────────────────────────────────────── */

interface CpuTicks {
  user: number;
  system: number;
  idle: number;
  total: number;
}

function readTicks(): CpuTicks {
  let user = 0;
  let system = 0;
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    user += t.user + t.nice;
    system += t.sys + t.irq;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { user, system, idle, total };
}

let previousTicks = readTicks();

/** CPU usage since the previous call (sampled from kernel tick counters). */
export async function getCpuUsage(): Promise<CpuUsage> {
  let current = readTicks();
  if (current.total - previousTicks.total <= 0) {
    await new Promise((r) => setTimeout(r, 250));
    current = readTicks();
  }
  const dTotal = current.total - previousTicks.total || 1;
  const user = ((current.user - previousTicks.user) / dTotal) * 100;
  const system = ((current.system - previousTicks.system) / dTotal) * 100;
  const idle = ((current.idle - previousTicks.idle) / dTotal) * 100;
  previousTicks = current;
  return { user, system, idle, total: Math.min(100, user + system) };
}

/* ── Memory ────────────────────────────────────────── */

export function parseVmStat(stdout: string): Record<string, number> {
  const values: Record<string, number> = {};
  const pageSize = stdout.match(/page size of (\d+) bytes/);
  values.pageSize = pageSize ? parseInt(pageSize[1], 10) : 4096;
  for (const line of stdout.split("\n")) {
    const match = line.match(/^"?([^:"]+)"?:\s+(\d+)\.?$/);
    if (match) values[match[1].trim()] = parseInt(match[2], 10);
  }
  return values;
}

/**
 * Mirrors Activity Monitor: used = app memory + wired + compressed.
 * os.freemem() on macOS only counts truly free pages, which makes memory
 * always look ~100% used, so we read vm_stat instead.
 */
export function memoryFromVmStat(
  vm: Record<string, number>,
  total: number,
  pressure: number,
): MemoryUsage {
  const page = vm.pageSize;
  const anonymous = vm["Anonymous pages"] ?? vm["Pages active"] ?? 0;
  const purgeable = vm["Pages purgeable"] ?? 0;
  const app = Math.max(0, anonymous - purgeable) * page;
  const wired = (vm["Pages wired down"] ?? 0) * page;
  const compressed = (vm["Pages occupied by compressor"] ?? 0) * page;
  const cached = ((vm["File-backed pages"] ?? 0) + purgeable) * page;
  const used = Math.min(total, app + wired + compressed);
  return {
    total,
    used,
    free: total - used,
    percentUsed: (used / total) * 100,
    app,
    wired,
    compressed,
    cached,
    pressure,
  };
}

export async function getMemoryUsage(): Promise<MemoryUsage> {
  const total = os.totalmem();
  const [vmOut, levelOut] = await Promise.all([
    tryRun("vm_stat"),
    tryRun("sysctl", ["-n", "kern.memorystatus_level"]),
  ]);
  const level = levelOut ? parseInt(levelOut.trim(), 10) : NaN;
  const pressure = Number.isFinite(level) ? 100 - level : 0;

  if (vmOut) return memoryFromVmStat(parseVmStat(vmOut), total, pressure);

  const free = os.freemem();
  return {
    total,
    used: total - free,
    free,
    percentUsed: ((total - free) / total) * 100,
    app: total - free,
    wired: 0,
    compressed: 0,
    cached: 0,
    pressure,
  };
}

/* ── Disk ──────────────────────────────────────────── */

export async function getDiskUsage(): Promise<DiskUsage> {
  const info = await tryRun("diskutil", ["info", "/"]);
  if (info) {
    const total = info.match(/Container Total Space:\s+.*?\((\d+) Bytes\)/);
    const free = info.match(/Container Free Space:\s+.*?\((\d+) Bytes\)/);
    if (total && free) {
      const t = parseInt(total[1], 10);
      const f = parseInt(free[1], 10);
      return { total: t, used: t - f, free: f, percentUsed: ((t - f) / t) * 100, mount: "/" };
    }
  }

  const df = await tryRun("df", ["-k", "/"]);
  if (df) {
    const parts = df.trim().split("\n").pop()!.split(/\s+/);
    const total = parseInt(parts[1], 10) * 1024;
    const free = parseInt(parts[3], 10) * 1024;
    if (total > 0) {
      return { total, used: total - free, free, percentUsed: ((total - free) / total) * 100, mount: "/" };
    }
  }
  return { total: 0, used: 0, free: 0, percentUsed: 0, mount: "/" };
}

/* ── Battery ───────────────────────────────────────── */

export async function getBatteryInfo(): Promise<BatteryInfo | null> {
  const stdout = await tryRun("ioreg", ["-rc", "AppleSmartBattery"]);
  if (!stdout || !stdout.includes("CycleCount")) return null;

  const extract = (key: string): string | null => {
    const match = stdout.match(new RegExp(`"${key}"\\s*=\\s*(.+)`));
    return match ? match[1].trim() : null;
  };
  const num = (...keys: string[]) => {
    for (const key of keys) {
      const value = parseInt(extract(key) ?? "", 10);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  };

  const cycleCount = num("CycleCount");
  const maxCapacity = num("AppleRawMaxCapacity", "MaxCapacity");
  const designCapacity = num("DesignCapacity");
  const currentCapacity = num("AppleRawCurrentCapacity", "CurrentCapacity");
  // "CurrentCapacity" is already a percentage on Apple Silicon.
  const reportedPct = num("CurrentCapacity");
  const percentCharge =
    reportedPct > 0 && reportedPct <= 100
      ? reportedPct
      : maxCapacity > 0
        ? Math.round((currentCapacity / maxCapacity) * 100)
        : 0;
  const healthPercent =
    designCapacity > 0
      ? Math.min(100, Math.round((maxCapacity / designCapacity) * 100))
      : 100;

  return {
    cycleCount,
    maxCapacity,
    designCapacity,
    currentCapacity,
    percentCharge,
    isCharging: extract("IsCharging") === "Yes",
    isFullyCharged: extract("FullyCharged") === "Yes",
    condition:
      healthPercent < 60 ? "replaceSoon" : healthPercent < 80 ? "fair" : "normal",
    temperature: num("Temperature") / 100,
    healthPercent,
  };
}

/* ── Processes ─────────────────────────────────────── */

const SYSTEM_PROCESSES = new Set([
  "kernel_task", "WindowServer", "launchd", "loginwindow", "hidd",
  "UserEventAgent", "distnoted", "trustd", "opendirectoryd", "syslogd",
  "mds", "mds_stores", "mdworker", "mdworker_shared", "cfprefsd",
  "filecoordinationd", "powerd", "corebrightnessd", "bluetoothd",
  "airportd", "coreaudiod", "audioclocksyncd", "displaypolicyd",
  "thermalmonitord", "systemstats", "watchdogd", "containermanagerd",
  "symptomsd", "coreservicesd", "notifyd", "logd", "contextstored", "lsd",
  "pboard", "iconservicesagent", "securityd", "taskgated",
  "diskarbitrationd", "fseventsd", "configd", "usermanagerd", "revisiond",
  "remoted", "rapportd", "mediaremoted", "CommCenter", "dasd",
  "runningboardd", "sharingd", "ctkd", "nsurlsessiond", "cloudd", "ps",
]);

export async function getTopProcesses(limit = 5): Promise<ProcessInfo[]> {
  const stdout = await tryRun("ps", ["-Arco", "pid,pcpu,pmem,rss,comm"]);
  if (!stdout) return [];
  const max = Math.min(50, Math.max(1, Math.round(limit)));
  const processes: ProcessInfo[] = [];

  for (const line of stdout.trim().split("\n").slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const pid = parseInt(parts[0], 10);
    const name = parts.slice(4).join(" ");
    if (pid === process.pid || SYSTEM_PROCESSES.has(name)) continue;
    processes.push({
      pid,
      name,
      cpu: parseFloat(parts[1]),
      memory: parseFloat(parts[2]),
      memoryBytes: parseInt(parts[3], 10) * 1024,
    });
    if (processes.length >= max) break;
  }
  return processes;
}

export async function killProcess(pid: unknown): Promise<KillResult> {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 1) {
    return { success: false, error: "Invalid process id" };
  }
  if (pid === process.pid || pid === process.ppid) {
    return { success: false, error: "Refusing to terminate MacSweep" };
  }
  try {
    process.kill(pid, "SIGTERM");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/* ── System info ───────────────────────────────────── */

let cachedInfo: Omit<SystemInfo, "uptime"> | null = null;

export async function getSystemInfo(): Promise<SystemInfo> {
  if (!cachedInfo) {
    const [model, productVersion, buildVersion] = await Promise.all([
      tryRun("sysctl", ["-n", "hw.model"]),
      tryRun("sw_vers", ["-productVersion"]),
      tryRun("sw_vers", ["-buildVersion"]),
    ]);
    const cpus = os.cpus();
    cachedInfo = {
      model: model?.trim() || "Mac",
      chip: cpus[0]?.model.trim() || os.arch(),
      osVersion: productVersion
        ? `macOS ${productVersion.trim()} (${buildVersion?.trim() ?? ""})`
        : `${os.type()} ${os.release()}`,
      hostname: os.hostname().replace(/\.local$/, ""),
      cores: cpus.length,
      totalMemory: os.totalmem(),
    };
  }
  return { ...cachedInfo, uptime: os.uptime() };
}
