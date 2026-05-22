import { describe, expect, it } from "vitest";
import { rdwApkHistory } from "../../sources/rdwApkHistory.js";

describe("rdwApkHistory", () => {
  it("fetches and denormalizes inspection history", async () => {
    const result = await rdwApkHistory.fetch("AB12CD");
    expect(result).not.toBeNull();
    expect(result?.inspections).toBeDefined();
    expect(Array.isArray(result?.inspections)).toBe(true);
    expect(result?.inspections).toHaveLength(result?.totalCount ?? result?.inspections.length);
    expect(result?.inspections[0]?.date).toBeDefined();
  });

  it("returns null if no inspections found", async () => {
    const result = await rdwApkHistory.fetch("NONEXISTENT");
    expect(result).toBeNull();
  });

  it("sorts inspections descending by date", async () => {
    const result = await rdwApkHistory.fetch("AB12CD");
    if ((result?.inspections.length ?? 0) > 1) {
      const dates = result!.inspections.map((i) => new Date(i.date).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    }
  });

  it("joins defects with descriptions inline", async () => {
    const result = await rdwApkHistory.fetch("AB12CD");
    const firstInspection = result?.inspections[0];
    if ((firstInspection?.defectCount ?? 0) > 0) {
      expect(firstInspection?.defects[0]?.description).toBeDefined();
      expect(firstInspection?.defects[0]?.description).not.toBeNull();
    }
  });

  it("respects 3.5 second timeout", async () => {
    const start = performance.now();
    await rdwApkHistory.fetch("AB12CD").catch(() => {});
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(4000);
  });
});
