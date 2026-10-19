import path from "node:path";
import os from "node:os";

/**
 * Guard rails for every destructive operation. The renderer is not trusted:
 * all paths coming over IPC are validated here before anything is deleted.
 */

export interface SafetyContext {
  home: string;
  tmpDir: string;
}

export function defaultSafetyContext(): SafetyContext {
  return { home: os.homedir(), tmpDir: os.tmpdir() };
}

function protectedPaths(ctx: SafetyContext): Set<string> {
  const h = ctx.home;
  return new Set(
    [
      "/",
      "/Applications",
      "/Library",
      "/System",
      "/Users",
      "/Volumes",
      "/bin",
      "/cores",
      "/dev",
      "/etc",
      "/opt",
      "/private",
      "/private/etc",
      "/private/tmp",
      "/private/var",
      "/sbin",
      "/tmp",
      "/usr",
      "/var",
      h,
      `${h}/Applications`,
      `${h}/Desktop`,
      `${h}/Documents`,
      `${h}/Downloads`,
      `${h}/Library`,
      `${h}/Library/Application Support`,
      `${h}/Library/Caches`,
      `${h}/Library/Containers`,
      `${h}/Library/Developer`,
      `${h}/Library/Group Containers`,
      `${h}/Library/Keychains`,
      `${h}/Library/LaunchAgents`,
      `${h}/Library/Logs`,
      `${h}/Library/Mail`,
      `${h}/Library/Mobile Documents`,
      `${h}/Library/Preferences`,
      `${h}/Movies`,
      `${h}/Music`,
      `${h}/Pictures`,
      `${h}/Public`,
      `${h}/.Trash`,
      `${h}/.ssh`,
      `${h}/.gnupg`,
      ctx.tmpDir,
    ].map((p) => path.resolve(p)),
  );
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export type SafetyVerdict = { ok: true } | { ok: false; reason: string };

/**
 * A path may be deleted when it is absolute, normalized, not a protected
 * location itself, and lives inside the user's home, the user temp dir or
 * an Applications folder (only .app bundles there).
 */
export function checkDeletable(
  target: string,
  ctx: SafetyContext = defaultSafetyContext(),
): SafetyVerdict {
  if (typeof target !== "string" || target.length === 0) {
    return { ok: false, reason: "Empty path" };
  }
  if (!path.isAbsolute(target)) {
    return { ok: false, reason: "Path must be absolute" };
  }
  const resolved = path.resolve(target);
  if (resolved !== target.replace(/\/+$/, "")) {
    return { ok: false, reason: "Path must be normalized" };
  }
  if (protectedPaths(ctx).has(resolved)) {
    return { ok: false, reason: "Protected location" };
  }

  const tmp = path.resolve(ctx.tmpDir);
  if (isInside(resolved, ctx.home) || isInside(resolved, tmp)) {
    return { ok: true };
  }

  if (
    isInside(resolved, "/Applications") &&
    resolved.endsWith(".app") &&
    !resolved.startsWith("/Applications/Utilities/")
  ) {
    return { ok: true };
  }

  return { ok: false, reason: "Outside of allowed locations" };
}

export function filterDeletable(
  paths: unknown,
  ctx?: SafetyContext,
): { allowed: string[]; rejected: string[] } {
  const allowed: string[] = [];
  const rejected: string[] = [];
  if (!Array.isArray(paths)) return { allowed, rejected };
  for (const p of paths) {
    if (typeof p === "string" && checkDeletable(p, ctx).ok) {
      allowed.push(p);
    } else {
      rejected.push(String(p));
    }
  }
  return { allowed, rejected };
}
