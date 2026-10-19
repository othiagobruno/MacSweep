import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { shell } from "electron";
import {
  diskSize,
  errorMessage,
  isCancelled,
  mapLimit,
  run,
  runAsAdmin,
  shellQuote,
  tryRun,
} from "./exec";
import { checkDeletable } from "./safety";
import type {
  AppInfo,
  AppLeftover,
  LeftoverKind,
  UninstallRequest,
  UninstallResult,
} from "../../shared/types";

const iconCache = new Map<string, string | null>();

interface BundleMeta {
  bundleId: string | null;
  version: string | null;
  iconFile: string | null;
  displayName: string | null;
}

async function readBundleMeta(appPath: string): Promise<BundleMeta> {
  const plist = path.join(appPath, "Contents", "Info.plist");
  const out = await tryRun("plutil", ["-convert", "json", "-o", "-", plist]);
  if (!out) {
    return { bundleId: null, version: null, iconFile: null, displayName: null };
  }
  try {
    const data = JSON.parse(out) as Record<string, unknown>;
    const str = (key: string) =>
      typeof data[key] === "string" ? (data[key] as string) : null;
    return {
      bundleId: str("CFBundleIdentifier"),
      version: str("CFBundleShortVersionString") ?? str("CFBundleVersion"),
      iconFile: str("CFBundleIconFile"),
      displayName: str("CFBundleDisplayName"),
    };
  } catch {
    return { bundleId: null, version: null, iconFile: null, displayName: null };
  }
}

async function lastUsedDate(appPath: string): Promise<string | null> {
  const out = await tryRun("mdls", [
    "-name",
    "kMDItemLastUsedDate",
    "-raw",
    appPath,
  ]);
  if (!out || out.includes("(null)")) return null;
  const date = new Date(out.trim().replace(" +0000", "Z").replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Find .app bundles in a folder, descending one level into plain folders. */
async function findBundles(root: string, depth = 1): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const bundles: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.name.endsWith(".app")) {
      bundles.push(full);
    } else if (entry.isDirectory() && depth > 0 && entry.name !== "Utilities") {
      bundles.push(...(await findBundles(full, depth - 1)));
    }
  }
  return bundles;
}

/**
 * SIP-protected bundles (e.g. Safari) carry the "restricted" file flag and
 * cannot be removed even as root. Apple apps from the App Store (Xcode,
 * iMovie, GarageBand…) are not restricted and can be uninstalled normally.
 */
async function isSystemProtected(appPath: string): Promise<boolean> {
  const flags = await tryRun("stat", ["-f", "%Sf", appPath]);
  return flags !== null && /restricted|schg|uchg/.test(flags);
}

export async function scanApplications(): Promise<AppInfo[]> {
  const roots = ["/Applications", path.join(os.homedir(), "Applications")];
  const bundles = (await Promise.all(roots.map((r) => findBundles(r)))).flat();

  const apps = await mapLimit(bundles, 6, async (appPath) => {
    if (!checkDeletable(appPath).ok || (await isSystemProtected(appPath))) {
      return null;
    }
    const meta = await readBundleMeta(appPath);
    const [size, lastUsed] = await Promise.all([
      diskSize(appPath),
      lastUsedDate(appPath),
    ]);
    const info: AppInfo = {
      name: meta.displayName ?? path.basename(appPath, ".app"),
      path: appPath,
      size,
      bundleId: meta.bundleId,
      version: meta.version,
      lastUsed,
    };
    return info;
  });

  return apps
    .filter((a): a is AppInfo => a !== null)
    .sort((a, b) => b.size - a.size);
}

/**
 * Extract an app icon using macOS native tools (sips), bypassing Electron's
 * nativeImage to avoid Chromium NOTREACHED crashes on some .icns files.
 */
export async function getAppIcon(appPath: string): Promise<string | null> {
  if (typeof appPath !== "string" || !appPath.endsWith(".app")) return null;
  if (iconCache.has(appPath)) return iconCache.get(appPath) ?? null;

  let result: string | null = null;
  try {
    const meta = await readBundleMeta(appPath);
    if (meta.iconFile) {
      const iconFile = meta.iconFile.endsWith(".icns")
        ? meta.iconFile
        : `${meta.iconFile}.icns`;
      const icns = path.join(appPath, "Contents", "Resources", iconFile);
      await fs.promises.access(icns);
      const tmp = path.join(
        os.tmpdir(),
        `macsweep_icon_${process.pid}_${Math.random().toString(36).slice(2)}.png`,
      );
      await run("sips", ["-s", "format", "png", "-z", "64", "64", icns, "--out", tmp]);
      const png = await fs.promises.readFile(tmp);
      fs.promises.unlink(tmp).catch(() => {});
      result = `data:image/png;base64,${png.toString("base64")}`;
    }
  } catch {
    result = null;
  }
  iconCache.set(appPath, result);
  return result;
}

