import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";
import pLimit from "p-limit";

function uniqueStrings(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string"))
  );
}

// Schema for sgfe-77wx inspection rows
const rdwInspectionRowSchema = z
  .object({
    kenteken: z.string(),
    meld_datum_door_keuringsinstantie: z.string().optional(),
    meld_tijd_door_keuringsinstantie: z.string().optional(),
    soort_melding_ki_omschrijving: z.string().optional(),
    soort_erkenning_omschrijving: z.string().optional(),
    vervaldatum_keuring: z.string().optional()
  })
  .passthrough();

// Schema for a34c-vvps defect rows
const rdwDefectRowSchema = z
  .object({
    kenteken: z.string(),
    meld_datum_door_keuringsinstantie: z.string().optional(),
    meld_tijd_door_keuringsinstantie: z.string().optional(),
    gebrek_identificatie: z.string().optional(),
    aantal_gebreken_geconstateerd: z.string().optional()
  })
  .passthrough();

// Schema for hx2c-gt7k defect description rows
const rdwDefectDescSchema = z
  .object({
    gebrek_identificatie: z.string(),
    gebrek_omschrijving: z.string().optional()
  })
  .passthrough();

export interface ApkInspection {
  date: string;
  expiryDate: string;
  type: string;
  facility: string;
  defectCount: number;
  defects: Array<{
    id: string;
    description: string;
    count: number;
  }>;
}

export interface ApkHistory {
  plate: string;
  currentExpiry: string | null;
  currentStatus: "valid" | "soon" | "expired" | "unknown";
  inspections: ApkInspection[];
  totalCount: number;
}

/**
 * Format HHMM time string (e.g. "1345") to "HH:MM" (e.g. "13:45").
 * Returns "00:00" if input is null, undefined, or unexpected format.
 */
function formatTime(hhmm: string | undefined): string {
  if (!hhmm || hhmm.length < 4) return "00:00";
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

/**
 * Derive APK status from ISO expiry date string.
 * - "valid" = more than 30 days in the future
 * - "soon"  = within 30 days of expiry (future)
 * - "expired" = past expiry date
 * - "unknown" = null or unparseable
 */
function apkStatus(expiryIso: string | null): "valid" | "soon" | "expired" | "unknown" {
  if (!expiryIso) return "unknown";
  const expiry = new Date(expiryIso);
  if (isNaN(expiry.getTime())) return "unknown";
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "soon";
  return "valid";
}

export const rdwApkHistory: DataSource<ApkHistory> = {
  id: "rdw_apk_history",
  name: "RDW APK-keuringshistorie",
  timeoutMs: 3500,
  cacheTtlSeconds: 24 * 60 * 60,

  async fetch(plate: string): Promise<ApkHistory | null> {
    const rawInspections = await fetchRdwDataset<unknown[]>("sgfe-77wx", {
      kenteken: plate
    });

    if (!Array.isArray(rawInspections) || rawInspections.length === 0) {
      return null;
    }

    const inspectionRows = rawInspections.map((row) =>
      rdwInspectionRowSchema.parse(row)
    );

    const result = await mapBounded(
      inspectionRows,
      async (insp) => {
        const meldDatum = insp.meld_datum_door_keuringsinstantie ?? "";
        const meldTijd = insp.meld_tijd_door_keuringsinstantie ?? "";

        const rawDefects = await fetchRdwDataset<unknown[]>("a34c-vvps", {
          kenteken: plate,
          meld_datum_door_keuringsinstantie: meldDatum,
          meld_tijd_door_keuringsinstantie: meldTijd
        });

        const defectRows = Array.isArray(rawDefects)
          ? rawDefects.map((row) => rdwDefectRowSchema.parse(row))
          : [];

        const uniqueDefectIds = uniqueStrings(
          defectRows.map((row) => row.gebrek_identificatie)
        );

        const descriptionByCode = await fetchDescriptions(uniqueDefectIds);

        const defects = defectRows.map((defect) => {
          const gebrekId = defect.gebrek_identificatie ?? "";
          return {
            id: gebrekId,
            description: descriptionByCode.get(gebrekId) ?? "—",
            count: parseInt(defect.aantal_gebreken_geconstateerd ?? "0", 10)
          };
        });

        const defectCount = defects.reduce((sum, d) => sum + d.count, 0);

        const date =
          (parseRdwDate(insp.meld_datum_door_keuringsinstantie) ?? "") +
          "T" +
          formatTime(insp.meld_tijd_door_keuringsinstantie);

        const expiryDate = parseRdwDate(insp.vervaldatum_keuring) ?? "";

        return {
          date,
          expiryDate,
          type: insp.soort_melding_ki_omschrijving ?? "",
          facility: insp.soort_erkenning_omschrijving ?? "",
          defectCount,
          defects
        } satisfies ApkInspection;
      },
      5
    );

    const sorted = result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const currentExpiry = sorted[0]?.expiryDate || null;

    return {
      plate,
      currentExpiry,
      currentStatus: apkStatus(currentExpiry),
      inspections: sorted,
      totalCount: sorted.length
    };
  }
};

async function fetchDescriptions(
  ids: string[]
): Promise<Map<string, string>> {
  const limit = pLimit(4);
  const results = await Promise.all(
    ids.map((id) =>
      limit(async () => {
        try {
          const rawDesc = await fetchRdwDataset<unknown[]>("hx2c-gt7k", {
            gebrek_identificatie: id
          });

          const row =
            Array.isArray(rawDesc) && rawDesc.length > 0
              ? rdwDefectDescSchema.parse(rawDesc[0])
              : null;

          return [id, row?.gebrek_omschrijving ?? "—"] as const;
        } catch {
          return [id, "—"] as const;
        }
      })
    )
  );

  return new Map(results);
}

async function mapBounded<T, U>(
  items: T[],
  mapper: (item: T, index: number) => Promise<U>,
  concurrency: number
): Promise<U[]> {
  const limit = pLimit(concurrency);
  const mapped = await Promise.all(
    items.map((item, index) => limit(() => mapper(item, index)))
  );
  return mapped;
}
