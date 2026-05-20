# Phase 3: Data Depth - Research

**Researched:** 2026-05-20
**Domain:** RDW data integration (APK history, recalls, modifications) with parallel source loading
**Confidence:** HIGH (verified with live RDW API calls and codebase inspection)

## Summary

Phase 3 adds three new detailed data cards to KentekenMagic by integrating six RDW datasets via the existing `sourceRegistry` + `Promise.allSettled` pattern. All new sources inherit the 3.5-second timeout and 24-hour cache TTL. The APK timeline **replaces** the existing `ApkCard` entirely (preserving expiry date and status badge at the top), while recall and modifications cards are new standalone cards.

**Primary recommendation:** Implement each of the six RDW sources following the `rdwVehicle` / `rdwFuel` reference pattern (Zod schema + passthrough + `DataSource<T>` interface), register them in `sourceRegistry`, and add corresponding frontend card components in `ResultPreview`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** APK timeline REPLACES `ApkCard` — does not add alongside it. New card owns all APK info (expiry + status badge + inspection history).
- **D-02:** Show last 5 inspections by default; "show more" toggle for older.
- **D-03:** Defects inline per inspection (count + description, no separate section).
- **D-04:** Defect detail: omschrijving (description) only, no RDW codes, no severity.
- **D-05:** All Phase 3 sources load in parallel via `sourceRegistry` + `Promise.allSettled`. No new endpoints.
- **D-06:** Per-source timeout: 3.5 seconds (same as `rdwVehicle`).
- **D-07:** Cache TTL: 24 hours (same as `rdwVehicle`).

### Claude's Discretion
- Recall card placement (separate card vs integrated) — planner decides.
- Modifications card scope and empty state (always shown or only when modifications exist) — planner decides.
- Frontend card ordering for Phase 3 cards — planner decides based on information hierarchy.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| APK timeline (load, parse, store) | Backend (API source) | Database (cache) | RDW fetch + per-source timeout in aggregator; Azure Table caches result |
| Defect join (inspections ↔ defects ↔ descriptions) | Backend (source logic) | — | Three tables (sgfe-77wx, a34c-vvps, hx2c-gt7k) must be joined server-side; frontend receives denormalized data |
| Recall status lookup | Backend (API source) | — | t49b-isb7 fetched per plate; status badge derived |
| Recall details (description, risk, repair info) | Backend (API source) | Frontend (card layout) | j9yg-7rg9 fetched; referenced by recall code; frontend arranges display |
| Modifications list | Backend (API source) | Frontend (empty state) | sghb-dzxx fetched per plate; frontend decides empty state UI |
| Card rendering (timeline, badges, inline defects) | Frontend | — | React components receive server data; Motion/Tailwind handle layout |

## RDW Dataset Schemas

### 1. Recall Status (t49b-isb7)
**Purpose:** Determines if vehicle has open recalls.
**Key query:** by `kenteken` (license plate).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| kenteken | string | "00BBL8" | License plate — **join key** |
| referenciecode_rdw | string | "MGP130086" | Unique recall ID — **links to j9yg-7rg9** |
| code_status | string | "P" | Status code (O=open, P=produced, etc.) |
| status | string | "Producent heeft herstel gemeld" | Human-readable status |

**Sample result count:** 1 row per plate (or 0 if no recalls).
**What it tells you:** Whether vehicle has ANY open/pending/repaired recalls.

### 2. Recall Details (j9yg-7rg9)
**Purpose:** Full context for each recall campaign.
**Key query:** by `referenciecode_rdw` (from t49b-isb7).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| referenciecode_rdw | string | "MGP070060" | Unique recall ID — **links back to t49b-isb7** |
| publicatiedatum_rdw | string | "20130328" | RDW publication date (YYYYMMDD) |
| omschrijving_defect | string | "Stuurkoppeling…" | **Frontend display text** |
| categorie_defect | string | "Motorrijtuigen… stuurinrichting" | Category (for context) |
| materiële_gevolgen | string | "Kans bestaat dat…" | Risk description |
| beschrijving_van_het_herstel | string | "Producent roept… terug" | Repair description |
| meer_informatie_op_internet | string | "(Nog) niet bekend" | Website if available |
| meer_informatie_via_telefoonnummer | string | "0162-585217" | Support phone |
| datum_aankondiging_producent | string | "20071106" | When announced (YYYYMMDD) |
| datum_informeren_eigenaar | string | "20071106" | When owners notified (YYYYMMDD) |
| datum_eigenaren_geïnformeerd | string | "20071106" | Actual notification date (YYYYMMDD) |
| risicobeoordeling_rdw | string | "ERN" | Risk level (ERN=high, MID=medium, LOW=low) |
| totaal_aantal_voertuigen_terugroepactie | string | "7500" | Global vehicle count |
| nationaal_opgegeven_aantal_voertuigen_terugroepactie | string | "1323" | NL-only count |
| api_terugroep_actie_status | string | "https://opendata.rdw.nl/resource/t49b-isb7.json" | Link to status dataset |

