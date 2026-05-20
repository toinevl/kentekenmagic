import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";

const rdwVehicleSchema = z
  .object({
    kenteken: z.string(),
    voertuigsoort: z.string().optional(),
    merk: z.string().optional(),
    handelsbenaming: z.string().optional(),
    inrichting: z.string().optional(),
    eerste_kleur: z.string().optional(),
    tweede_kleur: z.string().optional(),
    datum_eerste_toelating: z.string().optional(),
    datum_eerste_tenaamstelling_in_nederland: z.string().optional(),
    datum_tenaamstelling: z.string().optional(),
    vervaldatum_apk: z.string().optional(),
    aantal_zitplaatsen: z.string().optional(),
    aantal_deuren: z.string().optional(),
    massa_rijklaar: z.string().optional(),
    toegestane_maximum_massa_voertuig: z.string().optional(),
    maximum_trekken_massa_geremd: z.string().optional(),
    lengte: z.string().optional(),
    breedte: z.string().optional(),
    hoogte_voertuig: z.string().optional(),
    zuinigheidsclassificatie: z.string().optional(),
    openstaande_terugroepactie_indicator: z.string().optional(),
    tellerstandoordeel: z.string().optional(),
    export_indicator: z.string().optional()
  })
  .passthrough();

export type RdwVehicle = z.infer<typeof rdwVehicleSchema> & {
  dates: {
    firstAdmission: string | null;
    firstDutchRegistration: string | null;
    currentRegistration: string | null;
    apkExpiry: string | null;
  };
};

export const rdwVehicle: DataSource<RdwVehicle> = {
  id: "rdw_vehicle",
  name: "RDW basisregistratie",
  timeoutMs: 3500,
  cacheTtlSeconds: 24 * 60 * 60,
  async fetch(plate) {
    const payload = await fetchRdwDataset<unknown[]>("m9d7-ebf2", {
      kenteken: plate,
      "$limit": "1"
    });

    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    const vehicle = rdwVehicleSchema.parse(payload[0]);
    return {
      ...vehicle,
      dates: {
        firstAdmission: parseRdwDate(vehicle.datum_eerste_toelating),
        firstDutchRegistration: parseRdwDate(vehicle.datum_eerste_tenaamstelling_in_nederland),
        currentRegistration: parseRdwDate(vehicle.datum_tenaamstelling),
        apkExpiry: parseRdwDate(vehicle.vervaldatum_apk)
      }
    };
  }
};
