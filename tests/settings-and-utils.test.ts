import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getName: () => "MacSweep",
    getPath: () => "/tmp/macsweep-test",
    getLocale: () => "pt-BR",
  },
  Notification: { isSupported: () => false },
}));

const { sanitizeSettings } =
  await import("../electron/services/settings-store");
const { isAutoScanDue } = await import("../electron/scheduler");
const { DEFAULT_SETTINGS, languageFromLocale } =
  await import("../shared/defaults");
const { formatBytes, formatRelative, shortenPath, daysSince } =
  await import("../src/utils");

describe("sanitizeSettings", () => {
  it("returns defaults for garbage", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps and validates values", () => {
    const s = sanitizeSettings({
      autoScanInterval: 999,
      scanDepth: -3,
      theme: "neon",
      accentColor: "red",
      excludedFolders: ["/a", 3, null],
      notifications: "yes",
    });
    expect(s.autoScanInterval).toBe(30);
    expect(s.scanDepth).toBe(1);
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.accentColor).toBe(DEFAULT_SETTINGS.accentColor);
    expect(s.excludedFolders).toEqual(["/a"]);
    expect(s.notifications).toBe(DEFAULT_SETTINGS.notifications);
  });
});

describe("auto-scan schedule", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  it("is off at 0 days", () => {
    expect(isAutoScanDue(0, null, now)).toBe(false);
  });
  it("runs when never scanned or overdue", () => {
    expect(isAutoScanDue(7, null, now)).toBe(true);
    expect(isAutoScanDue(7, "2026-10-10T12:00:00Z", now)).toBe(true);
    expect(isAutoScanDue(7, "2026-10-15T12:00:00Z", now)).toBe(false);
  });
});

describe("locale", () => {
  it("maps system locales to supported languages", () => {
    expect(languageFromLocale("pt-BR")).toBe("pt");
    expect(languageFromLocale("ja_JP")).toBe("ja");
    expect(languageFromLocale("ko-KR")).toBe("en");
  });
});

describe("formatting", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 ** 3)).toBe("5 GB");
  });

  it("formats relative dates", () => {
    const now = Date.parse("2026-10-19T12:00:00Z");
    expect(formatRelative("2026-10-16T12:00:00Z", "en", now)).toBe(
      "3 days ago",
    );
    expect(formatRelative(null, "en", now)).toBeNull();
    expect(daysSince("2026-10-09T12:00:00Z", now)).toBe(10);
  });

  it("shortens home paths", () => {
    expect(shortenPath("/Users/demo/Library/Caches")).toBe("~/Library/Caches");
    expect(shortenPath("/Applications/X.app")).toBe("/Applications/X.app");
  });
});