**Sample result count:** Multiple rows per recall campaign (one per referentiecode_rdw group).
**What it tells you:** Detailed recall definition, risk, and repair process.

### 3. APK Inspections (sgfe-77wx)
**Purpose:** Full inspection history with dates and expiry.
**Key query:** by `kenteken` (license plate).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| kenteken | string | "66SLSJ" | License plate — **join key** |
| meld_datum_door_keuringsinstantie | string | "20260213" | Inspection date (YYYYMMDD) — **sort by this** |
| meld_tijd_door_keuringsinstantie | string | "1345" | Inspection time (HHMM) |
| soort_erkenning_omschrijving | string | "APK Lichte voertuigen" | Light/Heavy vehicle type |
| soort_melding_ki_omschrijving | string | "periodieke controle" | Periodic / initial / change |
| vervaldatum_keuring | string | "20270228" | Next inspection due (YYYYMMDD) |
| api_gebrek_constateringen | string | "https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Geconstateerde-Gebreken/a34c-vvps" | Link to defects dataset |
| api_gebrek_beschrijving | string | "https://opendata.rdw.nl/dataset/Open-Data-RDW-Gebreken/hx2c-gt7k/" | Link to defect descriptions dataset |

**Sample result count:** Multiple rows (one per inspection).
**What it tells you:** Complete timeline of APK tests; latest row is current status.

**Critical note:** `vervaldatum_keuring` in the LATEST inspection row is what the current `ApkCard` displays. The new timeline card must preserve this behavior at the top.

### 4. APK Defects (a34c-vvps)
**Purpose:** Defects found during each APK inspection.
**Key query:** by `kenteken` + `meld_datum_door_keuringsinstantie` + `meld_tijd_door_keuringsinstantie` (compound key to match an inspection).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| kenteken | string | "00BPV1" | License plate |
| meld_datum_door_keuringsinstantie | string | "20250919" | Inspection date — **join key** |
| meld_tijd_door_keuringsinstantie | string | "1208" | Inspection time — **join key** |
| gebrek_identificatie | string | "576" | Defect ID — **links to hx2c-gt7k** |
| aantal_gebreken_geconstateerd | string | "1" | Count of this defect type |
| soort_erkenning_keuringsinstantie | string | "AZ" | Type of test facility |
| soort_erkenning_omschrijving | string | "APK Zware voertuigen" | Heavy/Light vehicle class |

**Sample result count:** Multiple rows per inspection (one per defect type found).
**What it tells you:** Which defects were found at which inspection; defect count aggregates by type.

**Critical join:** Three-field compound key: `(kenteken, meld_datum, meld_tijd)` matches an inspection row in sgfe-77wx.

### 5. Defect Descriptions (hx2c-gt7k)
**Purpose:** Consumer-friendly explanations for defect codes.
**Key query:** by `gebrek_identificatie` (from a34c-vvps).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| gebrek_identificatie | string | "005" | Defect ID — **links to a34c-vvps** |
| gebrek_omschrijving | string | "Goedkeuringsdocument ontbreekt bij taxi…" | **Frontend display text** |
| gebrek_paragraaf_nummer | string | "nl02" | RDW reference code (omit from frontend per D-04) |
| ingangsdatum_gebrek | string | "20170401" | When this defect type was added (YYYYMMDD) |
| einddatum_gebrek | string | "20180901" | When removed (if applicable; YYYYMMDD) |

**Sample result count:** One row per defect code.
**What it tells you:** Human-readable explanation for defect codes.

**Note:** `gebrek_paragraaf_nummer` and severity are NOT displayed per D-04. Only `omschrijving` (description).

### 6. Modifications (sghb-dzxx)
**Purpose:** Vehicle modifications (e.g., LPG conversions, aftermarket parts).
**Key query:** by `kenteken` (license plate).

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| kenteken | string | "0011UE" | License plate — **join key** |
| montagedatum | string | "19980128" | Installation date (YYYYMMDD) |
| demontagedatum | string | "0" | Removal date (0 = not removed; YYYYMMDD if removed) |
| soort_toe_te_voegen_object_omschrijving | string | "LPG Installatie" | Modification type description |
| merk_object_toegevoegd | string | "—" | Manufacturer of modification |
| gasinstallatie_tank_inhoud | string | "60" | Gas tank size (liters, if LPG) |
| merkcode_toegevoegd_object | string | "GEEN" | Manufacturer code (often "GEEN") |

**Sample result count:** Multiple rows (one per modification).
**What it tells you:** What modifications are registered for the vehicle; whether currently active (demontagedatum = 0) or removed.

---

