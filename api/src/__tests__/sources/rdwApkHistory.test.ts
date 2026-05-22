import { describe, expect, it, vi, beforeEach } from "vitest";
import { rdwApkHistory } from "../../sources/rdwApkHistory.js";

// Mock fetchRdwDataset
vi.mock("../../sources/rdw.js", () => ({
  fetchRdwDataset: vi.fn()
}));

import { fetchRdwDataset } from "../../sources/rdw.js";

const mockFetch = fetchRdwDataset as ReturnType<typeof vi.fn>;

// Inspection rows from sgfe-77wx
const INSPECTION_ROW_RECENT = {
  kenteken: "KNOWNPLATE",
  meld_datum_door_keuringsinstantie: "20260213",
  meld_tijd_door_keuringsinstantie: "1345",
  soort_melding_ki_omschrijving: "periodieke controle",
  soort_erkenning_omschrijving: "APK Lichte voertuigen",
  vervaldatum_keuring: "20270228"
};

const INSPECTION_ROW_OLDER = {
  kenteken: "KNOWNPLATE",
  meld_datum_door_keuringsinstantie: "20250210",
  meld_tijd_door_keuringsinstantie: "0900",
  soort_melding_ki_omschrijving: "periodieke controle",
  soort_erkenning_omschrijving: "APK Lichte voertuigen",
  vervaldatum_keuring: "20260215"
};

// Defect rows from a34c-vvps
const DEFECT_ROW_1 = {
  kenteken: "KNOWNPLATE",
  meld_datum_door_keuringsinstantie: "20260213",
  meld_tijd_door_keuringsinstantie: "1345",
  gebrek_identificatie: "123",
  aantal_gebreken_geconstateerd: "1"
};

const DEFECT_ROW_2 = {
  kenteken: "KNOWNPLATE",
  meld_datum_door_keuringsinstantie: "20260213",
  meld_tijd_door_keuringsinstantie: "1345",
  gebrek_identificatie: "456",
  aantal_gebreken_geconstateerd: "2"
};

// Description rows from hx2c-gt7k
const DESC_ROW_123 = {
  gebrek_identificatie: "123",
  gebrek_omschrijving: "Remmen slijtageindicator"
};

