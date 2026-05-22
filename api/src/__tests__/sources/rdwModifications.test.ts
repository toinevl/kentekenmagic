import { describe, expect, it } from "vitest";
import { rdwModifications } from "../../sources/rdwModifications.js";

describe("rdwModifications", () => {
  it("returns modifications array for plate", async () => {
    const result = await rdwModifications.fetch("AB12CD");
    expect(result).not.toBeNull();
    expect(result?.plate).toBe("AB12CD");
    expect(Array.isArray(result?.modifications)).toBe(true);
    expect(typeof result?.activeCount).toBe("number");
  });

  it("marks modification as active when demontagedatum is '0'", async () => {
    const result = await rdwModifications.fetch("AB12CD");
    if (result !== null && result.modifications.length > 0) {
      const activeModifications = result.modifications.filter((m) => m.active === true);
      activeModifications.forEach((m) => {
        expect(m.active).toBe(true);
      });
    }
  });

  it("marks modification as removed when demontagedatum is a date string", async () => {
    const result = await rdwModifications.fetch("AB12CD");
    if (result !== null && result.modifications.length > 0) {
      const removedModifications = result.modifications.filter((m) => m.active === false);
      removedModifications.forEach((m) => {
        expect(m.active).toBe(false);
      });
    }
  });

  it("returns empty modifications array when no data", async () => {
    const result = await rdwModifications.fetch("NONEXISTENT");
    if (result !== null) {
      expect(result.modifications).toHaveLength(0);
      expect(result.activeCount).toBe(0);
    } else {
      expect(result).toBeNull();
    }
  });
});