## Dataset Relationships and Join Keys

```
┌─────────────────────────┐
│  sgfe-77wx              │
│  APK Inspections        │
│  PK: (kenteken,         │
│       meld_datum,       │
│       meld_tijd)        │
└────────┬────────────────┘
         │ match on (kenteken, meld_datum, meld_tijd)
         │
         ↓
┌─────────────────────────┐
│  a34c-vvps              │
│  APK Defects            │
│  (no PK defined)        │
└────────┬────────────────┘
         │ foreign key: gebrek_identificatie
         │
         ↓
┌─────────────────────────┐
│  hx2c-gt7k              │
│  Defect Descriptions    │
│  PK: gebrek_identificatie
└─────────────────────────┘

┌─────────────────────────┐
│  t49b-isb7              │
│  Recall Status          │
│  PK: kenteken           │ (most recent status per plate)
└────────┬────────────────┘
         │ foreign key: referenciecode_rdw
         │
         ↓
┌─────────────────────────┐
│  j9yg-7rg9              │
│  Recall Details         │
│  (no PK; multiple rows  │
│   per referentiecode)   │
└─────────────────────────┘

┌─────────────────────────┐
│  sghb-dzxx              │
│  Modifications          │
│  (no PK; multiple rows  │
│   per kenteken)         │
└─────────────────────────┘
```

### Server-Side Join Strategy

**APK Timeline card:** Backend must fetch sgfe-77wx, then for each inspection row, fetch a34c-vvps rows matching the compound key `(kenteken, meld_datum, meld_tijd)`. For each defect in a34c-vvps, fetch hx2c-gt7k by `gebrek_identificatie`. **Result:** Denormalized array of inspections with inline defects.

```typescript
// Backend pseudo-structure passed to frontend:
{
  rdw_apk_history: {
    plate: "AB12CD",
    currentExpiry: "2027-02-28",
    status: "valid",
    inspections: [
      {
        date: "2026-02-13T13:45:00.000",
        expiryDate: "2027-02-28",
        type: "periodieke controle",
        defectCount: 2,
        defects: [
          { id: "123", description: "Remmen slijtageindicator" },
          { id: "456", description: "Ruitsproeier niet werkend" }
        ]
      },
      // ... older inspections
    ]
  }
}
```

**Recall card:** Backend fetches t49b-isb7 by plate. If any recalls exist, fetch j9yg-7rg9 by referenciecode_rdw from the status rows. **Result:** Summary of open/repaired recalls with details.

**Modifications card:** Backend fetches sghb-dzxx by plate. **Result:** Array of modifications, optionally filtered to active only (demontagedatum = "0").

---

## Standard Stack

### Core (Already Established, Phase 3 Inherits)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^3.x | Schema validation | RDW responses are untrusted; Zod enforces shape + types |
| Azure Functions | v4 | Serverless runtime | Locked Azure commitment from Phases 0–2 |
| @azure/data-tables | ^13.x | Cache abstraction | Two-character partition key, TTL expiry |
| Next.js | 14.x | Static export + SPA | Locked from Phase 0 |
| React | 18/19.x | Components | Locked from Phase 0 |
| Motion (Framer Motion) | 11.x | Card animations | Existing pattern in Phase 1–2 cards |
| Tailwind CSS | ^3.x | Styling | Locked from Phase 0 |

### Phase 3 Specific — New Sources (No New Dependencies)
| Library | Version | Purpose | Installation |
|---------|---------|---------|--------------|
| (none required) | — | Phase 3 uses only Zod + existing fetch logic | Already installed |

**Version verification:**
```bash
npm view zod version          # 3.23.x
npm view @azure/data-tables version  # 13.2.x
```

### Implementation Pattern (Reference)
The existing `rdwVehicle` and `rdwFuel` sources are the canonical implementations for Phase 3:

- **`rdwVehicle`** (2315 bytes):
  - Zod schema with `.passthrough()` for unknown fields
  - Date mapping utility: raw `yyyymmdd` → `parseRdwDate()` → ISO string
  - `DataSource<T>` interface implementation
  - Cache TTL: 24 hours, timeout: 3.5 seconds

- **`rdwFuel`** (885 bytes):
  - Array return type: `DataSource<RdwFuel[]>`
  - Validates each array element
  - No custom transformation (fuel data is already consumer-ready)

---

## Implementation Details for Phase 3 Sources

### Source: rdwApkHistory (sgfe-77wx + a34c-vvps + hx2c-gt7k)

**Challenge:** Three datasets must be joined server-side. Phase 3 decision is to load in parallel, then join in-memory.

**Approach:**

