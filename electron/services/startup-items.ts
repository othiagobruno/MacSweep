import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  errorMessage,
  isCancelled,
  run,
  runAsAdmin,
  shellQuote,
  tryRun,
} from "./exec";
import type { StartupItem, ToggleResult } from "../../shared/types";

const homeDir = os.homedir();
const uid = os.userInfo().uid;

const SOURCES: Array<{
  dir: string;
  kind: StartupItem["kind"];
  scope: StartupItem["scope"];
}> = [
  {
    dir: path.join(homeDir, "Library", "LaunchAgents"),
    kind: "LaunchAgent",
    scope: "user",
  },
  { dir: "/Library/LaunchAgents", kind: "LaunchAgent", scope: "user" },
  { dir: "/Library/LaunchDaemons", kind: "LaunchDaemon", scope: "system" },
];

export function resolveDisplayName(label: string, programPath: string): string {
  const appMatch = programPath.match(/\/([^/]+)\.app/i);
  if (appMatch) return appMatch[1];

  const parts = label.split(".");
  const prefixes = ["com", "org", "io", "net", "edu", "dev", "co"];
  let startIdx = 0;
  if (parts.length > 2 && prefixes.includes(parts[0].toLowerCase())) {
    startIdx = 2;
  } else if (parts.length > 1 && prefixes.includes(parts[0].toLowerCase())) {
    startIdx = 1;
  }

  const meaningful = parts.slice(startIdx);
  if (meaningful.length === 0) return label;
  return meaningful
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function findAppBundle(programPath: string): string | null {
  const appMatch = programPath.match(/^(.*?\.app)(?=\/|$)/);
  if (!appMatch) return null;
  try {
    fs.accessSync(appMatch[1]);
    return appMatch[1];
  } catch {
    return null;
  }
}

function domainFor(scope: StartupItem["scope"]): string {
  return scope === "system" ? "system" : `gui/${uid}`;
}

/** Parse `launchctl print-disabled` → label → disabled. */
export function parseDisabledOverrides(stdout: string): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const line of stdout.split("\n")) {
    const match = line.match(/"([^"]+)"\s*=>\s*(\w+)/);
    if (match) {
      map.set(match[1], match[2] === "disabled" || match[2] === "true");
    }
  }
  return map;
}

async function readPlist(
  plistPath: string,
): Promise<Record<string, unknown> | null> {
  const out = await tryRun("plutil", [
    "-convert",
    "json",
    "-o",
    "-",
    plistPath,
  ]);
  if (!out) return null;
  try {
    return JSON.parse(out) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function parseItem(
  plistPath: string,
  source: (typeof SOURCES)[number],
  overrides: Map<string, boolean>,
): Promise<StartupItem | null> {
  const data = await readPlist(plistPath);
  if (!data) return null;

  const label =
    typeof data.Label === "string"
      ? data.Label
      : path.basename(plistPath, ".plist");
  let programPath = "";
  if (typeof data.Program === "string") {
    programPath = data.Program;
  } else if (
    Array.isArray(data.ProgramArguments) &&
    data.ProgramArguments.length > 0
  ) {
    programPath = String(data.ProgramArguments[0]);
  }

  const override = overrides.get(label);
  const isEnabled = override !== undefined ? !override : data.Disabled !== true;

  return {
    name: resolveDisplayName(label, programPath),
    label,
    path: plistPath,
    programPath,
    kind: source.kind,
    scope: source.scope,
    isEnabled,
    appPath: findAppBundle(programPath),
  };
}

export async function scanStartupItems(): Promise<StartupItem[]> {
  const [userOut, systemOut] = await Promise.all([
    tryRun("launchctl", ["print-disabled", `gui/${uid}`]),
    tryRun("launchctl", ["print-disabled", "system"]),
  ]);
  const userOverrides = parseDisabledOverrides(userOut ?? "");
  const systemOverrides = parseDisabledOverrides(systemOut ?? "");

  const all = await Promise.all(
    SOURCES.map(async (source) => {
      let names: string[];
      try {
        names = await fs.promises.readdir(source.dir);
      } catch {
        return [];
      }
      const overrides =
        source.scope === "system" ? systemOverrides : userOverrides;
      const items = await Promise.all(
        names
          .filter((f) => f.endsWith(".plist"))
          .map((f) => parseItem(path.join(source.dir, f), source, overrides)),
      );
      return items.filter((i): i is StartupItem => i !== null);
    }),
  );

  return all.flat().sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Enable or disable a launch agent/daemon through launchd's override
 * database. Only the plist path is trusted from the renderer; label and
 * scope are re-derived from disk.
 */
export async function setStartupItemEnabled(
  item: Pick<StartupItem, "path">,
  enabled: boolean,
): Promise<ToggleResult> {
  const plistPath = item?.path;
  const source = SOURCES.find(
    (s) => typeof plistPath === "string" && path.dirname(plistPath) === s.dir,
  );
  if (!source || !plistPath.endsWith(".plist")) {
    return { success: false, cancelled: false, error: "Unknown startup item" };
  }

  const data = await readPlist(plistPath);
  const label = typeof data?.Label === "string" ? data.Label : null;
  if (!label) {
    return { success: false, cancelled: false, error: "Invalid launchd plist" };
  }

  const domain = domainFor(source.scope);
  const target = `${domain}/${label}`;

  try {
    if (source.scope === "system") {
      const cmd = enabled
        ? `launchctl enable ${shellQuote(target)}; launchctl bootstrap ${domain} ${shellQuote(plistPath)} 2>/dev/null; true`
        : `launchctl disable ${shellQuote(target)}; launchctl bootout ${shellQuote(target)} 2>/dev/null; true`;
      await runAsAdmin(
        cmd,
        "MacSweep needs your password to change a system startup item.",
      );
    } else {
      await run("launchctl", [enabled ? "enable" : "disable", target]);
      if (enabled) {
        await tryRun("launchctl", ["bootstrap", domain, plistPath]);
      } else {
        await tryRun("launchctl", ["bootout", target]);
      }
    }
    return { success: true, cancelled: false };
  } catch (err) {
    return {
      success: false,
      cancelled: isCancelled(err),
      error: errorMessage(err),
    };
  }
}
