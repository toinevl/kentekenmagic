# Phase 3: Data Depth - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 12 (3 new sources, 3 modified files, 6 test files)
**Analogs found:** 11 / 12 (rdwVehicle and rdwFuel provide all patterns; test pattern from plate.test.ts)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `api/src/sources/rdwApkHistory.ts` | service (DataSource) | CRUD + join | `api/src/sources/rdwVehicle.ts` | exact |
| `api/src/sources/rdwRecallStatus.ts` | service (DataSource) | CRUD | `api/src/sources/rdwVehicle.ts` | exact |
| `api/src/sources/rdwModifications.ts` | service (DataSource) | CRUD | `api/src/sources/rdwFuel.ts` | exact |
| `api/src/sources/registry.ts` | config | config-merge | `api/src/sources/registry.ts` | self (modify) |
| `frontend/src/lib/api.ts` | type definitions | config-merge | `frontend/src/lib/api.ts` | self (modify) |
| `frontend/src/components/LookupExperience.tsx` | component (React) | request-response | `frontend/src/components/LookupExperience.tsx` | self (modify) |
| `api/src/__tests__/sources/rdwApkHistory.test.ts` | test | unit | `api/src/__tests__/plate.test.ts` | structure-match |
| `api/src/__tests__/sources/rdwRecallStatus.test.ts` | test | unit | `api/src/__tests__/plate.test.ts` | structure-match |
| `api/src/__tests__/sources/rdwModifications.test.ts` | test | unit | `api/src/__tests__/plate.test.ts` | structure-match |
| `frontend/__tests__/components/ApkTimelineCard.test.tsx` | test | integration | `api/src/__tests__/plate.test.ts` | structure-match |
| `frontend/__tests__/components/RecallCard.test.tsx` | test | integration | `api/src/__tests__/plate.test.ts` | structure-match |
| `frontend/__tests__/components/ModificationsCard.test.tsx` | test | integration | `api/src/__tests__/plate.test.ts` | structure-match |

---

## Pattern Assignments

### `api/src/sources/rdwApkHistory.ts` (service, CRUD + join)

**Analog:** `api/src/sources/rdwVehicle.ts` (single-record fetch + parse) and `api/src/sources/rdwFuel.ts` (array type return)

**Imports pattern** (from rdwVehicle lines 1–4):
```typescript
import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";
```

**Schema pattern with passthrough** (from rdwVehicle lines 6–32):
```typescript
const rdwApkHistorySchema = z
  .object({
    // APK inspection fields from sgfe-77wx
    kenteken: z.string(),
    meld_datum_door_keuringsinstantie: z.string().optional(),
    meld_tijd_door_keuringsinstantie: z.string().optional(),
    soort_melding_ki_omschrijving: z.string().optional(),
    soort_erkenning_omschrijving: z.string().optional(),
    vervaldatum_keuring: z.string().optional()
  })
  .passthrough(); // Preserve unknown fields for future expansion
```

**Type definition pattern** (inspired by rdwVehicle lines 34–41, but custom for APK):
```typescript
export interface ApkInspection {
  date: string; // ISO datetime from meld_datum + meld_tijd
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
```

**DataSource interface implementation** (from rdwVehicle lines 43–69):
```typescript
export const rdwApkHistory: DataSource<ApkHistory> = {
  id: "rdw_apk_history",
  name: "RDW APK-keuringsresultaten",
  timeoutMs: 3500,  // Match rdwVehicle timeout
  cacheTtlSeconds: 24 * 60 * 60,  // 24 hours, same as rdwVehicle
  async fetch(plate: string): Promise<ApkHistory | null> {
    // Fetch inspection records from sgfe-77wx
    // For each inspection, fetch defects from a34c-vvps
    // For each defect, fetch description from hx2c-gt7k
    // Return denormalized structure with sorted inspections
  }
};
```

**Key pattern: N+1 query mitigation via Promise.all()** (from rdwFuel lines 30–31, adapted for parallel defect fetches):
```typescript
// Do NOT use serial await in a loop. Instead:
const defectDetails = await Promise.all(
  (defects || []).map(async (defect) => {
    const desc = await fetchRdwDataset<DescRow[]>("hx2c-gt7k", {
      gebrek_identificatie: defect.gebrek_identificatie
    });
    return { id: defect.gebrek_identificatie, description: desc[0]?.gebrek_omschrijving || "—" };
  })
);
```

---

### `api/src/sources/rdwRecallStatus.ts` (service, CRUD)

