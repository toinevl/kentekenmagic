import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the rdw module before importing the source
vi.mock("../../sources/rdw.js", () => ({
  fetchRdwDataset: vi.fn()
}));

import { fetchRdwDataset } from "../../sources/rdw.js";
import { rdwRecallStatus } from "../../sources/rdwRecallStatus.js";
import type { RecallStatus } from "../../sources/rdwRecallStatus.js";

const mockFetch = fetchRdwDataset as ReturnType<typeof vi.fn>;

describe("rdwRecallStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("has the correct id", () => {
    expect(rdwRecallStatus.id).toBe("rdw_recall_status");
  });

  it("has the correct name", () => {
    expect(rdwRecallStatus.name).toBe("RDW terugroepacties");
  });

  it("has timeoutMs of 3500", () => {
    expect(rdwRecallStatus.timeoutMs).toBe(3500);
  });

  it("has cacheTtlSeconds of 86400", () => {
    expect(rdwRecallStatus.cacheTtlSeconds).toBe(86400);
  });

  describe("fetch()", () => {
    it("returns RecallStatus with recalls when plate has open recall", async () => {
      // t49b-isb7 returns a status row
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "PLATEWITHRECALL",
          referenciecode_rdw: "MGP130086",
          code_status: "O",
          status: "Terugroepactie open"
        }
      ]);
      // j9yg-7rg9 returns detail for that recall
      mockFetch.mockResolvedValueOnce([
        {
          referenciecode_rdw: "MGP130086",
          omschrijving_defect: "Stuurkoppeling kan falen",
          risicobeoordeling_rdw: "ERN",
          publicatiedatum_rdw: "20130328",
          beschrijving_van_het_herstel: "Reparatie bij dealer",
          meer_informatie_op_internet: "https://example.com",
          meer_informatie_via_telefoonnummer: "0800-1234"
        }
      ]);

      const result = await rdwRecallStatus.fetch("PLATEWITHRECALL");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.plate).toBe("PLATEWITHRECALL");
      expect(status.hasOpenRecall).toBe(true);
      expect(status.recalls.length).toBeGreaterThan(0);
      expect(status.recalls[0].referenceCode).toBe("MGP130086");
      expect(status.recalls[0].defectDescription).toBe("Stuurkoppeling kan falen");
      expect(status.recalls[0].riskLevel).toBe("ERN");
      expect(status.recalls[0].publicationDate).toBe("2013-03-28");
      expect(status.recalls[0].repairDescription).toBe("Reparatie bij dealer");
      expect(status.recalls[0].moreInfoUrl).toBe("https://example.com");
      expect(status.recalls[0].moreInfoPhone).toBe("0800-1234");
    });

    it("returns RecallStatus with hasOpenRecall: false when plate has no recalls", async () => {
      // t49b-isb7 returns empty
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwRecallStatus.fetch("PLATEWITHOUTRECALL");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.plate).toBe("PLATEWITHOUTRECALL");
      expect(status.hasOpenRecall).toBe(false);
      expect(status.recalls).toEqual([]);
      expect(status.statusDescription).toBe("Geen openstaande terugroepacties");
    });

    it("hasOpenRecall is true only when code_status === 'O'", async () => {
      // t49b-isb7 returns a status row with code_status "P" (processed)
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE",
          referenciecode_rdw: "MGP070060",
          code_status: "P",
          status: "Producent heeft herstel gemeld"
        }
      ]);
      // j9yg-7rg9 returns detail
      mockFetch.mockResolvedValueOnce([
        {
          referenciecode_rdw: "MGP070060",
          omschrijving_defect: "Brandstofleiding",
          risicobeoordeling_rdw: "MID",
          publicatiedatum_rdw: "20070601",
          beschrijving_van_het_herstel: "Vervanging",
          meer_informatie_op_internet: "(Nog) niet bekend"
        }
      ]);

      const result = await rdwRecallStatus.fetch("TESTPLATE");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.hasOpenRecall).toBe(false);
    });

    it("omits moreInfoUrl when value is '(Nog) niet bekend'", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE2",
          referenciecode_rdw: "RDW001",
          code_status: "O",
          status: "Open recall"
        }
      ]);
      mockFetch.mockResolvedValueOnce([
        {
          referenciecode_rdw: "RDW001",
          omschrijving_defect: "Test defect",
          risicobeoordeling_rdw: "LOW",
          publicatiedatum_rdw: "20200101",
          beschrijving_van_het_herstel: "Repair",
          meer_informatie_op_internet: "(Nog) niet bekend"
        }
      ]);

      const result = await rdwRecallStatus.fetch("TESTPLATE2");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.recalls[0].moreInfoUrl).toBeUndefined();
    });

    it("omits moreInfoPhone when value is empty or absent", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE3",
          referenciecode_rdw: "RDW002",
          code_status: "O",
          status: "Open"
        }
      ]);
      mockFetch.mockResolvedValueOnce([
        {
          referenciecode_rdw: "RDW002",
          omschrijving_defect: "Test",
          risicobeoordeling_rdw: "LOW",
          publicatiedatum_rdw: "20200101",
          beschrijving_van_het_herstel: "Fix"
          // more_informatie_via_telefoonnummer not present
        }
      ]);

      const result = await rdwRecallStatus.fetch("TESTPLATE3");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.recalls[0].moreInfoPhone).toBeUndefined();
    });

    it("uses fallback '—' for missing defect description when j9yg-7rg9 has no row", async () => {
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TESTPLATE4",
          referenciecode_rdw: "UNKNOWN_CODE",
          code_status: "O",
          status: "Open recall"
        }
      ]);
      // No detail row found for this recall code
      mockFetch.mockResolvedValueOnce([]);

      const result = await rdwRecallStatus.fetch("TESTPLATE4");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.recalls[0].defectDescription).toBe("—");
      expect(status.recalls[0].repairDescription).toBe("—");
      expect(status.recalls[0].riskLevel).toBe("—");
    });

    it("fetches recall details in parallel via Promise.all", async () => {
      // Two status rows — two parallel fetches to j9yg-7rg9
      mockFetch.mockResolvedValueOnce([
        {
          kenteken: "TWORECALLS",
          referenciecode_rdw: "CODE1",
          code_status: "O",
          status: "Open"
        },
        {
          kenteken: "TWORECALLS",
          referenciecode_rdw: "CODE2",
          code_status: "P",
          status: "Processed"
        }
      ]);
      mockFetch.mockResolvedValueOnce([
        {
          referenciecode_rdw: "CODE1",
          omschrijving_defect: "Defect 1",
          risicobeoordeling_rdw: "ERN",
          publicatiedatum_rdw: "20200101",
          beschrijving_van_het_herstel: "Fix 1"
        }
      ]);
      mockFetch.mockResolvedValueOnce([
        {
          referenciecode_rdw: "CODE2",
          omschrijving_defect: "Defect 2",
          risicobeoordeling_rdw: "LOW",
          publicatiedatum_rdw: "20210101",
          beschrijving_van_het_herstel: "Fix 2"
        }
      ]);

      const result = await rdwRecallStatus.fetch("TWORECALLS");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.recalls.length).toBe(2);
      expect(status.hasOpenRecall).toBe(true); // At least one "O"
      // Both recall details must be present
      expect(status.recalls[0].defectDescription).toBe("Defect 1");
      expect(status.recalls[1].defectDescription).toBe("Defect 2");
    });

    it("never returns null — returns empty recall status when no data", async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await rdwRecallStatus.fetch("EMPTYPLATE");

      expect(result).not.toBeNull();
      const status = result as RecallStatus;
      expect(status.hasOpenRecall).toBe(false);
      expect(status.recalls).toEqual([]);
    });
  });
});
