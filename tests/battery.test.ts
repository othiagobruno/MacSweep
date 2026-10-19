import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBattery } from "../electron/services/system-info";

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("parseBattery", () => {
  it("reads Apple Silicon output (percent-based MaxCapacity)", () => {
    // Real output from a MacBook with 5 cycles; macOS reports 100% max capacity.
    const info = parseBattery(fixture("ioreg-apple-silicon.txt"))!;
    expect(info.cycleCount).toBe(5);
    expect(info.healthPercent).toBe(100);
    expect(info.percentCharge).toBe(80);
    expect(info.condition).toBe("normal");
    expect(info.isCharging).toBe(false);
  });

  it("reads Intel output (mAh-based MaxCapacity)", () => {
    const info = parseBattery(`
      "MaxCapacity" = 4100
      "CurrentCapacity" = 2050
      "DesignCapacity" = 5000
      "CycleCount" = 612
      "IsCharging" = Yes
      "FullyCharged" = No
      "Temperature" = 3120
    `)!;
    expect(info.healthPercent).toBe(82);
    expect(info.percentCharge).toBe(50);
    expect(info.isCharging).toBe(true);
    expect(info.temperature).toBeCloseTo(31.2);
  });

  it("flags worn batteries", () => {
    const info = parseBattery(`"MaxCapacity" = 2500\n"CurrentCapacity" = 2500\n"DesignCapacity" = 5000\n"CycleCount" = 1200`)!;
    expect(info.healthPercent).toBe(50);
    expect(info.condition).toBe("replaceSoon");
  });

  it("returns null for desktops without a battery", () => {
    expect(parseBattery("")).toBeNull();
  });
});