```typescript
// fetch(plate):
// 1. Fetch all inspections from sgfe-77wx (no filter needed; all rows)
// 2. For each inspection, fetch defects from a34c-vvps matching (kenteken, date, time)
// 3. For each defect, fetch description from hx2c-gt7k
// 4. Denormalize into: inspections[{ date, expiry, defects[...] }]

// Return structure (from DataSource<ApkHistory>):
export interface ApkInspection {
  date: string; // ISO date (from meld_datum_datetime)
  expiryDate: string; // ISO date (from vervaldatum_keuring)
  type: string; // soort_melding_ki_omschrijving
  facility: string; // soort_erkenning_omschrijving
  defectCount: number; // sum of aantal_gebreken_geconstateerd
  defects: Array<{
    id: string; // gebrek_identificatie
    description: string; // gebrek_omschrijving from hx2c-gt7k
    count: number; // aantal_gebreken_geconstateerd
  }>;
}

export interface ApkHistory {
  plate: string;
  currentExpiry: string | null; // Latest vervaldatum_keuring
  currentStatus: "valid" | "soon" | "expired" | "unknown"; // Derived from currentExpiry
  inspections: ApkInspection[]; // Sorted descending by date
  totalCount: number; // Total inspection count
}
```

**Pseudo-code:**
```typescript
async fetch(plate: string): Promise<ApkHistory | null> {
  const inspections = await fetchRdwDataset<InspectionRow[]>("sgfe-77wx", { kenteken: plate });
  
  if (!inspections || inspections.length === 0) return null;
  
  // Build denormalized structure
  const detailed = await Promise.all(
    inspections.map(async (insp) => {
      const defects = await fetchRdwDataset<DefectRow[]>("a34c-vvps", {
        kenteken: plate,
        meld_datum_door_keuringsinstantie: insp.meld_datum,
        meld_tijd_door_keuringsinstantie: insp.meld_tijd
      });
      
      const defectDetails = await Promise.all(
        (defects || []).map(async (defect) => {
          const desc = await fetchRdwDataset<DescRow[]>("hx2c-gt7k", {
            gebrek_identificatie: defect.gebrek_identificatie
          });
          return {
            id: defect.gebrek_identificatie,
            description: desc[0]?.gebrek_omschrijving || "—",
            count: parseInt(defect.aantal_gebreken_geconstateerd ?? "0", 10)
          };
        })
      );
      
      return {
        date: parseRdwDate(insp.meld_datum) + "T" + insp.meld_tijd, // ISO datetime
        expiryDate: parseRdwDate(insp.vervaldatum_keuring),
        type: insp.soort_melding_ki_omschrijving,
        facility: insp.soort_erkenning_omschrijving,
        defectCount: defectDetails.reduce((sum, d) => sum + d.count, 0),
        defects: defectDetails
      };
    })
  );
  
  const sorted = detailed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  
  return {
    plate,
    currentExpiry: latest?.expiryDate || null,
    currentStatus: apkStatus(latest?.expiryDate),
    inspections: sorted,
    totalCount: sorted.length
  };
}
```

**Concern: N+1 queries.** This approach makes 1 + inspections.length + defects.length API calls. Per D-05, all sources load in parallel via `Promise.allSettled`, so individual timeouts (3.5s per source) apply. Mitigation: Fetch all defects + descriptions in parallel within the source's `fetch()` method; the 3.5s timeout includes all sub-fetches.

### Source: rdwRecallStatus (t49b-isb7 + j9yg-7rg9)

```typescript
export interface RecallDetail {
  referenceCode: string; // referenciecode_rdw
  defectDescription: string; // omschrijving_defect
  riskLevel: string; // risicobeoordeling_rdw (ERN/MID/LOW)
  publicationDate: string | null; // ISO from publicatiedatum_rdw
  repairDescription: string; // beschrijving_van_het_herstel
  moreInfoUrl?: string; // meer_informatie_op_internet
  moreInfoPhone?: string; // meer_informatie_via_telefoonnummer
}

export interface RecallStatus {
  plate: string;
  hasOpenRecall: boolean; // status code = "O" or similar
  statusDescription: string; // status field
  recalls: RecallDetail[]; // Empty if no recalls
}
```

**Fetch logic:**
```typescript
async fetch(plate: string): Promise<RecallStatus | null> {
  const statusRows = await fetchRdwDataset<StatusRow[]>("t49b-isb7", { kenteken: plate });
  
  if (!statusRows || statusRows.length === 0) {
    return {
      plate,
      hasOpenRecall: false,
      statusDescription: "Geen openstaande terugroepacties",
      recalls: []
    };
  }
  
  const recalls = await Promise.all(
    statusRows.map(async (status) => {
      const details = await fetchRdwDataset<DetailRow[]>("j9yg-7rg9", {
        referentiecode_rdw: status.referentiecode_rdw
      });
      return {
        referenceCode: status.referentiecode_rdw,
        defectDescription: details[0]?.omschrijving_defect || "—",
        riskLevel: details[0]?.risicobeoordeling_rdw || "—",
        publicationDate: parseRdwDate(details[0]?.publicatiedatum_rdw),
        repairDescription: details[0]?.beschrijving_van_het_herstel || "—",
        moreInfoUrl: details[0]?.meer_informatie_op_internet,
        moreInfoPhone: details[0]?.meer_informatie_via_telefoonnummer
      };
    })
  );
  
  return {
    plate,
    hasOpenRecall: statusRows.some(r => r.code_status === "O"), // Assume "O" = open
    statusDescription: statusRows[0]?.status || "Onbekende status",
    recalls
  };
}
```