**Analog:** `api/src/sources/rdwVehicle.ts` with two-fetch join pattern

**Imports pattern** (same as rdwVehicle):
```typescript
import { z } from "zod";
import { parseRdwDate } from "../lib/date.js";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";
```

**Schema pattern** (from rdwVehicle lines 6–32):
```typescript
const recallStatusSchema = z
  .object({
    kenteken: z.string(),
    referenciecode_rdw: z.string().optional(),
    code_status: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();
```

**DataSource implementation** (from rdwVehicle lines 43–69):
```typescript
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
  cacheTtlSeconds: 24 * 60 * 60,
  async fetch(plate: string): Promise<RecallStatus | null> {
    // Fetch t49b-isb7 by plate
    // For each status row, fetch j9yg-7rg9 by referentiecode_rdw
    // Return aggregated recall status with details
  }
};
```

---

### `api/src/sources/rdwModifications.ts` (service, CRUD)

**Analog:** `api/src/sources/rdwFuel.ts` (array return type, straightforward mapping)

**Imports pattern** (from rdwFuel lines 1–3):
```typescript
import { z } from "zod";
import { fetchRdwDataset } from "./rdw.js";
import type { DataSource } from "./types.js";
```

**Schema pattern** (from rdwFuel lines 5–13):
```typescript
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
```

**Array-based DataSource** (from rdwFuel lines 17–33):
```typescript
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
  cacheTtlSeconds: 24 * 60 * 60,
  async fetch(plate: string): Promise<Modifications | null> {
    const rows = await fetchRdwDataset<unknown[]>("sghb-dzxx", { kenteken: plate });
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        plate,
        modifications: [],
        activeCount: 0
      };
    }
    return {
      plate,
      modifications: rows.map(row => ({
        description: row.soort_toe_te_voegen_object_omschrijving,
        installDate: parseRdwDate(row.montagedatum),
        removalDate: row.demontagedatum === "0" ? null : parseRdwDate(row.demontagedatum),
        isActive: row.demontagedatum === "0",
        manufacturer: row.merk_object_toegevoegd,
        tankCapacity: row.gasinstallatie_tank_inhoud
      })),
      activeCount: mods.filter(m => m.isActive).length
    };
  }
};
```

**Note: Careful null handling for "0" string** — this is a critical edge case from RESEARCH.md Pitfall 4:
```typescript
// WRONG: if (removalDate) treats "0" as truthy
// RIGHT:
removalDate: row.demontagedatum === "0" ? null : parseRdwDate(row.demontagedatum)
```

---

### `api/src/sources/registry.ts` (config, modify)

**Analog:** Self (existing registry at `api/src/sources/registry.ts` lines 1–5)

**Current state** (lines 1–5):
```typescript
import { rdwFuel } from "./rdwFuel.js";
import { rdwVehicle } from "./rdwVehicle.js";
import type { DataSource } from "./types.js";

export const sourceRegistry: DataSource[] = [rdwVehicle, rdwFuel];
```

**Modification pattern — add three new sources in order**:
```typescript
import { rdwFuel } from "./rdwFuel.js";
import { rdwVehicle } from "./rdwVehicle.js";
import { rdwApkHistory } from "./rdwApkHistory.js";
import { rdwRecallStatus } from "./rdwRecallStatus.js";
import { rdwModifications } from "./rdwModifications.js";
import type { DataSource } from "./types.js";

export const sourceRegistry: DataSource[] = [
  rdwVehicle,
  rdwFuel,
  rdwApkHistory,
  rdwRecallStatus,
  rdwModifications
];
```

**Note:** No changes to the aggregator (`api/src/functions/vehicle.ts`). It automatically picks up new sources via `sourceRegistry`. Per D-05, `Promise.allSettled` pattern (actually `Promise.all` + `Promise.race` timeout per source) is already in place and will apply to Phase 3 sources.

---

### `frontend/src/lib/api.ts` (type definitions, modify)

**Analog:** Self (existing API types at `frontend/src/lib/api.ts`)

**Current state** (lines 41–53):
```typescript
export interface VehicleLookupResponse {
  plate: string;
  displayPlate?: string;
  fetchedAt: string;
  fromCache?: boolean;
  manifest: string[];
  cards: {
    rdw_vehicle?: RdwVehicle;
    rdw_fuel?: RdwFuel[];
    [key: string]: unknown;
  };
  errors?: Record<string, string>;
}
```

**Add new type interfaces before VehicleLookupResponse**:
```typescript
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
```