const LEFTOVER_LOCATIONS: Array<{ dir: string; kind: LeftoverKind }> = [
  { dir: "Library/Application Support", kind: "support" },
  { dir: "Library/Caches", kind: "cache" },
  { dir: "Library/Preferences", kind: "preferences" },
  { dir: "Library/Preferences/ByHost", kind: "preferences" },
  { dir: "Library/Logs", kind: "logs" },
  { dir: "Library/Saved Application State", kind: "savedState" },
  { dir: "Library/HTTPStorages", kind: "webData" },
  { dir: "Library/WebKit", kind: "webData" },
  { dir: "Library/Cookies", kind: "webData" },
  { dir: "Library/LaunchAgents", kind: "launchAgent" },
  { dir: "Library/Application Scripts", kind: "support" },
];

/**
 * Decide whether a Library entry belongs to an app. Matching is strict
 * (exact name/bundle id, or bundle id followed by a separator) to avoid
 * flagging files of unrelated apps.
 */
export function isLeftoverMatch(
  entry: string,
  app: { name: string; bundleId: string | null },
): boolean {
  const lower = entry.toLowerCase();
  const base = lower.replace(
    /\.(plist|savedstate|binarycookies)$/,
    "",
  );
  const id = app.bundleId?.toLowerCase();
  if (id) {
    if (base === id) return true;
    if (base.startsWith(`${id}.`) || base.startsWith(`${id}_`)) return true;
  }
  const name = app.name.toLowerCase();
  return name.length >= 4 && base === name;
}

export async function findLeftovers(app: AppInfo): Promise<AppLeftover[]> {
  const home = os.homedir();
  const found: AppLeftover[] = [];
  const seen = new Set<string>();

  for (const loc of LEFTOVER_LOCATIONS) {
    const dir = path.join(home, loc.dir);
    let names: string[];
    try {
      names = await fs.promises.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!isLeftoverMatch(name, app)) continue;
      const full = path.join(dir, name);
      if (seen.has(full) || !checkDeletable(full).ok) continue;
      seen.add(full);
      found.push({ path: full, kind: loc.kind, size: await diskSize(full) });
    }
  }

  return found.sort((a, b) => b.size - a.size);
}

async function runningPids(appPath: string): Promise<number[]> {
  const out = await tryRun("pgrep", ["-f", `${appPath}/Contents/MacOS/`]);
  if (!out) return [];
  return out
    .split("\n")
    .map((l) => parseInt(l, 10))
    .filter((pid) => Number.isInteger(pid) && pid !== process.pid);
}

async function quitApp(appPath: string): Promise<void> {
  const pids = await runningPids(appPath);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already exited or not ours to kill
    }
  }
  if (pids.length > 0) await new Promise((r) => setTimeout(r, 1200));
}

export async function uninstallApp(
  request: UninstallRequest,
): Promise<UninstallResult> {
  const errors: string[] = [];
  const appPath = request?.appPath;

  if (
    typeof appPath !== "string" ||
    !appPath.endsWith(".app") ||
    !checkDeletable(appPath).ok
  ) {
    return {
      success: false,
      freedSpace: 0,
      cancelled: false,
      errors: ["This application cannot be removed."],
    };
  }

  const meta = await readBundleMeta(appPath);
  if (await isSystemProtected(appPath)) {
    return {
      success: false,
      freedSpace: 0,
      cancelled: false,
      errors: ["System applications cannot be removed."],
    };
  }

  await quitApp(appPath);

  let freedSpace = 0;
  const appSize = await diskSize(appPath);
  try {
    await shell.trashItem(appPath);
    freedSpace += appSize;
  } catch {
    // Root-owned bundles (installed via .pkg) need elevated privileges.
    try {
      await runAsAdmin(
        `/bin/rm -rf -- ${shellQuote(appPath)}`,
        `MacSweep needs your password to remove ${path.basename(appPath)}.`,
      );
      freedSpace += appSize;
    } catch (err) {
      return {
        success: false,
        freedSpace: 0,
        cancelled: isCancelled(err),
        errors: [errorMessage(err)],
      };
    }
  }

  const leftovers = Array.isArray(request.leftoverPaths)
    ? request.leftoverPaths
    : [];
  const names = [path.basename(appPath, ".app"), meta.displayName].filter(
    (n): n is string => Boolean(n),
  );
  const belongsToApp = (entry: string) =>
    names.some((name) =>
      isLeftoverMatch(entry, { name, bundleId: meta.bundleId }),
    );
  for (const leftover of leftovers) {
    // Re-validate: only remove entries that actually match this app.
    if (
      typeof leftover !== "string" ||
      !checkDeletable(leftover).ok ||
      !belongsToApp(path.basename(leftover))
    ) {
      errors.push(`Skipped ${leftover}`);
      continue;
    }
    const size = await diskSize(leftover);
    try {
      await shell.trashItem(leftover);
      freedSpace += size;
    } catch (err) {
      errors.push(`${leftover}: ${errorMessage(err)}`);
    }
  }

  return { success: true, freedSpace, cancelled: false, errors };
}
