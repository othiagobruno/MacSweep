import os from "node:os";
import { errorMessage, isCancelled, run, runAsAdmin } from "./exec";
import { getMemoryUsage } from "./system-info";
import type { MaintenanceResult, MaintenanceTaskId } from "../../shared/types";

const LSREGISTER =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

/** Commands that must run as root. Static strings only — no user input. */
const ADMIN_COMMANDS: Partial<Record<MaintenanceTaskId, string>> = {
  freeRam: "/usr/sbin/purge",
  flushDns:
    "/usr/bin/dscacheutil -flushcache; /usr/bin/killall -HUP mDNSResponder",
  rebuildSpotlight: "/usr/bin/mdutil -E /",
  thinSnapshots: "/usr/bin/tmutil thinlocalsnapshots / 999999999999 4",
};

export const MAINTENANCE_TASKS: MaintenanceTaskId[] = [
  "freeRam",
  "flushDns",
  "rebuildSpotlight",
  "repairPermissions",
  "rebuildLaunchServices",
  "thinSnapshots",
];

function isTaskId(value: unknown): value is MaintenanceTaskId {
  return MAINTENANCE_TASKS.includes(value as MaintenanceTaskId);
}

function formatGB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function adminCommandFor(taskId: MaintenanceTaskId): string | null {
  if (taskId === "repairPermissions") {
    const uid = os.userInfo().uid;
    if (!Number.isInteger(uid)) return null;
    return `/usr/sbin/diskutil resetUserPermissions / ${uid}`;
  }
  return ADMIN_COMMANDS[taskId] ?? null;
}

/**
 * Run maintenance tasks. All tasks needing root are combined into a single
 * privileged script so the user only types their password once.
 */
export async function runMaintenance(
  taskIds: unknown,
): Promise<MaintenanceResult[]> {
  const tasks = (Array.isArray(taskIds) ? taskIds : []).filter(isTaskId);
  const results: MaintenanceResult[] = [];

  // Non-privileged tasks
  if (tasks.includes("rebuildLaunchServices")) {
    try {
      await run(
        LSREGISTER,
        [
          "-kill",
          "-r",
          "-domain",
          "local",
          "-domain",
          "system",
          "-domain",
          "user",
        ],
        { timeout: 5 * 60 * 1000 },
      );
      results.push({
        taskId: "rebuildLaunchServices",
        success: true,
        cancelled: false,
      });
    } catch (err) {
      results.push({
        taskId: "rebuildLaunchServices",
        success: false,
        cancelled: false,
        error: errorMessage(err),
      });
    }
  }

  const adminTasks = tasks.filter((id) => adminCommandFor(id) !== null);
  if (adminTasks.length === 0) return results;

  const memBefore = adminTasks.includes("freeRam")
    ? await getMemoryUsage()
    : null;

  // Each task writes a marker so we can tell which ones succeeded.
  const script = adminTasks
    .map(
      (id) =>
        `if { ${adminCommandFor(id)}; } >/dev/null 2>&1; then echo "ok:${id}"; else echo "fail:${id}"; fi`,
    )
    .join("; ");

  let output = "";
  try {
    output = await runAsAdmin(
      `(${script})`,
      "MacSweep needs your password to run maintenance tasks.",
    );
  } catch (err) {
    const cancelled = isCancelled(err);
    for (const id of adminTasks) {
      results.push({
        taskId: id,
        success: false,
        cancelled,
        error: cancelled ? undefined : errorMessage(err),
      });
    }
    return results;
  }

  for (const id of adminTasks) {
    const ok = output.includes(`ok:${id}`);
    const result: MaintenanceResult = {
      taskId: id,
      success: ok,
      cancelled: false,
    };
    if (ok && id === "freeRam" && memBefore) {
      const memAfter = await getMemoryUsage();
      const reclaimed = Math.max(0, memBefore.used - memAfter.used);
      result.detail = formatGB(reclaimed);
    }
    results.push(result);
  }
  return results;
}
