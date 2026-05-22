import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";

const recallStatusRowSchema = z
  .object({
    kenteken: z.string(),
    referenciecode_rdw: z.string().optional(),
    code_status: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();

const recallDetailRowSchema = z
  .object({
    referenciecode_rdw: z.string().optional(),
    omschrijving_defect: z.string().optional(),
    risicobeoordeling_rdw: z.string().optional(),
    publicatiedatum_rdw: z.string().optional(),
    beschrijving_van_het_herstel: z.string().optional(),
    meer_informatie_op_internet: z.string().optional(),
    meer_informatie_via_telefoonnummer: z.string().optional()
  })
  .passthrough();

export interface RecallDetail {
  referenceCode: string;
  defectDescription: string;
  riskLevel: string;
  publicationDate: string | null;
  repairDescription: string;
  moreInfoUrl?: string;
  moreInfoPhone?: string;
}

export interface RecallStatus {
  plate: string;
  hasOpenRecall: boolean;
  statusDescription: string;
  recalls: RecallDetail[];
}

export const rdwRecallStatus: DataSource<RecallStatus> = {
  id: "rdw_recall_status",
  name: "RDW terugroepacties",
  timeoutMs: 3500,
  cacheTtlSeconds: 86400,

  async fetch(plate: string): Promise<RecallStatus> {
    const payload = await fetchRdwDataset<unknown[]>("t49b-isb7", {
      kenteken: plate
    });

    if (!Array.isArray(payload) || payload.length === 0) {
      return {
        plate,
        hasOpenRecall: false,
        statusDescription: "Geen openstaande terugroepacties",
        recalls: []
      };
    }

    const statusRows = payload.map((row) => recallStatusRowSchema.parse(row));

    const recalls = await Promise.all(
      statusRows.map(async (statusRow) => {
        const referenceCode = statusRow.referenciecode_rdw ?? "";

        let detailRow: z.infer<typeof recallDetailRowSchema> | undefined;
        if (referenceCode) {
          const details = await fetchRdwDataset<unknown[]>("j9yg-7rg9", {
            referenciecode_rdw: referenceCode
          });
          if (Array.isArray(details) && details.length > 0) {
            detailRow = recallDetailRowSchema.parse(details[0]);
          }
        }

        const moreInfoUrl = detailRow?.meer_informatie_op_internet;
        const moreInfoPhone = detailRow?.meer_informatie_via_telefoonnummer;

        const detail: RecallDetail = {
          referenceCode,
          defectDescription: detailRow?.omschrijving_defect || "—",
          riskLevel: detailRow?.risicobeoordeling_rdw || "—",
          publicationDate: parseRdwDate(detailRow?.publicatiedatum_rdw),
          repairDescription: detailRow?.beschrijving_van_het_herstel || "—"
        };

        if (moreInfoUrl && moreInfoUrl !== "(Nog) niet bekend") {
          detail.moreInfoUrl = moreInfoUrl;
        }

        if (moreInfoPhone) {
          detail.moreInfoPhone = moreInfoPhone;
        }

        return detail;
      })
    );

    return {
      plate,
      hasOpenRecall: statusRows.some((r) => r.code_status === "O"),
      statusDescription: statusRows[0]?.status ?? "Onbekende status",
      recalls
    };
  }
};
