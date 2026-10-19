import type { ElectronAPI } from "../../shared/api";
import type {
  AppInfo,
  AppSettings,
  AppStats,
  JunkItem,
  LargeFile,
  Page,
  ScanProgress,
  StartupItem,
  SystemJunkResult,
} from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/defaults";

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const HOME = "/Users/demo";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function items(dir: string, names: string[], maxMB: number): JunkItem[] {
  return names.map((name, i) => ({
    path: `${dir}/${name}`,
    name,
    size: Math.round(((names.length - i) / names.length) * maxMB * MB),
  }));
}

function mockJunk(): SystemJunkResult[] {
  const make = (
    id: SystemJunkResult["id"],
    files: JunkItem[],
    defaultSelected = true,
  ): SystemJunkResult => ({
    id,
    files,
    defaultSelected,
    totalSize: files.reduce((s, f) => s + f.size, 0),
  });
  return [
    make("userCache", items(`${HOME}/Library/Caches`, ["Google", "com.spotify.client", "Yarn", "pip", "com.microsoft.VSCode.ShipIt", "Slack", "JetBrains"], 900)),
    make("xcode", items(`${HOME}/Library/Developer/Xcode/DerivedData`, ["MyApp-abcd", "Widget-efgh", "ModuleCache.noindex"], 2200)),
    make("trash", items(`${HOME}/.Trash`, ["old-project.zip", "Screenshot 2025.png"], 400)),
    make("userLogs", items(`${HOME}/Library/Logs`, ["DiagnosticReports", "JetBrains", "Homebrew"], 120)),
    make("tempFiles", items("/var/folders/xx/T", ["TemporaryItems", "node-compile-cache"], 90)),
    make("devCaches", items(`${HOME}/.npm/_cacache`, ["content-v2", "index-v5"], 1300), false),
    make("oldDownloads", items(`${HOME}/Downloads`, ["Installer.dmg", "dataset.csv"], 1500), false),
  ];
}

const LARGE_FILES: Array<[string, number, LargeFile["kind"], number]> = [
  ["Downloads/ubuntu-24.04-desktop.iso", 5.7 * GB, "diskImage", 220],
  ["Movies/vacation-4k.mov", 3.1 * GB, "video", 400],
  ["Downloads/Xcode_16.xip", 2.9 * GB, "archive", 120],
  ["Documents/backup-2024.zip", 1.4 * GB, "archive", 300],
  ["Music/podcast-raw.wav", 820 * MB, "audio", 45],
  ["Pictures/panorama.psd", 610 * MB, "image", 30],
  ["Documents/annual-report.key", 380 * MB, "document", 12],
  ["Downloads/Docker.dmg", 210 * MB, "diskImage", 600],
];

const APPS: AppInfo[] = [
  ["Xcode", 12.5 * GB, "com.apple.dt.Xcode", 3],
  ["Adobe Photoshop 2025", 3.2 * GB, "com.adobe.Photoshop", 200],
  ["Docker", 2.1 * GB, "com.docker.docker", 1],
  ["Google Chrome", 1.2 * GB, "com.google.Chrome", 0],
  ["Visual Studio Code", 640 * MB, "com.microsoft.VSCode", 0],
  ["Slack", 510 * MB, "com.tinyspeck.slackmacgap", 2],
  ["Spotify", 380 * MB, "com.spotify.client", 9],
  ["Figma", 350 * MB, "com.figma.Desktop", 400],
].map(([name, size, bundleId, days]) => ({
  name: name as string,
  path: `/Applications/${name}.app`,
  size: size as number,
  bundleId: bundleId as string,
  version: "1.0.0",
  lastUsed: daysAgo(days as number),
}));