### Source: rdwModifications (sghb-dzxx)

```typescript
export interface Modification {
  description: string; // soort_toe_te_voegen_object_omschrijving
  installDate: string | null; // ISO from montagedatum
  removalDate: string | null; // ISO from demontagedatum (null if "0")
  isActive: boolean; // demontagedatum === "0"
  manufacturer?: string; // merk_object_toegevoegd
  tankCapacity?: string; // gasinstallatie_tank_inhoud (for gas)
}

export interface Modifications {
  plate: string;
  modifications: Modification[];
  activeCount: number; // Count where isActive = true
}
```

**Fetch logic:**
```typescript
async fetch(plate: string): Promise<Modifications | null> {
  const rows = await fetchRdwDataset<ModRow[]>("sghb-dzxx", { kenteken: plate });
  
  if (!rows || rows.length === 0) {
    return {
      plate,
      modifications: [],
      activeCount: 0
    };
  }
  
  const mods = rows.map(row => ({
    description: row.soort_toe_te_voegen_object_omschrijving,
    installDate: parseRdwDate(row.montagedatum),
    removalDate: row.demontagedatum === "0" ? null : parseRdwDate(row.demontagedatum),
    isActive: row.demontagedatum === "0",
    manufacturer: row.merk_object_toegevoegd,
    tankCapacity: row.gasinstallatie_tank_inhoud
  }));
  
  return {
    plate,
    modifications: mods,
    activeCount: mods.filter(m => m.isActive).length
  };
}
```

---

## Frontend Type Changes Required

In `frontend/src/lib/api.ts`, extend `VehicleLookupResponse.cards`:

```typescript
export interface ApkHistory {
  plate: string;
  currentExpiry: string | null;
  currentStatus: "valid" | "soon" | "expired" | "unknown";
  inspections: Array<{
    date: string;
    expiryDate: string;
    type: string;
    facility: string;
    defectCount: number;
    defects: Array<{ id: string; description: string; count: number }>;
  }>;
  totalCount: number;
}

export interface RecallStatus {
  plate: string;
  hasOpenRecall: boolean;
  statusDescription: string;
  recalls: Array<{
    referenceCode: string;
    defectDescription: string;
    riskLevel: string;
    publicationDate: string | null;
    repairDescription: string;
    moreInfoUrl?: string;
    moreInfoPhone?: string;
  }>;
}

export interface Modifications {
  plate: string;
  modifications: Array<{
    description: string;
    installDate: string | null;
    removalDate: string | null;
    isActive: boolean;
    manufacturer?: string;
    tankCapacity?: string;
  }>;
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
```

---

## Current ApkCard Analysis

**Location:** `frontend/src/components/LookupExperience.tsx`, lines 266–330.

**Current responsibilities:**
- Display APK expiry date (verde for valid, amber for <30d, red for expired)
- Color-coded status badge (text + icon)
- One-line recall indicator badge (if `rdw_vehicle.openstaande_terugroepactie_indicator === "Ja"`)

**What the new APK Timeline card must preserve:**
1. **Expiry date at the top** — same styling logic (`apkStatus()` function)
2. **Status badge** — verde/amber/red color scheme, text label
3. **Recall indicator** — if present, show red "Terugroepactie" badge alongside status

**What the new card must add:**
1. **Chronological inspection timeline** — latest at top, oldest at bottom (per D-02, show last 5, rest behind toggle)
2. **Per-inspection defects** — collapsed/expandable, showing count + descriptions inline
3. **Timeline entry structure:** `[date + time] [facility] [expiry] [defects count and list]`

**Removal:** Delete the current `ApkCard` function entirely once new `ApkTimelineCard` is implemented.

---

## Edge Cases and Gotchas

### APK Inspections
- **Empty defects:** An inspection can have 0 defects (passed cleanly). Defect list is empty array, not null.
- **Multiple defects of same type:** `aantal_gebreken_geconstateerd` can be > 1. Display as "2× Remmen" not two rows.
- **Null inspection times:** `meld_tijd_door_keuringsinstantie` is required (HHMM format). If missing, treat as "00:00".
- **Future inspection dates:** If a test date is in the future (data entry error), still display chronologically.

