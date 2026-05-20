# Phase 3: Data Depth - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add differentiating official-data views after the base app is stable. Three new card types, all loaded in parallel with the core lookup and failing independently: APK inspection history (replacing the current ApkCard), recall details, and vehicle modifications. No new endpoints — sources are added to the existing `sourceRegistry`.

</domain>

<decisions>
## Implementation Decisions

### APK Timeline Card
- **D-01:** The Phase 3 APK timeline **replaces** the existing `ApkCard`. The new card owns all APK information: expiry date + status badge (currently in ApkCard) + full inspection history from `sgfe-77wx`.
- **D-02:** Show the **last 5 inspections** by default. Include a "show more" toggle to reveal older ones.
- **D-03:** Defects (`a34c-vvps` + `hx2c-gt7k`) are shown **inline per inspection** — each inspection row shows defect count and descriptions. No separate defect section.
- **D-04:** Defect detail level: **defect count + omschrijving (description) only**. No RDW defect codes, no severity classification. Keep it readable for non-experts.

### Loading Strategy
- **D-05:** All Phase 3 sources load **in parallel with the core lookup** via the existing `sourceRegistry` + `Promise.allSettled` pattern. No new endpoints or lazy queries needed.
- **D-06:** Per-source timeout: **3.5 seconds** (same as `rdwVehicle`). Individual timeouts mean Phase 3 sources can fail without blocking core card rendering.
- **D-07:** Cache TTL: **24 hours** (same as `rdwVehicle`). APK history and recall status are stable at that granularity.

### Recall Card & Modifications Card
No discussion needed — the user delegated these to the planner. Key constraints:
- `openstaande_terugroepactie_indicator` is already a badge in the (to-be-replaced) ApkCard; the new recall detail card should use `t49b-isb7` + `j9yg-7rg9` and stand on its own.
- Modifications card from `sghb-dzxx` — planner decides placement and empty state handling.

### Claude's Discretion
- Recall card placement (separate card vs integrated) — planner decides.
- Modifications card scope and empty state (always shown or only when modifications exist) — planner decides.
- Frontend card ordering for new Phase 3 cards — planner decides based on information hierarchy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Implementation
- `api/src/sources/types.ts` — `DataSource<T>` interface. All new sources must implement this.
- `api/src/sources/registry.ts` — `sourceRegistry` array. New sources go here.
- `api/src/functions/vehicle.ts` — Aggregator pattern: `Promise.allSettled` + per-source timeout. New sources inherit this automatically.
- `api/src/sources/rdwVehicle.ts` — Reference implementation: Zod schema, RDW dataset fetch pattern, field mapping, `passthrough()` for unknown fields.
- `api/src/cache/tableCache.ts` — Cache abstraction used by vehicle function.
- `frontend/src/components/LookupExperience.tsx` — All card components live here. `ResultPreview` renders them in order. New cards add here.
- `frontend/src/lib/api.ts` — API contract: `VehicleLookupResponse`, `cards` as `Record<string, unknown>`. New source data appears as `data.cards.{source_id}`.

### RDW Datasets for Phase 3
- Recall status: `t49b-isb7` (terugroepacties status per kenteken)
- Recall details: `j9yg-7rg9` (terugroepactie details)
- APK inspections: `sgfe-77wx` (keuringsresultaten per kenteken)
- APK defects: `a34c-vvps` (geconstateerde gebreken per keuring)
- APK defect descriptions: `hx2c-gt7k` (gebreksoorten omschrijvingen)
- Modifications: `sghb-dzxx` (wijzigingen per kenteken)

### Phase Plan
- `.planning/PLAN.md` §Phase 3 — Exit criteria and scope definition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchRdwDataset` (in `api/src/sources/rdw.ts`) — generic RDW Socrata fetch with query params. All new sources use this.
- `parseRdwDate` (in `api/src/lib/date.ts`) — converts RDW `yyyymmdd` strings to ISO. APK inspection dates will need this.
- `formatDutchDate` in `LookupExperience.tsx` — Dutch date formatting for display. Already extracted as a helper.
- Existing card skeleton pattern in `LoadingCards` — can extend for new cards.
- `statusStyles` pattern in `ApkCard` — color-coded status variants. Reusable pattern for recall status (open/repaired/unknown).

### Established Patterns
- **Zod schema + passthrough()**: All RDW sources use `z.object({...}).passthrough()` so unknown fields are preserved. Follow this for all Phase 3 sources.
- **Dates object**: `rdwVehicle` maps raw `yyyymmdd` fields to a `dates: {}` sub-object. Consistent pattern for Phase 3 sources with date fields.
- **Cards keyed by source id**: `data.cards.rdw_vehicle`, `data.cards.rdw_fuel`. New sources follow the same key convention: `data.cards.rdw_apk_history`, `data.cards.rdw_recall`, `data.cards.rdw_modifications`.
- **Null guard everywhere**: Frontend cards receive `vehicle: RdwVehicle | undefined` — all optional fields guarded. Same pattern for Phase 3 card props.

### Integration Points
- `sourceRegistry` in `api/src/sources/registry.ts` — add new sources here, vehicle.ts picks them up automatically.
- `ResultPreview` in `LookupExperience.tsx` — add new card components after `RegistrationCard`, before `EnrichmentCard`.
- `VehicleLookupResponse.cards` type in `frontend/src/lib/api.ts` — may need typed interfaces for new card data, similar to `RdwVehicle` and `RdwFuel`.

</code_context>

<specifics>
## Specific Ideas

- APK card expansion: the new card replaces `ApkCard` entirely — the expiry date and status badge from the current implementation should be preserved at the top of the expanded card, with the inspection timeline below it. Continuity of the APK status badge (green/amber/red) is important.
- Defects are contextual to their inspection — inline display (e.g., collapsed by default, expandable) is preferred over a flat list.
- Consumer-readable language throughout — no RDW codes surfaced directly to users.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Data Depth*
*Context gathered: 2026-05-20*
