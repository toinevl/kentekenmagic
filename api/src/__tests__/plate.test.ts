import { describe, expect, it } from "vitest";
import { formatPlate, normalizePlate, platePartitionKey, validatePlate } from "../lib/plate.js";

describe("plate utilities", () => {
  it("normalizes separators and casing", () => {
    expect(normalizePlate("ab-12 cd")).toBe("AB12CD");
  });

  it("formats display plates with stable groups", () => {
    expect(formatPlate("ab12cd")).toBe("AB-12-CD");
    expect(formatPlate("g123ab")).toBe("G1-23-AB");
  });

  it("uses a two-character partition key", () => {
    expect(platePartitionKey("ab-12-cd")).toBe("AB");
  });

  it("rejects implausible plate lengths", () => {
    expect(validatePlate("a1")).toEqual({ ok: false, error: "Kenteken is te kort." });
    expect(validatePlate("abcdefghi")).toEqual({ ok: false, error: "Kenteken is te lang." });
  });
});
