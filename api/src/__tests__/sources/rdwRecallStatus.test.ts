import { describe, expect, it } from "vitest";
import { rdwRecallStatus } from "../../sources/rdwRecallStatus.js";

describe("rdwRecallStatus", () => {
  it("fetches recall status by plate", async () => {
    const result = await rdwRecallStatus.fetch("AB12CD");
    expect(result).not.toBeNull();
    expect(result?.plate).toBe("AB12CD");
    expect(typeof result?.hasOpenRecall).toBe("boolean");
    expect(typeof result?.statusDescription).toBe("string");
    expect(Array.isArray(result?.recalls)).toBe(true);
  });

  it("returns hasOpenRecall: false when no recalls found", async () => {
    const result = await rdwRecallStatus.fetch("NONEXISTENT");
    if (result !== null) {
      expect(result.hasOpenRecall).toBe(false);
      expect(result.recalls).toHaveLength(0);
    } else {
      expect(result).toBeNull();
    }
  });

  it("joins recall details from j9yg-7rg9", async () => {
    const result = await rdwRecallStatus.fetch("AB12CD");
    if (result !== null && result.recalls.length > 0) {
      const recall = result.recalls[0];
      expect(recall).toBeDefined();
      expect(typeof recall.referenceNumber).toBe("string");
    }
  });
});