### Recalls
- **Multiple recalls per plate:** Rare but possible. Display all, sorted by date.
- **Status code ambiguity:** RDW code_status unclear (docs say "O", "P", etc., but samples show "P"). Backend should treat any non-empty status row as "present". Frontend decides "open" vs. "repaired" based on detailed status field.
- **Missing j9yg-7rg9 details:** If a recall code has no match in j9yg-7rg9, fall back to status row's `status` field and omit details.

### Modifications
- **Removal date "0":** Indicates never removed (still active). NOT null; check for string "0".
- **Gas capacity only for LPG:** `gasinstallatie_tank_inhoud` is sparse (only LPG conversions). Don't assume all mods have it.
- **Null or empty descriptions:** Possible, especially for older entries. Default to modification date + "Onbekende wijziging" or similar.

### Date Parsing
- **RDW format:** `yyyymmdd` (no separators). `parseRdwDate()` already handles this.
- **Null dates:** RDW can omit optional date fields. Treat as `null`, not "0" or "".
- **Invalid dates (e.g., "00000000"):** `parseRdwDate()` should return `null`.

### Timeout/Error Handling
- **Per-source timeout:** 3.5 seconds per source. If a source times out, it doesn't block other Phase 3 sources or core lookup.
- **Partial source success:** If sgfe-77wx succeeds but a34c-vvps times out for a defect lookup, frontend receives partial data (fewer defects, but inspection still shows). This is acceptable per D-05.
- **N+1 mitigation:** The rdwApkHistory source must fetch all inspections, then all defects in parallel (not serial). Timeout applies to entire operation.

---

## Code Examples

### Reference: rdwVehicle Implementation

```typescript
// From api/src/sources/rdwVehicle.ts

import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";

const rdwVehicleSchema = z
  .object({
    kenteken: z.string(),
    voertuigsoort: z.string().optional(),
    merk: z.string().optional(),
    // ... 28 more fields
  })
  .passthrough(); // Preserve unknown fields

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
```

### Reference: rdwFuel Implementation

```typescript
// From api/src/sources/rdwFuel.ts

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
```

**Key patterns to replicate:**
1. Schema with `.passthrough()` to preserve unmapped fields
2. `DataSource<T>` interface with `id`, `name`, `timeoutMs`, `cacheTtlSeconds`, `fetch()`
3. Validation on each item (or array) before return
4. Return `null` if no data; return `[]` if empty array type
5. Use `fetchRdwDataset()` helper with dataset ID and query params

---

## Common Pitfalls

### Pitfall 1: N+1 Defect Lookups
**What goes wrong:** Backend code loops over defects and fetches hx2c-gt7k serially. By the time defect descriptions arrive, the 3.5-second timeout has passed; defects show without descriptions.

**Why it happens:** Eager to reuse existing `fetch()` pattern, developer wraps each defect lookup in `await`, creating serial dependency chain.

**How to avoid:** Use `Promise.all()` to fetch all defect descriptions in parallel within the `fetch()` method. The timeout applies to the entire `fetch()` invocation, not individual sub-fetches.

**Warning signs:** Backend logs show "source timed out"; frontend sees inspection with zero defects despite RDW having them.

### Pitfall 2: Forgetting to Sort Inspections
**What goes wrong:** Frontend receives inspections in random or oldest-first order. Timeline looks backward.

**Why it happens:** `fetchRdwDataset()` returns results in insertion order; not sorted.

**How to avoid:** Backend sorts `inspections` descending by date before returning. Latest first.

**Warning signs:** User sees 2010 inspection before 2024 inspection.

### Pitfall 3: Confusing Current Expiry
**What goes wrong:** New APK Timeline card displays the expiry date from an old inspection, not the latest one. Status badge is wrong.

**Why it happens:** Code takes `inspections[0].expiryDate` before sorting, or sorts ascending by mistake.

**How to avoid:** Sort descending by date. Latest row is `inspections[0]`. Extract `currentExpiry` from there.

**Warning signs:** Expiry date shown is from a historical inspection, not recent.

### Pitfall 4: Null vs. Empty String Dates
**What goes wrong:** Code checks `if (removalDate)` for a modification. If `demontagedatum === "0"`, this is truthy (non-empty string), so condition passes; code treats modification as removed.

**Why it happens:** RDW uses string "0" to mean "not removed", not null.

**How to avoid:** Explicitly check `row.demontagedatum !== "0"` before parsing as date. Else set `removalDate = null`.

**Warning signs:** All modifications show as "removed" even though vehicle still has them active.

### Pitfall 5: Missing Defect Details Cache Key
**What goes wrong:** Frontend receives `{ defects: [{ id: "123", description: "..." }] }` for one inspection, and `{ defects: [{ id: "123", description: "Different text" }] }` for another. Same defect ID, different text. User is confused.

**Why it happens:** hx2c-gt7k descriptions can change over time (RDW revises definitions). If frontend caches or deduplicates by ID alone, it conflicts.

