import { z } from "zod";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";

const rdwFuelSchema = z
  .object({
    kenteken: z.string(),
    brandstof_volgnummer: z.string().optional(),
    brandstof_omschrijving: z.string().optional(),
    emissiecode_omschrijving: z.string().optional(),
    uitlaatemissieniveau: z.string().optional()
  })
  .passthrough();

export type RdwFuel = z.infer<typeof rdwFuelSchema>;

export const rdwFuel: DataSource<RdwFuel[]> = {
  id: "rdw_fuel",
  name: "RDW brandstof en emissies",
  timeoutMs: 3000,
  cacheTtlSeconds: 24 * 60 * 60,
  async fetch(plate) {
    const payload = await fetchRdwDataset<unknown[]>("8ys7-d773", {
      kenteken: plate
    });

    if (!Array.isArray(payload) || payload.length === 0) {
      return [];
    }

    return payload.map((item) => rdwFuelSchema.parse(item));
  }
};
