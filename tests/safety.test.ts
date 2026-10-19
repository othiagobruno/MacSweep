import { describe, expect, it } from "vitest";
import { checkDeletable, filterDeletable } from "../electron/services/safety";

const ctx = { home: "/Users/demo", tmpDir: "/var/folders/ab/cd/T" };

describe("checkDeletable", () => {
  it.each([
    "/Users/demo/Library/Caches/com.spotify.client",
    "/Users/demo/Library/Logs/JetBrains",
    "/Users/demo/.Trash/old.zip",
    "/Users/demo/Downloads/installer.dmg",
    "/var/folders/ab/cd/T/item",
    "/Applications/Slack.app",
  ])("allows %s", (p) => {
    expect(checkDeletable(p, ctx).ok).toBe(true);
  });

  it.each([
    "/",
    "/System",
    "/Applications",
    "/Users",
    "/Users/demo",
    "/Users/demo/Library",
    "/Users/demo/Library/Caches",
    "/Users/demo/Documents",
    "/Users/demo/.Trash",
    "/var/folders/ab/cd/T",
    "/Users/other/Library/Caches/x",
    "/Applications/Utilities/Terminal.app",
    "/Applications/Some Folder",
    "/usr/local/bin/node",
  ])("refuses %s", (p) => {
    expect(checkDeletable(p, ctx).ok).toBe(false);
  });

  it("refuses relative and non-normalized paths", () => {
    expect(checkDeletable("Library/Caches/x", ctx).ok).toBe(false);
    expect(checkDeletable("/Users/demo/Library/Caches/../../Documents", ctx).ok).toBe(false);
    expect(checkDeletable("", ctx).ok).toBe(false);
  });

  it("filters untrusted input", () => {
    const result = filterDeletable(
      ["/Users/demo/Library/Caches/a", "/", 42, "/Users/demo"],
      ctx,
    );
    expect(result.allowed).toEqual(["/Users/demo/Library/Caches/a"]);
    expect(result.rejected).toHaveLength(3);
    expect(filterDeletable("not-an-array", ctx).allowed).toEqual([]);
  });
});
