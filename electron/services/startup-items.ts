import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const homeDir = os.homedir();

export interface StartupItem {
  name: string;
  path: string;
  programPath: string;
  kind: "LaunchAgent" | "LaunchDaemon";
  isEnabled: boolean;
  appPath: string | null;
}

function resolveDisplayName(label: string, programPath: string): string {
  const appMatch = programPath.match(/\/([^/]+)\.app/i);
  if (appMatch) return appMatch[1];

  const parts = label.split(".");
  const prefixes = ["com", "org", "io", "net", "edu"];
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
  if (!programPath) return null;
  const appMatch = programPath.match(/^(.*?\.app)\b/);
  if (appMatch) {
    try {
      fs.accessSync(appMatch[1]);
      return appMatch[1];
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Check if a plist path needs admin privileges.
 */
function needsAdmin(plistPath: string): boolean {
  return plistPath.startsWith("/Library/") || !plistPath.startsWith(homeDir);
}

/**
 * Run a shell command with administrator privileges via osascript.
 * Shows the macOS native password dialog.
 */
async function runWithAdmin(command: string): Promise<void> {
  const escaped = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await execFileAsync("osascript", [
    "-e",
    `do shell script "${escaped}" with administrator privileges`,
  ]);
}

/**
 * Run a shell command normally.
 */
async function runCommand(command: string): Promise<void> {
  await execFileAsync("/bin/sh", ["-c", command]);
}

async function parsePlist(
  plistPath: string,
  kind: "LaunchAgent" | "LaunchDaemon",
): Promise<StartupItem | null> {
  try {
    await fs.promises.access(plistPath);
    const { stdout } = await execFileAsync("plutil", [
      "-convert",
      "json",
      "-o",
      "-",
      plistPath,
    ]);

    const data = JSON.parse(stdout);
    const label = data.Label || path.basename(plistPath, ".plist");

    let programPath = "";
    if (data.Program) {
      programPath = data.Program;
    } else if (
      Array.isArray(data.ProgramArguments) &&
      data.ProgramArguments.length > 0
    ) {
      programPath = data.ProgramArguments[0];
    }

    const isEnabled = data.Disabled !== true;
    const appPath = findAppBundle(programPath);
    const name = resolveDisplayName(label, programPath);

    return {
      name,
      path: plistPath,
      programPath,
      kind,
      isEnabled,
      appPath,
    };
  } catch {
    return null;
  }
}

async function scanDirectory(
  dirPath: string,
  kind: "LaunchAgent" | "LaunchDaemon",
): Promise<StartupItem[]> {
  try {
    const entries = await fs.promises.readdir(dirPath);
    const plistFiles = entries.filter((f) => f.endsWith(".plist"));
    const results = await Promise.all(
      plistFiles.map((f) => parsePlist(path.join(dirPath, f), kind)),
    );
    return results.filter((item): item is StartupItem => item !== null);
  } catch {
    return [];
  }
}

export async function scanStartupItems(): Promise<StartupItem[]> {
  const directories: Array<{
    path: string;
    kind: "LaunchAgent" | "LaunchDaemon";
  }> = [
    {
      path: path.join(homeDir, "Library", "LaunchAgents"),
      kind: "LaunchAgent",
    },
    { path: "/Library/LaunchAgents", kind: "LaunchAgent" },
    { path: "/Library/LaunchDaemons", kind: "LaunchDaemon" },
  ];

  const allResults = await Promise.all(
    directories.map((dir) => scanDirectory(dir.path, dir.kind)),
  );

  return allResults.flat().sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Disable a startup item by writing Disabled=true
 * and unloading it via launchctl.
 * Uses osascript admin dialog for system-level items.
 */
export async function disableStartupItem(
  plistPath: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const admin = needsAdmin(plistPath);
    const escaped = plistPath.replace(/'/g, "'\\''");

    const cmd = `defaults write '${escaped}' Disabled -bool true && launchctl unload -w '${escaped}' 2>/dev/null; true`;

    if (admin) {
      await runWithAdmin(cmd);
    } else {
      await runCommand(cmd);
    }

    return {
      success: true,
      message: `Disabled ${path.basename(plistPath)}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Enable a startup item by writing Disabled=false
 * and loading it via launchctl.
 */
export async function enableStartupItem(
  plistPath: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const admin = needsAdmin(plistPath);
    const escaped = plistPath.replace(/'/g, "'\\''");

    const cmd = `defaults write '${escaped}' Disabled -bool false && launchctl load -w '${escaped}' 2>/dev/null; true`;

    if (admin) {
      await runWithAdmin(cmd);
    } else {
      await runCommand(cmd);
    }

    return {
      success: true,
      message: `Enabled ${path.basename(plistPath)}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed: ${(err as Error).message}`,
    };
  }
}
