import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface CpuUsage {
  user: number;
  system: number;
  idle: number;
  total: number;
}

export interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
  mount: string;
}

export async function getCpuUsage(): Promise<CpuUsage> {
  try {
    const { stdout } = await execAsync(`top -l 1 -n 0 | grep "CPU usage"`);
    const match = stdout.match(
      /(\d+\.?\d*)% user.*?(\d+\.?\d*)% sys.*?(\d+\.?\d*)% idle/,
    );
    if (match) {
      const user = parseFloat(match[1]);
      const system = parseFloat(match[2]);
      const idle = parseFloat(match[3]);
      return {
        user,
        system,
        idle,
        total: user + system,
      };
    }
  } catch {
    // fallback
  }

  const cpus = os.cpus();
  let totalUser = 0;
  let totalSys = 0;
  let totalIdle = 0;
  for (const cpu of cpus) {
    totalUser += cpu.times.user;
    totalSys += cpu.times.sys;
    totalIdle += cpu.times.idle;
  }
  const totalAll = totalUser + totalSys + totalIdle;
  return {
    user: (totalUser / totalAll) * 100,
    system: (totalSys / totalAll) * 100,
    idle: (totalIdle / totalAll) * 100,
    total: ((totalUser + totalSys) / totalAll) * 100,
  };
}

export function getMemoryUsage(): MemoryUsage {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    used,
    free,
    percentUsed: (used / total) * 100,
  };
}

export interface BatteryInfo {
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

export async function getBatteryInfo(): Promise<BatteryInfo | null> {
  try {
    const { stdout } = await execAsync("ioreg -rc AppleSmartBattery");

    const extract = (key: string): string | null => {
      const regex = new RegExp(`"${key}"\\s*=\\s*(.+)`);
      const match = stdout.match(regex);
      return match ? match[1].trim() : null;
    };

    const cycleCount = parseInt(extract("CycleCount") || "0", 10);
    const maxCapacity = parseInt(
      extract("AppleRawMaxCapacity") || extract("MaxCapacity") || "0",
      10,
    );
    const designCapacity = parseInt(extract("DesignCapacity") || "0", 10);
    const currentCapacity = parseInt(
      extract("AppleRawCurrentCapacity") || extract("CurrentCapacity") || "0",
      10,
    );
    const isCharging = extract("IsCharging") === "Yes";
    const isFullyCharged = extract("FullyCharged") === "Yes";
    const temperature = parseInt(extract("Temperature") || "0", 10) / 100;

    const percentCharge =
      maxCapacity > 0 ? Math.round((currentCapacity / maxCapacity) * 100) : 0;

    const healthPercent =
      designCapacity > 0
        ? Math.round((maxCapacity / designCapacity) * 100)
        : 100;

    let condition = "Normal";
    if (healthPercent < 60) condition = "Replace Soon";
    else if (healthPercent < 80) condition = "Fair";
    else if (healthPercent >= 80) condition = "Normal";

    return {
      cycleCount,
      maxCapacity,
      designCapacity,
      currentCapacity,
      percentCharge,
      isCharging,
      isFullyCharged,
      condition,
      temperature,
      healthPercent,
    };
  } catch {
    return null;
  }
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  memoryBytes: number;
}

export async function getTopProcesses(): Promise<ProcessInfo[]> {
  try {
    // Get top processes sorted by CPU usage — fetch more to filter system ones
    const { stdout } = await execAsync(
      "ps -Arco pid,pcpu,pmem,rss,comm | head -30",
    );

    const lines = stdout.trim().split("\n");
    const processes: ProcessInfo[] = [];

    // System / daemon processes to exclude
    const SYSTEM_PROCESSES = new Set([
      "kernel_task",
      "WindowServer",
      "launchd",
      "loginwindow",
      "hidd",
      "UserEventAgent",
      "distnoted",
      "trustd",
      "opendirectoryd",
      "syslogd",
      "mds",
      "mds_stores",
      "mdworker",
      "mdworker_shared",
      "cfprefsd",
      "filecoordinationd",
      "powerd",
      "corebrightnessd",
      "bluetoothd",
      "airportd",
      "coreaudiod",
      "audioclocksyncd",
      "displaypolicyd",
      "thermalmonitord",
      "systemstats",
      "watchdogd",
      "containermanagerd",
      "symptomsd",
      "coreservicesd",
      "notifyd",
      "logd",
      "contextstored",
      "lsd",
      "pboard",
      "iconservicesagent",
      "securityd",
      "taskgated",
      "diskarbitrationd",
      "fseventsd",
      "configd",
      "usermanagerd",
      "revisiond",
      "remoted",
      "rapportd",
      "mediaremoted",
      "CommCenter",
      "dasd",
      "runningboardd",
      "sharingd",
      "ctkd",
      "nsurlsessiond",
      "cloudd",
      "Electron",
    ]);

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 5) continue;

      const pid = parseInt(parts[0], 10);
      const cpu = parseFloat(parts[1]);
      const mem = parseFloat(parts[2]);
      const rssKb = parseInt(parts[3], 10);
      const name = parts.slice(4).join(" ");

      // Skip system processes
      if (SYSTEM_PROCESSES.has(name)) continue;

      processes.push({
        pid,
        name,
        cpu,
        memory: mem,
        memoryBytes: rssKb * 1024,
      });

      if (processes.length >= 4) break;
    }

    return processes;
  } catch {
    return [];
  }
}

export async function killProcess(
  pid: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`kill -9 ${pid}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function getDiskUsage(): Promise<DiskUsage> {
  try {
    const { stdout } = await execAsync("diskutil info /");
    const totalMatch = stdout.match(
      /Container Total Space:\s+[\d.]+ \w+ \((\d+) Bytes\)/,
    );
    const freeMatch = stdout.match(
      /Container Free Space:\s+[\d.]+ \w+ \((\d+) Bytes\)/,
    );

    if (totalMatch && freeMatch) {
      const total = parseInt(totalMatch[1], 10);
      const free = parseInt(freeMatch[1], 10);
      const used = total - free;
      return {
        total,
        used,
        free,
        percentUsed: (used / total) * 100,
        mount: "/",
      };
    }

    // Fallback to df if diskutil parsing fails
    const { stdout: dfOut } = await execAsync("df -k / | tail -1");
    const parts = dfOut.trim().split(/\s+/);
    const total = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const free = parseInt(parts[3], 10) * 1024;
    return {
      total,
      used,
      free,
      percentUsed: (used / total) * 100,
      mount: "/",
    };
  } catch {
    return {
      total: 0,
      used: 0,
      free: 0,
      percentUsed: 0,
      mount: "/",
    };
  }
}
