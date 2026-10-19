import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { shell } from "electron";
import { diskSize, errorMessage, runAsAdmin, shellQuote } from "./exec";
import { filterDeletable } from "./safety";
import type { CleanResult, TrashResult } from "../../shared/types";

const PERMISSION_CODES = new Set(["EPERM", "EACCES"]);

/** Items from the Downloads folder go to the Trash instead of being erased. */
function shouldTrash(target: string): boolean {
  const downloads = path.join(os.homedir(), "Downloads") + path.sep;
  return target.startsWith(downloads);
}

export async function cleanFiles(paths: unknown): Promise<CleanResult> {
  const { allowed, rejected } = filterDeletable(paths);
  let freedSpace = 0;
  const errors = rejected.map((p) => `Refused to delete ${p}`);
  const failedPaths: string[] = [...rejected];
  const needsAdminPaths: string[] = [];

  for (const target of allowed) {
    try {
      await fs.promises.lstat(target);
    } catch {
      continue; // already gone
    }

    const size = await diskSize(target);
    try {
      if (shouldTrash(target)) {
        await shell.trashItem(target);
      } else {
        await fs.promises.rm(target, { recursive: true, force: true });
      }
      freedSpace += size;
    } catch (err) {
      failedPaths.push(target);
      errors.push(`${target}: ${errorMessage(err)}`);
      const code = (err as NodeJS.ErrnoException).code;
      if (code && PERMISSION_CODES.has(code)) needsAdminPaths.push(target);
    }
  }

  return {
    success: failedPaths.length === 0,
    freedSpace,
    errors,
    failedPaths,
    needsAdminPaths,
  };
}

/** Delete paths as root (one password prompt for the whole batch). */
export async function cleanFilesAsAdmin(paths: unknown): Promise<CleanResult> {
  const { allowed, rejected } = filterDeletable(paths);
  const existing: string[] = [];
  let freedSpace = 0;
  for (const target of allowed) {
    try {
      await fs.promises.lstat(target);
      existing.push(target);
      freedSpace += await diskSize(target);
    } catch {
      // already gone
    }
  }

  if (existing.length === 0) {
    return {
      success: rejected.length === 0,
      freedSpace: 0,
      errors: [],
      failedPaths: rejected,
      needsAdminPaths: [],
    };
  }

  try {
    await runAsAdmin(
      `/bin/rm -rf -- ${existing.map(shellQuote).join(" ")}`,
      "MacSweep needs your password to remove protected files.",
    );
    return {
      success: rejected.length === 0,
      freedSpace,
      errors: [],
      failedPaths: rejected,
      needsAdminPaths: [],
    };
  } catch (err) {
    return {
      success: false,
      freedSpace: 0,
      errors: [errorMessage(err)],
      failedPaths: [...existing, ...rejected],
      needsAdminPaths: [],
    };
  }
}

export async function moveToTrash(paths: unknown): Promise<TrashResult> {
  const { allowed, rejected } = filterDeletable(paths);
  const moved: string[] = [];
  const failed: string[] = [...rejected];
  for (const target of allowed) {
    try {
      await shell.trashItem(target);
      moved.push(target);
    } catch {
      failed.push(target);
    }
  }
  return { moved, failed };
}
