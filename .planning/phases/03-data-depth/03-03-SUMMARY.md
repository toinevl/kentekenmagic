---
phase: 03-data-depth
plan: "03"
subsystem: api/sources
tags:
  - rdw
  - recall
  - modifications
  - data-source
  - tdd
dependency_graph:
  requires:
    - "03-01 (rdwApkHistory.ts — needed for registry.ts import)"
  provides:
    - "rdwRecallStatus DataSource (rdw_recall_status)"
    - "rdwModifications DataSource (rdw_modifications)"
    - "Complete 5-source registry"
  affects:
    - "api/src/functions/vehicle.ts — aggregator picks up new sources automatically"
tech_stack:
  added: []
  patterns:
    - "Zod schema + .passthrough() for all RDW response validation"
    - "Promise.all parallel detail fetching for recall join"
    - "Explicit string equality for RDW sentinel values (demontagedatum === '0')"
key_files:
  created:
    - api/src/sources/rdwRecallStatus.ts
    - api/src/sources/rdwModifications.ts
    - api/src/__tests__/sources/rdwRecallStatus.test.ts
    - api/src/__tests__/sources/rdwModifications.test.ts
    - api/src/sources/rdwApkHistory.ts
  modified:
    - api/src/sources/registry.ts
    - api/package.json
decisions:
  - "Promise.all for parallel j9yg-7rg9 detail fetches — prevents serial N+1 timing out within 3.5s source timeout"
  - "Never return null from rdwRecallStatus.fetch() or rdwModifications.fetch() — return empty structure instead (keeps frontend card rendering simple)"
  - "Explicit demontagedatum === '0' check before parseRdwDate — avoids Pitfall 4 (truthy '0' treated as removed)"
  - "moreInfoUrl omitted when '(Nog) niet bekend' or falsy — clean interface, no garbage values"
  - "rdwApkHistory.ts copied from plan 03-01 worktree to satisfy typecheck in this worktree"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-22"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 3 Plan 03: Recall Status + Modifications DataSources Summary

## One-liner

rdwRecallStatus (t49b-isb7 + j9yg-7rg9 parallel join) and rdwModifications (sghb-dzxx with explicit "0" sentinel handling) DataSources, registered in 5-source sourceRegistry.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement rdwRecallStatus DataSource | d62b5f9 | api/src/sources/rdwRecallStatus.ts, api/src/__tests__/sources/rdwRecallStatus.test.ts |
| 2 | Implement rdwModifications DataSource and update registry | (staged) | api/src/sources/rdwModifications.ts, api/src/sources/registry.ts, api/src/__tests__/sources/rdwModifications.test.ts |

## Implementations

### rdwRecallStatus.ts

- `DataSource<RecallStatus>` with `id: "rdw_recall_status"`, `timeoutMs: 3500`, `cacheTtlSeconds: 86400`
- Fetches t49b-isb7 by kenteken, then fetches j9yg-7rg9 detail for each recall in **parallel** via `Promise.all`
- `hasOpenRecall: true` only when `code_status === "O"` — implements assumption A1
- Always returns RecallStatus (never null) — empty recalls array when no data
- `moreInfoUrl` omitted when value is `"(Nog) niet bekend"` or falsy
- Fallback `"—"` for all missing detail fields (defectDescription, riskLevel, repairDescription)
- Zod schemas `recallStatusRowSchema` and `recallDetailRowSchema` with `.passthrough()`

### rdwModifications.ts

- `DataSource<Modifications>` with `id: "rdw_modifications"`, `timeoutMs: 3500`, `cacheTtlSeconds: 86400`
- Fetches sghb-dzxx by kenteken, maps each row to `Modification` interface
- **Critical:** `isActive = row.demontagedatum === "0"` (explicit string equality, not truthy check)
- `removalDate = isActive ? null : parseRdwDate(row.demontagedatum)` — "0" never goes to parseRdwDate
- `manufacturer` omitted when `merk_object_toegevoegd` is `"GEEN"` or empty
- `tankCapacity` omitted when `gasinstallatie_tank_inhoud` is absent or empty
- Always returns Modifications (never null) — empty array when no data
- Zod schema `rdwModificationSchema` with `.passthrough()`

### registry.ts

Updated from 2-source to 5-source registry:
```typescript
export const sourceRegistry: DataSource[] = [rdwVehicle, rdwFuel, rdwApkHistory, rdwRecallStatus, rdwModifications];
```

## Test Results

```
Test Files  3 passed (3)
     Tests  31 passed (31)
```

- `plate.test.ts`: 4 tests (pre-existing, all pass)
- `rdwRecallStatus.test.ts`: 12 tests (all GREEN)
- `rdwModifications.test.ts`: 15 tests (all GREEN)

Typecheck: `tsc --noEmit` exits 0.

## Deviations from Plan

### Auto-added: test:unit script in package.json

The plan referenced `npm run test:unit` but no such script existed. Added to package.json.

**Files modified:** `api/package.json`
**Commit:** included in test(03-03) RED commit

### Cross-worktree dependency: rdwApkHistory.ts

`registry.ts` imports `rdwApkHistory` (created in plan 03-01 by a parallel agent). Since this worktree didn't have that file, `npm run typecheck` would fail. Copied rdwApkHistory.ts from worktree `agent-a9e677c4d84bf6661` to satisfy the compile-time dependency.

This file belongs canonically to plan 03-01's commit. During the orchestrator's merge step, the file will be present from 03-01's branch. This copy ensures typecheck passes in this isolated worktree.

## Known Stubs

None — all interfaces fully implemented with real RDW data fetching logic.

## Threat Flags

No new security surface beyond what is in the plan's threat model. All mitigations implemented:
- T-03-03-02: `recallStatusRowSchema.parse()` applied
- T-03-03-03: `recallDetailRowSchema.parse()` applied  
- T-03-03-04: `rdwModificationSchema.parse()` applied; explicit "0" check
- T-03-03-05: `moreInfoUrl` passed through as string; frontend rendering is React (no dangerouslySetInnerHTML)
- T-03-03-06: Entire fetch() wrapped by aggregator's 3.5s Promise.race

## Self-Check

- [x] `api/src/sources/rdwRecallStatus.ts` exists
- [x] `api/src/sources/rdwModifications.ts` exists
- [x] `api/src/sources/registry.ts` updated with 5 sources
- [x] `api/src/__tests__/sources/rdwRecallStatus.test.ts` exists
- [x] `api/src/__tests__/sources/rdwModifications.test.ts` exists
- [x] Task 1 commit `d62b5f9` confirmed in git log
- [x] All 31 tests GREEN
- [x] typecheck exits 0
- [x] `demontagedatum === "0"` explicit check present
- [x] `Promise.all` parallel fetch present in rdwRecallStatus

## Self-Check: PASSED
