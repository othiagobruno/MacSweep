import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The privileged flows go through the macOS password prompt, which can't run
 * in CI. These tests mock the prompt (runAsAdmin) to verify what is executed
 * and how success, failure and cancellation are reported.
 */

const runAsAdmin = vi.fn();
const run = vi.fn();
const trashItem = vi.fn();

vi.mock("electron", () => ({
  app: {
    getName: () => "MacSweep",
    getPath: () => "/tmp",
    getLocale: () => "en",
  },
  shell: { trashItem: (p: string) => trashItem(p) },
}));

vi.mock("../electron/services/exec", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../electron/services/exec")>();
  return {
    ...actual,
    run: (...args: unknown[]) => run(...args),
    tryRun: async (file: string) => {
      if (file === "vm_stat")
        return "page size of 16384 bytes\nAnonymous pages: 100000.\n";
      if (file === "sysctl") return "90\n";
      if (file === "stat") return "-\n"; // no restricted flag
      if (file === "plutil")
        return JSON.stringify({ CFBundleIdentifier: "com.example.App" });
      if (file === "pgrep") return null;
      return null;
    },
    diskSize: async () => 1024,
    runAsAdmin: (...args: unknown[]) => runAsAdmin(...args),
  };
});

const { runMaintenance } = await import("../electron/services/maintenance");
const { uninstallApp } = await import("../electron/services/apps");
const { AdminCancelledError } = await import("../electron/services/exec");

beforeEach(() => {
  runAsAdmin.mockReset();
  run.mockReset();
  trashItem.mockReset();
});

describe("maintenance", () => {
  it("batches all privileged tasks into a single password prompt", async () => {
    runAsAdmin.mockResolvedValue(
      "ok:freeRam\nok:flushDns\nfail:rebuildSpotlight\n",
    );
    const results = await runMaintenance([
      "freeRam",
      "flushDns",
      "rebuildSpotlight",
    ]);

    expect(runAsAdmin).toHaveBeenCalledTimes(1);
    const script = runAsAdmin.mock.calls[0][0] as string;
    expect(script).toContain("/usr/sbin/purge");
    expect(script).toContain("killall -HUP mDNSResponder");
    expect(script).toContain("/usr/bin/mdutil -E /");
    expect(results.map((r) => [r.taskId, r.success])).toEqual([
      ["freeRam", true],
      ["flushDns", true],
      ["rebuildSpotlight", false],
    ]);
  });

  it("reports cancellation without claiming success", async () => {
    runAsAdmin.mockRejectedValue(new AdminCancelledError());
    const results = await runMaintenance(["freeRam", "flushDns"]);
    expect(results.every((r) => r.cancelled && !r.success)).toBe(true);
  });

  it("runs Launch Services rebuild without a password", async () => {
    run.mockResolvedValue("");
    const results = await runMaintenance(["rebuildLaunchServices"]);
    expect(runAsAdmin).not.toHaveBeenCalled();
    expect(results).toEqual([
      { taskId: "rebuildLaunchServices", success: true, cancelled: false },
    ]);
  });

  it("ignores unknown or injected task ids", async () => {
    const results = await runMaintenance(["freeRam; rm -rf ~", 42, null]);
    expect(results).toEqual([]);
    expect(runAsAdmin).not.toHaveBeenCalled();
  });
});

describe("uninstall", () => {
  it("moves user-owned apps to the Trash without a password", async () => {
    trashItem.mockResolvedValue(undefined);
    const result = await uninstallApp({
      appPath: "/Applications/Example.app",
      bundleId: "com.example.App",
      leftoverPaths: [],
    });
    expect(result.success).toBe(true);
    expect(trashItem).toHaveBeenCalledWith("/Applications/Example.app");
    expect(runAsAdmin).not.toHaveBeenCalled();
  });

  it("falls back to the password prompt for root-owned (pkg) apps, quoted safely", async () => {
    trashItem.mockRejectedValueOnce(new Error("EACCES"));
    runAsAdmin.mockResolvedValue("");
    const result = await uninstallApp({
      appPath: "/Applications/It's Mine.app",
      bundleId: "com.example.App",
      leftoverPaths: [],
    });
    expect(result.success).toBe(true);
    expect(runAsAdmin.mock.calls[0][0]).toBe(
      `/bin/rm -rf -- '/Applications/It'\\''s Mine.app'`,
    );
  });

  it("reports a cancelled password prompt", async () => {
    trashItem.mockRejectedValueOnce(new Error("EACCES"));
    runAsAdmin.mockRejectedValue(new AdminCancelledError());
    const result = await uninstallApp({
      appPath: "/Applications/Example.app",
      bundleId: "com.example.App",
      leftoverPaths: [],
    });
    expect(result).toMatchObject({ success: false, cancelled: true });
  });

  it("refuses anything that is not an app bundle in an allowed location", async () => {
    for (const appPath of [
      "/System/Applications/Mail.app",
      "/Applications",
      "/Users/x/Documents",
    ]) {
      const result = await uninstallApp({
        appPath,
        bundleId: null,
        leftoverPaths: [],
      });
      expect(result.success).toBe(false);
    }
    expect(trashItem).not.toHaveBeenCalled();
    expect(runAsAdmin).not.toHaveBeenCalled();
  });

  it("only removes leftovers that belong to the app", async () => {
    trashItem.mockResolvedValue(undefined);
    const home = (await import("node:os")).homedir();
    const result = await uninstallApp({
      appPath: "/Applications/Example.app",
      bundleId: "com.example.App",
      leftoverPaths: [
        `${home}/Library/Caches/com.example.App`,
        `${home}/Library/Caches/com.other.App`,
        `${home}/Documents`,
      ],
    });
    const trashed = trashItem.mock.calls.map((c) => c[0]);
    expect(trashed).toContain(`${home}/Library/Caches/com.example.App`);
    expect(trashed).not.toContain(`${home}/Library/Caches/com.other.App`);
    expect(trashed).not.toContain(`${home}/Documents`);
    expect(result.errors).toHaveLength(2);
  });
});