const STARTUP: StartupItem[] = [
  ["Docker", "com.docker.helper", "/Applications/Docker.app/Contents/MacOS/com.docker.helper", "LaunchAgent", "user", true],
  ["Google Keystone Agent", "com.google.keystone.agent", "/Library/Google/GoogleSoftwareUpdate/Agent", "LaunchAgent", "user", true],
  ["Spotify", "com.spotify.webhelper", "/Applications/Spotify.app/Contents/MacOS/SpotifyWebHelper", "LaunchAgent", "user", false],
  ["Microsoft Autoupdate", "com.microsoft.autoupdate.helper", "/Library/PrivilegedHelperTools/com.microsoft.autoupdate.helper", "LaunchDaemon", "system", true],
  ["Virtualbox Startup", "org.virtualbox.startup", "/Library/Application Support/VirtualBox/Startup.sh", "LaunchDaemon", "system", false],
].map(([name, label, programPath, kind, scope, isEnabled]) => ({
  name: name as string,
  label: label as string,
  path: `${scope === "system" ? "/Library/LaunchDaemons" : `${HOME}/Library/LaunchAgents`}/${label}.plist`,
  programPath: programPath as string,
  kind: kind as StartupItem["kind"],
  scope: scope as StartupItem["scope"],
  isEnabled: isEnabled as boolean,
  appPath: (programPath as string).includes(".app") ? (programPath as string).split(".app")[0] + ".app" : null,
}));