**Update VehicleLookupResponse.cards to include new sources**:
```typescript
cards: {
  rdw_vehicle?: RdwVehicle;
  rdw_fuel?: RdwFuel[];
  rdw_apk_history?: ApkHistory;
  rdw_recall_status?: RecallStatus;
  rdw_modifications?: Modifications;
  [key: string]: unknown;
};
```

---

### `frontend/src/components/LookupExperience.tsx` (component, modify)

**Analog:** Self (existing card components at `frontend/src/components/LookupExperience.tsx`)

**Current card structure** (lines 186–207):
```typescript
function ResultPreview({ data }: { data: VehicleLookupResponse }) {
  const plate = data.displayPlate ?? formatPlate(data.plate);
  const vehicle = data.cards.rdw_vehicle as RdwVehicle | undefined;
  const fuels = (data.cards.rdw_fuel ?? []) as RdwFuel[];

  const enrichQuery = useQuery({
    queryKey: ["enrich", data.plate],
    queryFn: () => enrichVehicle(data.plate),
    retry: 0,
    staleTime: 7 * 24 * 60 * 60 * 1000
  });

  return (
    <>
      <IdentityCard plate={plate} fromCache={data.fromCache} vehicle={vehicle} />
      <ApkCard vehicle={vehicle} />
      <TechCard vehicle={vehicle} />
      <FuelCard vehicle={vehicle} fuels={fuels} />
      <RegistrationCard vehicle={vehicle} />
      <EnrichmentCard query={enrichQuery} />
    </>
  );
}
```

**Required modifications:**

1. **Replace ApkCard with ApkTimelineCard** — Delete current `ApkCard` function (lines 266–330). Add new `ApkTimelineCard` that:
   - Receives `apkHistory: ApkHistory | undefined` prop
   - Preserves status badge styling from current ApkCard (lines 271–304)
   - Renders inspection timeline (last 5 visible, "show more" toggle per D-02)
   - Shows defects inline per inspection with count + descriptions (per D-03)

2. **Add RecallCard and ModificationsCard** to ResultPreview in appropriate positions. Per D-06 (planner discretion), suggest placement:
   - `ApkTimelineCard` at position 2 (replaces ApkCard)
   - `RecallCard` at position 3 (after IdentityCard, before TechCard or after ApkTimelineCard)
   - `ModificationsCard` at position 5 (after FuelCard, before RegistrationCard)