**How to avoid:** Always fetch fresh hx2c-gt7k for each inspection. Don't cache at frontend level. Backend cache (Azure Table) is fine; it's keyed by plate + date, not by defect ID.

**Warning signs:** Defect text inconsistency across different inspections; community reports show the same defect code with different RDW definitions over the years.

---

## Validation Architecture

**Test framework:** Vitest (used in existing `api/src/__tests__/plate.test.ts`)

**Configuration:** Detected in `api/` (no explicit config; uses default Vitest + TypeScript esbuild).

**Existing test pattern:**
```typescript
import { describe, expect, it } from "vitest";

describe("plate utilities", () => {
  it("normalizes separators and casing", () => {
    expect(normalizePlate("ab-12 cd")).toBe("AB12CD");
  });
});
```

### Phase 3 Test Requirements

| Requirement | Test Type | Command | File Path |
|-------------|-----------|---------|-----------|
| rdwApkHistory loads and denormalizes inspections | unit | `vitest api/src/__tests__/sources/rdwApkHistory.test.ts` | api/src/__tests__/sources/rdwApkHistory.test.ts |
| rdwApkHistory joins defects by compound key | unit | (same) | (same) |
| rdwApkHistory sorts inspections descending by date | unit | (same) | (same) |
| rdwApkHistory timeout: partial data if defects time out | unit | (same) | (same) |
| rdwApkHistory returns null if no inspections | unit | (same) | (same) |
| rdwRecallStatus fetches and joins recall details | unit | `vitest api/src/__tests__/sources/rdwRecallStatus.test.ts` | api/src/__tests__/sources/rdwRecallStatus.test.ts |
| rdwRecallStatus returns empty recalls if no status | unit | (same) | (same) |
| rdwModifications parses active/removed dates correctly | unit | `vitest api/src/__tests__/sources/rdwModifications.test.ts` | api/src/__tests__/sources/rdwModifications.test.ts |
| rdwModifications filters "0" as "not removed" | unit | (same) | (same) |
| ApkTimelineCard renders inspection timeline (last 5 visible) | integration | `vitest frontend/__tests__/components/ApkTimelineCard.test.tsx` | frontend/__tests__/components/ApkTimelineCard.test.tsx |
| ApkTimelineCard "show more" toggle reveals older inspections | integration | (same) | (same) |
| RecallCard renders open/repaired status badges | integration | `vitest frontend/__tests__/components/RecallCard.test.tsx` | frontend/__tests__/components/RecallCard.test.tsx |
| ModificationsCard renders active and removed modifications | integration | `vitest frontend/__tests__/components/ModificationsCard.test.tsx` | frontend/__tests__/components/ModificationsCard.test.tsx |

**Sampling:**
- Per-task commit: Run quick unit tests for the source being added (`npm run test:unit -- sources/rdw*.test.ts`)
- Per-wave merge: Full Vitest suite (`npm run test`)

**Wave 0 gaps:**
- [ ] `api/src/__tests__/sources/rdwApkHistory.test.ts` — success, empty, timeout, defect join
- [ ] `api/src/__tests__/sources/rdwRecallStatus.test.ts` — success, no recalls, missing details
- [ ] `api/src/__tests__/sources/rdwModifications.test.ts` — active/removed, null manufacturer
- [ ] `frontend/__tests__/components/ApkTimelineCard.test.tsx` — render, toggle, error state
- [ ] `frontend/__tests__/components/RecallCard.test.tsx` — open/repaired status
- [ ] `frontend/__tests__/components/ModificationsCard.test.tsx` — empty state, active filter
- [ ] `api/` `package.json` test script configured for Vitest if not already

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Public data; no auth required |
| V3 Session Management | no | Stateless lookups; no sessions |
| V4 Access Control | no | All RDW data is public |
| V5 Input Validation | yes | Plate normalization + Zod schema validation on all RDW responses |
| V6 Cryptography | no | No encryption of public data needed |
| V7 Error Handling | yes | Log errors without exposing RDW API structure or secrets |
| V9 Communications | yes | All RDW API calls over HTTPS |

### Known Threat Patterns for RDW Integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plate injection (e.g., `AB12CD'; DROP TABLE--`) | Tampering | Plates are normalized to 6 alphanumerics; passed as query param, never interpolated into SQL |
| RDW API response poisoning | Tampering | Zod schema validates all responses before use; unknown fields preserved but not executed |
| Timeout abuse (crafted plate causes slow lookup) | Denial of Service | Per-source 3.5s timeout; Promise.race enforces hard timeout |
| Rate limiting evasion | Denial of Service | RDW Socrata rate limits by IP; Azure Functions on same IP; rate limits are cumulative |
| Cache poisoning (stale data shown as fresh) | Tampering | Cache TTL is 24 hours; `expiresAt` enforced in tableCache; expired entries deleted |
| Sensitive data in error logs | Information Disclosure | Errors logged without plate or API response body; log only error message |