export function createMockApi(): ElectronAPI {
  let settings: AppSettings = { ...DEFAULT_SETTINGS };
  try {
    const stored = localStorage.getItem("macsweep-settings");
    if (stored) settings = { ...settings, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  let stats: AppStats = {
    totalFreed: 18.4 * GB,
    cleanCount: 12,
    lastScanAt: daysAgo(3),
    lastCleanAt: daysAgo(3),
    lastScanJunkSize: 4.2 * GB,
  };
  let junk = mockJunk();
  let diskFree = 182 * GB;
  const progressListeners = new Set<(p: ScanProgress) => void>();
  const statsListeners = new Set<(s: AppStats) => void>();
  const navListeners = new Set<(p: Page) => void>();
  const sub = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => void set.delete(cb);
  };
  const removeJunk = (paths: string[]) => {
    const set = new Set(paths);
    let freed = 0;
    junk = junk
      .map((cat) => {
        const files = cat.files.filter((f) => {
          if (set.has(f.path)) {
            freed += f.size;
            return false;
          }
          return true;
        });
        return { ...cat, files, totalSize: files.reduce((s, f) => s + f.size, 0) };
      })
      .filter((cat) => cat.files.length > 0);
    diskFree += freed;
    stats = { ...stats, totalFreed: stats.totalFreed + freed, cleanCount: stats.cleanCount + 1, lastCleanAt: new Date().toISOString() };
    statsListeners.forEach((cb) => cb(stats));
    return freed;
  };

  return {
    scan: {
      systemJunk: async () => {
        for (let i = 0; i <= 7; i++) {
          progressListeners.forEach((cb) => cb({ progress: Math.round((i / 7) * 100), categoryId: junk[i]?.id }));
          await wait(350);
        }
        stats = { ...stats, lastScanAt: new Date().toISOString() };
        return junk;
      },
      largeFiles: async () => {
        await wait(1500);
        return LARGE_FILES.map(([rel, size, kind, days]) => ({
          path: `${HOME}/${rel}`,
          name: rel.split("/").pop()!,
          size,
          kind,
          extension: `.${rel.split(".").pop()}`,
          lastModified: daysAgo(days),
          lastAccessed: daysAgo(days / 2),
        }));
      },
      applications: async () => {
        await wait(1200);
        return APPS;
      },
      startupItems: async () => {
        await wait(800);
        return STARTUP;
      },
      onProgress: (cb) => sub(progressListeners, cb),
    },
    clean: {
      files: async (paths) => {
        await wait(900);
        const locked = paths.filter((p) => p.includes("DiagnosticReports"));
        const freedSpace = removeJunk(paths.filter((p) => !locked.includes(p)));
        return { success: locked.length === 0, freedSpace, errors: [], failedPaths: locked, needsAdminPaths: locked };
      },
      filesAsAdmin: async (paths) => {
        await wait(900);
        return { success: true, freedSpace: removeJunk(paths), errors: [], failedPaths: [], needsAdminPaths: [] };
      },
    },
    apps: {
      getIcon: async () => null,
      leftovers: async (app) => {
        await wait(400);
        const id = app.bundleId ?? app.name;
        return [
          { path: `${HOME}/Library/Application Support/${app.name}`, size: 240 * MB, kind: "support" },
          { path: `${HOME}/Library/Caches/${id}`, size: 96 * MB, kind: "cache" },
          { path: `${HOME}/Library/Preferences/${id}.plist`, size: 12 * 1024, kind: "preferences" },
        ];
      },
      uninstall: async (req) => {
        await wait(1000);
        const app = APPS.find((a) => a.path === req.appPath);
        return { success: true, freedSpace: (app?.size ?? 0) + 336 * MB, cancelled: false, errors: [] };
      },
    },
    system: {
      cpuUsage: async () => {
        const user = 8 + Math.random() * 30;
        const system = 4 + Math.random() * 12;
        return { user, system, idle: 100 - user - system, total: user + system };
      },
      memoryUsage: async () => {
        const total = 16 * GB;
        const app = (6 + Math.random()) * GB;
        const wired = 2.4 * GB;
        const compressed = 1.1 * GB;
        const used = app + wired + compressed;
        return { total, used, free: total - used, percentUsed: (used / total) * 100, app, wired, compressed, cached: 3.6 * GB, pressure: 24 + Math.random() * 6 };
      },
      diskUsage: async () => {
        const total = 494 * GB;
        return { total, free: diskFree, used: total - diskFree, percentUsed: ((total - diskFree) / total) * 100, mount: "/" };
      },
      batteryInfo: async () => ({
        cycleCount: 214, maxCapacity: 4382, designCapacity: 4790, currentCapacity: 3700,
        percentCharge: 84, isCharging: false, isFullyCharged: false, condition: "normal",
        temperature: 30.4, healthPercent: 91,
      }),
      topProcesses: async (limit = 5) =>
        [
          ["Google Chrome Helper", 18.2, 1.4 * GB], ["Code Helper (Renderer)", 9.6, 820 * MB],
          ["Slack", 4.1, 610 * MB], ["Docker", 3.4, 1.9 * GB], ["Spotify", 1.2, 380 * MB],
          ["Figma", 0.8, 420 * MB],
        ].slice(0, limit).map(([name, cpu, bytes], i) => ({
          pid: 4000 + i, name: name as string, cpu: cpu as number,
          memory: ((bytes as number) / (16 * GB)) * 100, memoryBytes: bytes as number,
        })),
      killProcess: async () => ({ success: true }),
      info: async () => ({
        model: "Mac15,6", chip: "Apple M3 Pro", osVersion: "macOS 15.1 (24B83)",
        hostname: "demo-macbook", uptime: 3 * 86400 + 4 * 3600, cores: 12, totalMemory: 16 * GB,
      }),
    },
    maintenance: {
      run: async (taskIds) => {
        await wait(1500);
        return taskIds.map((taskId) => ({
          taskId, success: true, cancelled: false,
          detail: taskId === "freeRam" ? "1.24 GB" : undefined,
        }));
      },
    },
    startup: {
      setEnabled: async () => {
        await wait(300);
        return { success: true, cancelled: false };
      },
    },
    shell: {
      moveToTrash: async (paths) => {
        await wait(500);
        return { moved: paths, failed: [] };
      },
      revealInFinder: async () => {},
      openPath: async () => {},
      quickLook: async () => {},
      openFullDiskAccessSettings: async () => {},
    },
    settings: {
      load: async () => settings,
      save: async (next) => {
        settings = next;
        try {
          localStorage.setItem("macsweep-settings", JSON.stringify(next));
        } catch {
          // ignore
        }
      },
      chooseFolder: async () => `${HOME}/Projects`,
    },
    app: {
      meta: async () => ({
        name: "MacSweep", version: "1.1.0 (web preview)", electron: "—", chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "—",
        node: "—", dataPath: `${HOME}/Library/Application Support/MacSweep`, dataSize: 2.4 * MB,
      }),
      stats: async () => stats,
      openReleases: async () => {
        window.open("https://github.com/othiagobruno/cleanmymac/releases", "_blank");
      },
      onNavigate: (cb) => sub(navListeners, cb),
      onStatsChanged: (cb) => sub(statsListeners, cb),
    },
  };
}
