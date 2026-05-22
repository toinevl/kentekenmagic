import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";

const rdwModificationSchema = z
  .object({
    kenteken: z.string(),
    montagedatum: z.string().optional(),
    demontagedatum: z.string().optional(),
    soort_toe_te_voegen_object_omschrijving: z.string().optional(),
    merk_object_toegevoegd: z.string().optional(),
    gasinstallatie_tank_inhoud: z.string().optional()
  })
  .passthrough();

export interface Modification {
  description: string;
  installDate: string | null;
  removalDate: string | null;
  isActive: boolean;
  manufacturer?: string;
  tankCapacity?: string;
}

export interface Modifications {
  plate: string;
  modifications: Modification[];
  activeCount: number;
}

export const rdwModifications: DataSource<Modifications> = {
  id: "rdw_modifications",
  name: "RDW wijzigingen",
  timeoutMs: 3500,
  cacheTtlSeconds: 86400,

  async fetch(plate: string): Promise<Modifications> {
    const payload = await fetchRdwDataset<unknown[]>("sghb-dzxx", {
      kenteken: plate
    });

    if (!Array.isArray(payload) || payload.length === 0) {
      return {
        plate,
        modifications: [],
        activeCount: 0
      };
    }

    const rows = payload.map((row) => rdwModificationSchema.parse(row));

    const mods: Modification[] = rows.map((row) => {
      const isActive = row.demontagedatum === "0";
      const removalDate = isActive
        ? null
        : parseRdwDate(row.demontagedatum);

      const mod: Modification = {
        description: row.soort_toe_te_voegen_object_omschrijving || "Onbekende wijziging",
        installDate: parseRdwDate(row.montagedatum),
        removalDate,
        isActive
      };

      if (row.merk_object_toegevoegd && row.merk_object_toegevoegd !== "GEEN") {
        mod.manufacturer = row.merk_object_toegevoegd;
      }

      if (row.gasinstallatie_tank_inhoud) {
        mod.tankCapacity = row.gasinstallatie_tank_inhoud;
      }

      return mod;
    });

    return {
      plate,
      modifications: mods,
      activeCount: mods.filter((m) => m.isActive).length
    };
  }
};