### No Custom Cryptography
All Phase 3 sources use only Zod validation and Azure Table cache. No hand-rolled encryption or hashing. Azure Table stores data in plaintext (public data); secrets are never stored in vehicle cache.

---

## Sources

### Primary (HIGH confidence)
- **RDW Socrata API** — Live API calls to `opendata.rdw.nl` fetched 2026-05-20, confirmed schema and sample data for all 6 Phase 3 datasets
- **Existing codebase** (`api/src/sources/rdwVehicle.ts`, `rdwFuel.ts`, `types.ts`, `registry.ts`) — Reference implementations verified
- **Existing codebase** (`api/src/functions/vehicle.ts`) — Aggregator pattern and timeout/cache logic verified
- **Existing codebase** (`frontend/src/components/LookupExperience.tsx`) — ApkCard implementation and card structure patterns verified
- **CONTEXT.md** — User decisions D-01 through D-07 confirmed

### Secondary (MEDIUM confidence)
- **RDW Dataset Documentation** (inferred from API responses) — No official RDW docs found; schema confirmed via metadata API calls

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Status code "O" means open recall; others (e.g., "P") mean repaired/processed | Recall Details | Frontend badge logic will show wrong status; planner must verify with RDW docs |
| A2 | Defect descriptions in hx2c-gt7k do not change frequently; 24-hour cache is acceptable | Edge Cases | Stale descriptions shown if RDW updates definitions mid-day; acceptable risk per D-07 |
| A3 | `meld_datum + meld_tijd` uniquely identifies an inspection | APK Joins | Multiple inspections on same date/time are possible (two facilities, same vehicle); join may match wrong defects |
| A4 | RDW Socrata API response time for a single defect lookup is <1 second on average | APK Implementation | N+1 defect fetches will exceed 3.5s timeout; mitigation: fetch in parallel, but data loss possible |
| A5 | "Terugroepactie" (recall) badge in current ApkCard is always derived from `rdw_vehicle.openstaande_terugroepactie_indicator` | APK Card Analysis | If `t49b-isb7` has open recalls but vehicle flag is not set, new card will not show them; planner must verify both sources |

---

## Open Questions

1. **Defect lookup performance:** Fetching defect descriptions in parallel within a 3.5-second timeout requires careful Promise.all() orchestration. Can the backend guarantee sub-second response times from RDW Socrata for defect lookups? Or should the frontend accept missing descriptions as acceptable partial data?
   - **Recommendation:** Implement with parallel fetches. If defect descriptions fail, show defect count only (no description). Test locally and document acceptable timeout behavior.

2. **Recall status code interpretation:** RDW's `code_status` in t49b-isb7 has unclear semantics. Sample showed "P" (produced?). What values mean "open", "pending", "completed"? 
   - **Recommendation:** Planner should verify with RDW docs or test with plates that have known recall statuses. Frontend can start with assuming "O" = open, all others = processed, and adjust.

3. **Modifications card scope:** Should modifications card always be shown (empty state: "Geen wijzigingen"), or only when modifications exist?
   - **Recommendation:** Per D-06, planner decides. Recommend "show when data exists" for cleaner UI. If shown always, "Geen wijzigingen" is clear.

4. **Card ordering in ResultPreview:** Current order is IdentityCard → ApkCard → TechCard → FuelCard → RegistrationCard → EnrichmentCard. Where should ApkTimelineCard, RecallCard, and ModificationsCard appear?
   - **Recommendation:** Per D-06, planner decides. Suggest: ApkTimelineCard (replaces ApkCard position), RecallCard (after Identification), ModificationsCard (last before Enrichment).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API functions | ✓ | 20.x | — |
| npm | Dependency management | ✓ | 9.x | — |
| Vitest | Test framework | ✓ | ^1.0 | — |
| Azure Functions Core Tools | Local dev | ✓ | 4.x | Deployed testing |
| RDW Socrata API | Data source | ✓ | — (external) | Manual testing with curl |

**Missing dependencies with no fallback:** None.

---

## Metadata

**Confidence breakdown:**
- RDW dataset schemas: **HIGH** — Verified with live API calls and sample data
- DataSource pattern: **HIGH** — Reference implementation inspected (rdwVehicle, rdwFuel)
- Frontend integration: **HIGH** — Existing card pattern understood (ApkCard, LookupExperience)
- Join logic complexity: **MEDIUM** — N+1 query risk identified; mitigation required
- Edge cases: **MEDIUM** — Sample data limited; some date/code edge cases inferred

**Research date:** 2026-05-20
**Valid until:** 2026-06-03 (RDW data stable; no major API changes expected in 2 weeks)