**Card component pattern template** (from ApkCard lines 266–330 and EnrichmentCard lines 461–497):
```typescript
function ApkTimelineCard({ 
  apkHistory 
}: { 
  apkHistory: ApkHistory | undefined 
}) {
  if (!apkHistory) return null;
  
  const status = apkStatus(apkHistory.currentExpiry);
  const statusStyles = { /* ... reuse from current ApkCard lines 271–304 ... */ }[status];
  const [showAll, setShowAll] = useState(false);
  const displayedInspections = showAll ? apkHistory.inspections : apkHistory.inspections.slice(0, 5);

  return (
    <article className={`rounded-lg border ${statusStyles.border} ${statusStyles.bg} p-5 shadow-sm`}>
      {/* Header with status badge and expiry */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`inline-grid size-8 place-items-center rounded-md bg-white/70 ${statusStyles.icon}`}>
            <ShieldCheck size={18} />
          </div>
          <p className={`text-sm font-semibold ${statusStyles.label}`}>APK</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles.badge}`}>
          {statusStyles.text}
        </span>
      </div>
      <p className={`mt-3 text-2xl font-bold ${statusStyles.label}`}>
        {formatDutchDate(apkHistory.currentExpiry)}
      </p>
      
      {/* Inspection timeline */}
      <div className="mt-4 space-y-2">
        {displayedInspections.map((inspection, i) => (
          <div key={i} className="rounded-md border border-[var(--line)] bg-white/50 p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{formatDutchDate(inspection.date)}</p>
              <span className="text-xs text-[var(--muted)]">{inspection.facility}</span>
            </div>
            {inspection.defectCount > 0 && (
              <div className="mt-2 text-xs">
                <p className="font-medium text-amber-600">{inspection.defectCount} gebreken</p>
                <ul className="mt-1 list-inside space-y-0.5 text-[var(--muted)]">
                  {inspection.defects.map(d => (
                    <li key={d.id}>• {d.description} {d.count > 1 ? `(${d.count}×)` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Show more toggle */}
      {apkHistory.inspections.length > 5 && (
        <button 
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          {showAll ? 'Minder tonen' : `Meer tonen (+${apkHistory.inspections.length - 5})`}
        </button>
      )}
    </article>
  );
}

function RecallCard({ 
  recallStatus 
}: { 
  recallStatus: RecallStatus | undefined 
}) {
  // Similar structure to ApkTimelineCard
  // Status badge pattern from ApkCard lines 271–304
  // Details pattern from TechCard lines 334–365 (dl with rows)
}

function ModificationsCard({ 
  modifications 
}: { 
  modifications: Modifications | undefined 
}) {
  // Similar structure; empty state if modifications.modifications.length === 0
  // List pattern from FuelCard lines 382–394 (ul with li items)
}
```

**Update ResultPreview to extract and pass new data**:
```typescript
function ResultPreview({ data }: { data: VehicleLookupResponse }) {
  const plate = data.displayPlate ?? formatPlate(data.plate);
  const vehicle = data.cards.rdw_vehicle as RdwVehicle | undefined;
  const fuels = (data.cards.rdw_fuel ?? []) as RdwFuel[];
  const apkHistory = (data.cards.rdw_apk_history ?? undefined) as ApkHistory | undefined;
  const recallStatus = (data.cards.rdw_recall_status ?? undefined) as RecallStatus | undefined;
  const modifications = (data.cards.rdw_modifications ?? undefined) as Modifications | undefined;
  // ... rest of function
}
```

---

## Shared Patterns

### DataSource Interface Implementation
**Source:** `api/src/sources/types.ts` (lines 10–16) and pattern examples from `rdwVehicle.ts` (lines 43–69) and `rdwFuel.ts` (lines 17–33)

**Apply to:** All Phase 3 sources (`rdwApkHistory`, `rdwRecallStatus`, `rdwModifications`)

```typescript
// Pattern signature
export interface DataSource<T = unknown> {
  readonly id: string;                      // Unique source key (e.g., "rdw_apk_history")
  readonly name: string;                    // Display name
  readonly timeoutMs?: number;              // Per-source timeout (inherit default: 3000)
  readonly cacheTtlSeconds?: number;        // Cache TTL (inherit default: 60*60)
  fetch(plate: string): Promise<T | null>; // Main fetch function
}

// Implementation pattern
export const rdwApkHistory: DataSource<ApkHistory> = {
  id: "rdw_apk_history",
  name: "RDW APK-keuringsresultaten",
  timeoutMs: 3500,           // Match rdwVehicle timeout
  cacheTtlSeconds: 24 * 60 * 60,
  async fetch(plate) {
    // Implementation here
  }
};
```

### Zod Schema Pattern
**Source:** `api/src/sources/rdwVehicle.ts` (lines 6–32) and `rdwFuel.ts` (lines 5–13)

**Apply to:** All Phase 3 sources

**Key principles:**
1. Define schema with all RDW field names as optional (RDW data is sparse)
2. End with `.passthrough()` to preserve unknown fields (RESEARCH.md Code Examples, line 631)
3. Use `z.infer<typeof schema>` to derive TypeScript type
4. Validate each item before returning from `fetch()`

```typescript
const rdwApkHistorySchema = z
  .object({
    kenteken: z.string(),
    meld_datum_door_keuringsinstantie: z.string().optional(),
    // ... more fields ...
  })
  .passthrough();

export type RawApkInspection = z.infer<typeof rdwApkHistorySchema>;
// Then define higher-level interface (ApkHistory) for transformed/enriched data
```

### Date Parsing Pattern
**Source:** `api/src/lib/date.ts` (lines 1–8)

**Apply to:** All Phase 3 sources with date fields

```typescript
import { parseRdwDate } from "../lib/date.js";

// Usage in fetch() method
const isoDate = parseRdwDate(row.meld_datum_door_keuringsinstantie); // yyyymmdd → yyyy-mm-dd
if (!isoDate) return null; // Handle null case
```

### RDW Dataset Fetch Pattern
**Source:** `api/src/sources/rdw.ts` (lines 1–25)

**Apply to:** All Phase 3 sources

```typescript
import { fetchRdwDataset } from "./rdw.js";

// Pattern for single dataset fetch
const payload = await fetchRdwDataset<unknown[]>("m9d7-ebf2", {
  kenteken: plate,
  "$limit": "1"
});

// Pattern for parameterized query
const defects = await fetchRdwDataset<unknown[]>("a34c-vvps", {
  kenteken: plate,
  meld_datum_door_keuringsinstantie: "20260213",
  meld_tijd_door_keuringsinstantie: "1345"
});
```

**Error handling:** `fetchRdwDataset` throws on non-2xx response. Callers should not catch; let timeout/aggregator handle (api/src/functions/vehicle.ts lines 17–35).

### Registry Integration
**Source:** `api/src/sources/registry.ts` (lines 1–5) and `api/src/functions/vehicle.ts` (lines 60–82)

**Apply to:** Addition of Phase 3 sources

**No changes to aggregator required.** The `vehicle.ts` function already uses `Promise.all(sourceRegistry.map(...))` pattern (line 60). New sources automatically benefit from:
- Per-source timeout (3.5s via `Promise.race`, lines 21–26)
- Error isolation (`Promise.race` catches timeout; `runSource` wraps in try/catch, lines 17–35)
- Cache TTL (minimum of all sources, line 107)

### Card Component Pattern (Frontend)
**Source:** `frontend/src/components/LookupExperience.tsx` (multiple card functions)

**Apply to:** New Phase 3 card components (`ApkTimelineCard`, `RecallCard`, `ModificationsCard`)

**Key patterns:**

1. **Null guard in component props:**
   ```typescript
   function ApkTimelineCard({ apkHistory }: { apkHistory: ApkHistory | undefined }) {
     if (!apkHistory) return null; // Gracefully handle missing data
   }
   ```

2. **Status badge styling** (from ApkCard lines 271–304):
   ```typescript
   const statusStyles = {
     valid: { border: "border-green-200", bg: "bg-green-50", /* ... */ },
     soon: { border: "border-amber-200", bg: "bg-amber-50", /* ... */ },
     expired: { border: "border-red-200", bg: "bg-red-50", /* ... */ },
     unknown: { border: "border-[var(--line)]", bg: "bg-white", /* ... */ }
   }[status];
   ```

3. **Date formatting helper** (already exists, lines 153–158):
   ```typescript
   function formatDutchDate(iso: string | null | undefined): string {
     if (!iso) return "—";
     const d = new Date(iso);
     if (isNaN(d.getTime())) return "—";
     return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
   }
   ```

4. **Empty state pattern** (from FuelCard lines 379–380):
   ```typescript
   if (data.length === 0) {
     return <p className="text-sm text-[var(--muted)]">Geen gegevens beschikbaar</p>;
   }
   ```

5. **List rendering pattern** (from FuelCard lines 382–394):
   ```typescript
   <ul className="space-y-2">
     {items.map((item, i) => (
       <li key={item.id ?? i} className="flex items-baseline justify-between gap-3 rounded-md bg-stone-50 px-3 py-2 text-sm">
         {/* content */}
       </li>
     ))}
   </ul>
   ```

---

## Test File Patterns

### Backend Source Tests (Unit)

**Analog:** `api/src/__tests__/plate.test.ts` (lines 1–22)

**Apply to:** `api/src/__tests__/sources/rdwApkHistory.test.ts`, `rdwRecallStatus.test.ts`, `rdwModifications.test.ts`

**Structure pattern:**
```typescript
import { describe, expect, it } from "vitest";
import { rdwApkHistory } from "../../sources/rdwApkHistory.js";

describe("rdwApkHistory", () => {
  it("fetches and denormalizes inspection history", async () => {
    // Mock or integration test with real plate
    const result = await rdwApkHistory.fetch("AB12CD");
    expect(result).not.toBeNull();
    expect(result?.inspections).toHaveLength(result?.totalCount);
    expect(result?.inspections[0]?.date).toBeDefined();
  });

  it("returns null if no inspections found", async () => {
    const result = await rdwApkHistory.fetch("NONEXISTENT");
    expect(result).toBeNull();
  });

  it("sorts inspections descending by date", async () => {
    const result = await rdwApkHistory.fetch("AB12CD");
    if (result?.inspections.length ?? 0 > 1) {
      const dates = result!.inspections.map(i => new Date(i.date).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    }
  });

  it("joins defects with descriptions inline", async () => {
    const result = await rdwApkHistory.fetch("AB12CD");
    const firstInspection = result?.inspections[0];
    if (firstInspection?.defectCount ?? 0 > 0) {
      expect(firstInspection?.defects[0]?.description).toBeDefined();
      expect(firstInspection?.defects[0]?.description).not.toBeNull();
    }
  });

  it("respects 3.5 second timeout", async () => {
    const start = performance.now();
    await rdwApkHistory.fetch("AB12CD").catch(() => {}); // May fail; we're testing timeout
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(4000); // Generous margin
  });
});
```

### Frontend Component Tests (Integration)

**Analog:** `api/src/__tests__/plate.test.ts` structure, adapted for React

**Apply to:** `frontend/__tests__/components/ApkTimelineCard.test.tsx`, `RecallCard.test.tsx`, `ModificationsCard.test.tsx`

**Structure pattern:**
```typescript
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApkTimelineCard } from "../../components/LookupExperience";
import type { ApkHistory } from "../../lib/api";

describe("ApkTimelineCard", () => {
  it("returns null if apkHistory is undefined", () => {
    const { container } = render(<ApkTimelineCard apkHistory={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders status badge with correct color", () => {
    const mockData: ApkHistory = {
      plate: "AB12CD",
      currentExpiry: "2027-02-28",
      currentStatus: "valid",
      inspections: [],
      totalCount: 0
    };
    render(<ApkTimelineCard apkHistory={mockData} />);
    expect(screen.getByText("Geldig")).toBeInTheDocument();
  });

  it("shows last 5 inspections by default", () => {
    const mockData: ApkHistory = {
      plate: "AB12CD",
      currentExpiry: "2027-02-28",
      currentStatus: "valid",
      inspections: Array.from({ length: 8 }, (_, i) => ({
        date: `2026-0${i + 1}-01`,
        expiryDate: "2027-02-28",
        type: "periodieke controle",
        facility: "test",
        defectCount: 0,
        defects: []
      })),
      totalCount: 8
    };
    render(<ApkTimelineCard apkHistory={mockData} />);
    const items = screen.getAllByText(/controle/);
    expect(items).toHaveLength(5); // First render shows 5
  });

  it("reveals older inspections on 'show more' toggle", async () => {
    // ... similar setup, then userEvent.click(showMoreButton), assert length === 8
  });

  it("renders inline defects with descriptions", () => {
    const mockData: ApkHistory = {
      // ... with inspections containing defects
      inspections: [{
        date: "2026-02-13",
        expiryDate: "2027-02-28",
        type: "periodieke controle",
        facility: "test",
        defectCount: 2,
        defects: [
          { id: "123", description: "Remmen slijtageindicator", count: 1 },
          { id: "456", description: "Ruitsproeier niet werkend", count: 1 }
        ]
      }]
    };
    render(<ApkTimelineCard apkHistory={mockData} />);
    expect(screen.getByText("Remmen slijtageindicator")).toBeInTheDocument();
    expect(screen.getByText("Ruitsproeier niet werkend")).toBeInTheDocument();
  });
});
```

---

## No Analog Found

No new roles or data flows are introduced in Phase 3 that lack existing analogs:

| File | Reason | Alternative Source |
|------|--------|-------------------|
| (none) | All Phase 3 files follow established patterns | — |

All new files can be modeled directly from existing code in the repository.

---

## Metadata

**Analog search scope:** `/api/src/sources/`, `/api/src/__tests__/`, `/frontend/src/components/`, `/frontend/src/lib/`

**Files scanned:** 12 source/component/type files

**Pattern extraction date:** 2026-05-22

**Key observations:**

1. **DataSource pattern is mature and reusable.** All three Phase 3 sources (rdwApkHistory, rdwRecallStatus, rdwModifications) fit the `DataSource<T>` interface without modification.

2. **Zod + passthrough is the standard validation pattern.** No changes required; apply as-is.

3. **RDW fetch abstraction is solid.** Use `fetchRdwDataset` helper for all RDW calls; no custom HTTP logic needed.

4. **N+1 query concern for rdwApkHistory.** The three-table join (sgfe-77wx → a34c-vvps → hx2c-gt7k) must use `Promise.all()` for parallel defect description fetches. Research.md Pitfall 1 highlights this.

5. **Card component pattern is consistent.** All new frontend cards follow the IdentityCard / ApkCard / TechCard / FuelCard / RegistrationCard / EnrichmentCard structure. New cards integrate seamlessly into `ResultPreview`.

6. **Test infrastructure is in place.** Vitest + React Testing Library already configured. New tests follow the same describe/it structure as plate.test.ts.

7. **Frontend type updates are straightforward.** Add new interfaces to `frontend/src/lib/api.ts`, update `VehicleLookupResponse.cards` type, pass new props to new components in `ResultPreview`.

---

**Pattern mapping complete. Planner can now assign Phase 3 tasks with confidence in concrete code precedents.**
