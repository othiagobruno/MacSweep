import { describe, expect, it, vi } from "vitest";

// Services import electron for side effects; the pure helpers don't need it.
vi.mock("electron", () => ({
  app: { getName: () => "MacSweep", getPath: () => "/tmp", getLocale: () => "en" },
  shell: {},
}));

const { buildFindArgs, fileKind, parseStatLines } = await import("../electron/services/large-files");
const { memoryFromVmStat, parseVmStat } = await import("../electron/services/system-info");
const { parseDisabledOverrides, resolveDisplayName } = await import(
  "../electron/services/startup-items"
);
const { isLeftoverMatch } = await import("../electron/services/apps");
const { shellQuote } = await import("../electron/services/exec");

describe("large files", () => {
  it("classifies extensions", () => {
    expect(fileKind(".MOV")).toBe("video");
    expect(fileKind(".dmg")).toBe("diskImage");
    expect(fileKind(".xyz")).toBe("other");
  });

  it("parses stat output including paths with pipes", () => {
    const files = parseStatLines("1048576|1700000000|1700000100|/Users/a/b|c.mp4\nbad line\n");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ size: 1048576, name: "b|c.mp4", kind: "video" });
  });

  it("builds find arguments without shell interpolation", () => {
    const args = buildFindArgs("/Users/a", {
      minSizeMB: 100,
      maxDepth: 4,
      excludedFolders: ["~/Projects", "/tmp/x/"],
      scanHidden: false,
      skipSystemFiles: true,
    });
    expect(args.slice(0, 4)).toEqual(["/Users/a", "-xdev", "-maxdepth", "4"]);
    expect(args).toContain("/Users/a/Projects/*");
    expect(args).toContain("/tmp/x/*");
    expect(args).toContain("/Users/a/Library/*");
    expect(args).toContain("+100M");
  });
});

describe("memory", () => {
  const sample = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               10000.
Pages active:                            200000.
Pages wired down:                         50000.
Pages purgeable:                           5000.
"Translation faults":                  12345678.
File-backed pages:                        80000.
Anonymous pages:                         205000.
Pages occupied by compressor:             20000.`;

  it("parses vm_stat", () => {
    const vm = parseVmStat(sample);
    expect(vm.pageSize).toBe(16384);
    expect(vm["Pages wired down"]).toBe(50000);
    expect(vm["Translation faults"]).toBe(12345678);
  });

  it("computes Activity-Monitor-style usage", () => {
    const total = 16 * 1024 ** 3;
    const mem = memoryFromVmStat(parseVmStat(sample), total, 30);
    const page = 16384;
    expect(mem.app).toBe((205000 - 5000) * page);
    expect(mem.wired).toBe(50000 * page);
    expect(mem.compressed).toBe(20000 * page);
    expect(mem.used).toBe(mem.app + mem.wired + mem.compressed);
    expect(mem.free).toBe(total - mem.used);
    expect(mem.pressure).toBe(30);
  });
});

describe("startup items", () => {
  it("parses launchctl overrides", () => {
    const map = parseDisabledOverrides(`disabled services = {
		"com.docker.helper" => disabled
		"com.apple.foo" => enabled
		"org.legacy" => true
	}`);
    expect(map.get("com.docker.helper")).toBe(true);
    expect(map.get("com.apple.foo")).toBe(false);
    expect(map.get("org.legacy")).toBe(true);
  });

  it("derives friendly names", () => {
    expect(resolveDisplayName("com.docker.helper", "/Applications/Docker.app/Contents/MacOS/x")).toBe("Docker");
    expect(resolveDisplayName("com.google.keystone.agent", "/usr/bin/x")).toBe("Keystone Agent");
  });
});

describe("uninstaller leftovers", () => {
  const app = { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" };

  it("matches exact bundle ids and names", () => {
    expect(isLeftoverMatch("com.tinyspeck.slackmacgap", app)).toBe(true);
    expect(isLeftoverMatch("com.tinyspeck.slackmacgap.plist", app)).toBe(true);
    expect(isLeftoverMatch("com.tinyspeck.slackmacgap.ShipIt", app)).toBe(true);
    expect(isLeftoverMatch("Slack", app)).toBe(true);
  });

  it("does not match unrelated entries", () => {
    expect(isLeftoverMatch("com.tinyspeck.other", app)).toBe(false);
    expect(isLeftoverMatch("SlackBot Helper", app)).toBe(false);
    expect(isLeftoverMatch("Go", { name: "Go", bundleId: null })).toBe(false);
  });
});

describe("shellQuote", () => {
  it("neutralizes shell metacharacters", () => {
    expect(shellQuote("a'b")).toBe(`'a'\\''b'`);
    expect(shellQuote("$(rm -rf ~)")).toBe("'$(rm -rf ~)'");
  });
});
