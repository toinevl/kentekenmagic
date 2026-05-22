export interface RdwVehicle {
  kenteken: string;
  voertuigsoort?: string;
  merk?: string;
  handelsbenaming?: string;
  inrichting?: string;
  eerste_kleur?: string;
  tweede_kleur?: string;
  datum_eerste_toelating?: string;
  datum_eerste_tenaamstelling_in_nederland?: string;
  datum_tenaamstelling?: string;
  vervaldatum_apk?: string;
  aantal_zitplaatsen?: string;
  aantal_deuren?: string;
  massa_rijklaar?: string;
  toegestane_maximum_massa_voertuig?: string;
  maximum_trekken_massa_geremd?: string;
  lengte?: string;
  breedte?: string;
  hoogte_voertuig?: string;
  zuinigheidsclassificatie?: string;
  openstaande_terugroepactie_indicator?: string;
  tellerstandoordeel?: string;
  export_indicator?: string;
  dates: {
    firstAdmission: string | null;
    firstDutchRegistration: string | null;
    currentRegistration: string | null;
    apkExpiry: string | null;
  };
}

export interface RdwFuel {
  kenteken: string;
  brandstof_volgnummer?: string;
  brandstof_omschrijving?: string;
  emissiecode_omschrijving?: string;
  uitlaatemissieniveau?: string;
}

export interface ApkInspection {
  date: string;
  expiryDate: string;
  type: string;
  facility: string;
  defectCount: number;
  defects: Array<{ id: string; description: string; count: number }>;
}

export interface ApkHistory {
  plate: string;
  currentExpiry: string | null;
  currentStatus: "valid" | "soon" | "expired" | "unknown";
  inspections: ApkInspection[];
  totalCount: number;
}

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

export interface VehicleLookupResponse {
  plate: string;
  displayPlate?: string;
  fetchedAt: string;
  fromCache?: boolean;
  manifest: string[];
  cards: {
    rdw_vehicle?: RdwVehicle;
    rdw_fuel?: RdwFuel[];
    rdw_apk_history?: ApkHistory;
    rdw_recall_status?: RecallStatus;
    rdw_modifications?: Modifications;
    [key: string]: unknown;
  };
  errors?: Record<string, string>;
}

export interface EnrichmentInsight {
  tone: "neutral" | "positive" | "warning";
  text: string;
}

export interface EnrichmentResponse {
  summary: string;
  insights: EnrichmentInsight[];
  generated: boolean;
  fromCache?: boolean;
}

export async function enrichVehicle(plate: string): Promise<EnrichmentResponse> {
  const response = await fetch(`/api/enrich/${encodeURIComponent(plate)}`, {
    method: "POST",
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body.error === "string"
        ? body.error
        : "AI-verrijking niet beschikbaar.";
    throw new Error(message);
  }

  return response.json() as Promise<EnrichmentResponse>;
}

export async function lookupVehicle(plate: string): Promise<VehicleLookupResponse> {
  const response = await fetch(`/api/vehicle/${encodeURIComponent(plate)}`, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body.error === "string"
        ? body.error
        : "De lookup is mislukt. Probeer het zo opnieuw.";
    throw new Error(message);
  }

  return response.json() as Promise<VehicleLookupResponse>;
}