const DESC_ROW_456 = {
  gebrek_identificatie: "456",
  gebrek_omschrijving: "Ruitsproeier niet werkend"
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rdwApkHistory", () => {
  describe("metadata", () => {
    it("has id rdw_apk_history", () => {
      expect(rdwApkHistory.id).toBe("rdw_apk_history");
    });

    it("has timeoutMs 3500", () => {
      expect(rdwApkHistory.timeoutMs).toBe(3500);
    });

    it("has cacheTtlSeconds 86400", () => {
      expect(rdwApkHistory.cacheTtlSeconds).toBe(86400);
    });
  });

  describe("fetch", () => {
    it("returns null when sgfe-77wx returns no rows", async () => {
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("UNKNOWNPLATE");
      expect(result).toBeNull();
    });

    it("returns null when sgfe-77wx returns null", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await rdwApkHistory.fetch("UNKNOWNPLATE");
      expect(result).toBeNull();
    });

    it("returns ApkHistory with plate when data found", async () => {
      // sgfe-77wx -> 1 inspection
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      // a34c-vvps -> no defects for that inspection
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result).not.toBeNull();
      expect(result!.plate).toBe("KNOWNPLATE");
    });

    it("returns inspections array", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections).toHaveLength(1);
    });

    it("returns totalCount equal to inspections length", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT, INSPECTION_ROW_OLDER]);
      // defects for each inspection
      mockFetch.mockResolvedValueOnce([]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.totalCount).toBe(2);
      expect(result!.totalCount).toBe(result!.inspections.length);
    });

    it("sorts inspections descending by date (newest first)", async () => {
      // Return older row first to test sorting
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_OLDER, INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].date).toContain("2026-02-13");
      expect(result!.inspections[1].date).toContain("2025-02-10");
    });

    it("sets currentExpiry from the first (latest) inspection expiryDate", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_OLDER, INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      // After descending sort, inspections[0] is RECENT (2026-02-13), expiry 2027-02-28
      expect(result!.currentExpiry).toBe("2027-02-28");
    });

    it("formats inspection date as ISO datetime with time", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].date).toBe("2026-02-13T13:45");
    });

    it("handles missing meld_tijd as 00:00", async () => {
      const rowNoTime = { ...INSPECTION_ROW_RECENT, meld_tijd_door_keuringsinstantie: undefined };
      mockFetch.mockResolvedValueOnce([rowNoTime]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].date).toBe("2026-02-13T00:00");
    });

    it("sets expiryDate from vervaldatum_keuring", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].expiryDate).toBe("2027-02-28");
    });

    it("sets type from soort_melding_ki_omschrijving", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].type).toBe("periodieke controle");
    });

    it("sets facility from soort_erkenning_omschrijving", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].facility).toBe("APK Lichte voertuigen");
    });

    it("has empty defects array when no defects found", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].defects).toEqual([]);
      expect(result!.inspections[0].defectCount).toBe(0);
    });

    it("fetches defects and descriptions per inspection", async () => {
      // sgfe-77wx
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      // a34c-vvps
      mockFetch.mockResolvedValueOnce([DEFECT_ROW_1, DEFECT_ROW_2]);
      // hx2c-gt7k for defect 123
      mockFetch.mockResolvedValueOnce([DESC_ROW_123]);
      // hx2c-gt7k for defect 456
      mockFetch.mockResolvedValueOnce([DESC_ROW_456]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      const insp = result!.inspections[0];
      expect(insp.defects).toHaveLength(2);
      expect(insp.defects[0].id).toBe("123");
      expect(insp.defects[0].description).toBe("Remmen slijtageindicator");
      expect(insp.defects[0].count).toBe(1);
      expect(insp.defects[1].id).toBe("456");
      expect(insp.defects[1].description).toBe("Ruitsproeier niet werkend");
      expect(insp.defects[1].count).toBe(2);
    });

    it("sums defect counts into defectCount", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([DEFECT_ROW_1, DEFECT_ROW_2]);
      mockFetch.mockResolvedValueOnce([DESC_ROW_123]);
      mockFetch.mockResolvedValueOnce([DESC_ROW_456]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].defectCount).toBe(3); // 1 + 2
    });

    it("uses fallback description '—' when hx2c-gt7k returns no rows", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([DEFECT_ROW_1]);
      // hx2c-gt7k returns empty
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.inspections[0].defects[0].description).toBe("—");
    });

    it("does not expose gebrek_paragraaf_nummer (D-04)", async () => {
      mockFetch.mockResolvedValueOnce([INSPECTION_ROW_RECENT]);
      mockFetch.mockResolvedValueOnce([DEFECT_ROW_1]);
      mockFetch.mockResolvedValueOnce([{ ...DESC_ROW_123, gebrek_paragraaf_nummer: "nl02" }]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      const defect = result!.inspections[0].defects[0];
      expect(defect).not.toHaveProperty("gebrek_paragraaf_nummer");
    });
  });

  describe("apkStatus (via currentStatus)", () => {
    it("returns unknown when currentExpiry is null", async () => {
      // Inspection with no vervaldatum
      const rowNoExpiry = { ...INSPECTION_ROW_RECENT, vervaldatum_keuring: undefined };
      mockFetch.mockResolvedValueOnce([rowNoExpiry]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.currentStatus).toBe("unknown");
    });

    it("returns expired when expiry date is in the past", async () => {
      // Past expiry
      const pastRow = { ...INSPECTION_ROW_RECENT, vervaldatum_keuring: "20200101" };
      mockFetch.mockResolvedValueOnce([pastRow]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.currentStatus).toBe("expired");
    });

    it("returns valid when expiry date is more than 30 days in future", async () => {
      // Far future expiry
      const futureRow = { ...INSPECTION_ROW_RECENT, vervaldatum_keuring: "20271231" };
      mockFetch.mockResolvedValueOnce([futureRow]);
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwApkHistory.fetch("KNOWNPLATE");
      expect(result!.currentStatus).toBe("valid");
    });
  });
});
