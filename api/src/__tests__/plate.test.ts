import { describe, expect, it } from "vitest";
import { formatPlate, normalizePlate, platePartitionKey, validatePlate } from "../lib/plate.js";

describe("plate utilities", () => {
  it("normalizes separators and casing", () => {
    expect(normalizePlate("ab-12 cd")).toBe("AB12CD");
  });

  it("formats display plates with Dutch scheme-aware groups", () => {
    expect(formatPlate("ab12cd")).toBe("AB-12-CD");
    expect(formatPlate("g123ab")).toBe("G-123-AB");
    expect(formatPlate("a12aaa")).toBe("A-12-AAA");
    expect(formatPlate("12abc3")).toBe("12-ABC-3");
    expect(formatPlate("2abc12")).toBe("2-ABC-12");
    expect(formatPlate("abc12d")).toBe("ABC-12-D");
    expect(formatPlate("3ab456")).toBe("3-AB-456");
  });

  it("uses a two-character partition key", () => {
    expect(platePartitionKey("ab-12-cd")).toBe("AB");
  });

  it("rejects implausible plate lengths", () => {
    expect(validatePlate("a1")).toEqual({ ok: false, error: "Kenteken is te kort." });
    expect(validatePlate("abcdefghi")).toEqual({ ok: false, error: "Kenteken is te lang." });
  });
});
