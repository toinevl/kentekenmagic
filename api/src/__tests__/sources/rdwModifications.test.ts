import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the rdw module before importing the source
vi.mock("../../sources/rdw.js", () => ({
  fetchRdwDataset: vi.fn()
}));

import { fetchRdwDataset } from "../../sources/rdw.js";
import { rdwModifications } from "../../sources/rdwModifications.js";
import type { Modifications } from "../../sources/rdwModifications.js";

const mockFetch = fetchRdwDataset as ReturnType<typeof vi.fn>;

describe("rdwModifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("has the correct id", () => {
    expect(rdwModifications.id).toBe("rdw_modifications");
  });

  it("has the correct name", () => {
    expect(rdwModifications.name).toBe("RDW wijzigingen");
  });

  it("has timeoutMs of 3500", () => {
    expect(rdwModifications.timeoutMs).toBe(3500);
  });

  it("has cacheTtlSeconds of 86400", () => {
    expect(rdwModifications.cacheTtlSeconds).toBe(86400);
  });

  describe("fetch()", () => {
    it("returns Modifications with modifications when plate has modifications", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "PLATEWITHMODS",
          montagedatum: "19980128",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "LPG Installatie",
          merk_object_toegevoegd: "BRC",
          gasinstallatie_tank_inhoud: "60"
        }
      ]);

      const result = await rdwModifications.fetch("PLATEWITHMODS");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.plate).toBe("PLATEWITHMODS");
      expect(mods.modifications.length).toBeGreaterThan(0);
      expect(mods.modifications[0].description).toBe("LPG Installatie");
      expect(mods.modifications[0].installDate).toBe("1998-01-28");
    });

    it("a modification with demontagedatum '0' has isActive: true and removalDate: null", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE",
          montagedatum: "19980128",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "LPG Installatie",
          merk_object_toegevoegd: "BRC",
          gasinstallatie_tank_inhoud: "60"
        }
      ]);

      const result = await rdwModifications.fetch("TESTPLATE");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].isActive).toBe(true);
      expect(mods.modifications[0].removalDate).toBeNull();
    });

    it("a modification with a date demontagedatum has isActive: false and ISO removalDate", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE2",
          montagedatum: "19980128",
          demontagedatum: "20190301",
          soort_toe_te_voegen_object_omschrijving: "LPG Installatie",
          merk_object_toegevoegd: "BRC"
        }
      ]);

      const result = await rdwModifications.fetch("TESTPLATE2");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].isActive).toBe(false);
      expect(mods.modifications[0].removalDate).toBe("2019-03-01");
    });

    it("returns Modifications with empty modifications and activeCount: 0 when no data (not null)", async () => {
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwModifications.fetch("PLATEWITHOUTMODS");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.plate).toBe("PLATEWITHOUTMODS");
      expect(mods.modifications).toEqual([]);
      expect(mods.activeCount).toBe(0);
    });

    it("never returns null — returns empty when null payload", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await rdwModifications.fetch("NULLPLATE");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications).toEqual([]);
      expect(mods.activeCount).toBe(0);
    });

    it("manufacturer is undefined when merk_object_toegevoegd is 'GEEN'", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE3",
          montagedatum: "20050515",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "Trekhaak",
          merk_object_toegevoegd: "GEEN"
        }
      ]);

      const result = await rdwModifications.fetch("TESTPLATE3");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].manufacturer).toBeUndefined();
    });

    it("manufacturer is undefined when merk_object_toegevoegd is empty", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE4",
          montagedatum: "20050515",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "Trekhaak",
          merk_object_toegevoegd: ""
        }
      ]);

      const result = await rdwModifications.fetch("TESTPLATE4");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].manufacturer).toBeUndefined();
    });

    it("tankCapacity is undefined when gasinstallatie_tank_inhoud is absent", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE5",
          montagedatum: "20050515",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "Trekhaak"
          // No gasinstallatie_tank_inhoud
        }
      ]);

      const result = await rdwModifications.fetch("TESTPLATE5");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].tankCapacity).toBeUndefined();
    });

    it("activeCount equals count of modifications with isActive: true", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "MULTIMODS",
          montagedatum: "19980128",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "LPG Installatie"
        },
        {
          kenteken: "MULTIMODS",
          montagedatum: "20050301",
          demontagedatum: "20190301",
          soort_toe_te_voegen_object_omschrijving: "Trekhaak"
        },
        {
          kenteken: "MULTIMODS",
          montagedatum: "20100101",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "Extra verlichting"
        }
      ]);

      const result = await rdwModifications.fetch("MULTIMODS");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications.length).toBe(3);
      expect(mods.activeCount).toBe(2); // Only 2 have demontagedatum "0"
    });

    it("uses fallback 'Onbekende wijziging' for missing description", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "NODESC",
          montagedatum: "20000101",
          demontagedatum: "0"
          // No soort_toe_te_voegen_object_omschrijving
        }
      ]);

      const result = await rdwModifications.fetch("NODESC");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].description).toBe("Onbekende wijziging");
    });

    it("tankCapacity is set when gasinstallatie_tank_inhoud is present", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "LPGPLATE",
          montagedatum: "19990601",
          demontagedatum: "0",
          soort_toe_te_voegen_object_omschrijving: "LPG Installatie",
          gasinstallatie_tank_inhoud: "45"
        }
      ]);

      const result = await rdwModifications.fetch("LPGPLATE");

      expect(result).not.toBeNull();
      const mods = result as Modifications;
      expect(mods.modifications[0].tankCapacity).toBe("45");
    });
  });
});
