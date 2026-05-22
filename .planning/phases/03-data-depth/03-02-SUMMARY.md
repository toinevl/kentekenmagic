---
phase: 03-data-depth
plan: "02"
subsystem: api/sources
tags: [rdw, apk-history, datasource, 3-dataset-join, parallel-fetch, zod, tdd]
dependency_graph:
  requires:
    - api/src/sources/rdw.ts
    - api/src/sources/types.ts
    - api/src/lib/date.ts
  provides:
    - api/src/sources/rdwApkHistory.ts (rdwApkHistory DataSource, ApkHistory, ApkInspection)
  affects:
    - api/src/sources/registry.ts (not modified this plan — registration is a later plan concern)
tech_stack:
  added: []
  patterns:
    - 3-dataset server-side join with Promise.all (nested parallel fetches)
    - Zod schema with passthrough() for all three RDW datasets
    - apkStatus helper deriving valid/soon/expired/unknown from ISO expiry date
    - formatTime helper converting HHMM to HH:MM for ISO datetime construction
key_files:
  created:
    - api/src/sources/rdwApkHistory.ts
    - api/src/__tests__/sources/rdwApkHistory.test.ts
  modified:
    - api/package.json (added test:unit script alias)
decisions:
  - "3-dataset join implemented server-side in a single DataSource fetch() call; frontend receives fully denormalized ApkHistory payload"
  - "Two nested Promise.all calls ensure inspections and description lookups are fully parallel (no serial N+1 loops)"
  - "apkStatus derives 'soon' threshold as ≤30 days from now; 'valid' is >30 days; matches existing ApkCard color logic"
  - "formatTime normalizes HHMM strings to HH:MM; returns 00:00 for missing/malformed input"
  - "test:unit script added as alias for vitest run (plan's verify command required it)"
metrics:
  duration: "2m 7s"
  completed_date: "2026-05-22"
  tasks_completed: 1
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 02: rdwApkHistory DataSource Summary

**One-liner:** `rdwApkHistory` DataSource implemented with 3-dataset server-side join (sgfe-77wx + a34c-vvps + hx2c-gt7k) using nested Promise.all for fully parallel APK inspection + defect + description fetching.

## What Was Built

`api/src/sources/rdwApkHistory.ts` — a `DataSource<ApkHistory>` implementation that:

1. Fetches all APK inspection rows for a plate from `sgfe-77wx`
2. For each inspection, fetches defect rows from `a34c-vvps` (matched by compound key: kenteken + meld_datum + meld_tijd)
3. For each defect, fetches its human-readable description from `hx2c-gt7k`
4. Steps 2 and 3 use nested `Promise.all` calls — never serial await loops
5. Sorts inspections descending by ISO datetime (newest first)
6. Derives `currentExpiry` from `inspections[0].expiryDate` after sort
7. Returns `currentStatus` as `"valid" | "soon" | "expired" | "unknown"` via `apkStatus()` helper

### Exported API

```typescript
export interface ApkInspection { date, expiryDate, type, facility, defectCount, defects[] }
export interface ApkHistory { plate, currentExpiry, currentStatus, inspections[], totalCount }
export const rdwApkHistory: DataSource<ApkHistory>  // id: "rdw_apk_history"
```

### Source Configuration

- `id`: `"rdw_apk_history"`
- `timeoutMs`: `3500`
- `cacheTtlSeconds`: `86400` (24 hours)

## TDD Execution

**RED commit:** `62c374c` — 23 failing tests covering all behavior requirements  
**GREEN commit:** `7189e68` — implementation making all 23 tests pass

## Verification Results

```
Tests:  27 passed (27)  — 23 new rdwApkHistory + 4 existing plate tests
TypeScript: typecheck exits 0
Promise.all count: 2 (inspection-level + description-level)
gebrek_paragraaf_nummer: 0 occurrences (D-04 compliant)
Serial for-of loops: 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Added missing `test:unit` script to api/package.json**
- **Found during:** Pre-task verification setup
- **Issue:** Plan's `<verify>` command calls `npm run test:unit` but api/package.json only had `test`. The script would fail with "missing script: test:unit".
- **Fix:** Added `"test:unit": "vitest run"` as alias in package.json scripts.
- **Files modified:** api/package.json
- **Commit:** `62c374c` (included in RED commit)

## Known Stubs

None — the source returns fully hydrated data from RDW APIs. No placeholder values.

## Threat Flags

No new network endpoints or trust boundaries introduced. The three RDW datasets (sgfe-77wx, a34c-vvps, hx2c-gt7k) are covered in the plan's `<threat_model>`. All Zod validations in place per T-03-02-02 and T-03-02-03 mitigations.

## Self-Check: PASSED

- [x] `api/src/sources/rdwApkHistory.ts` exists
- [x] `api/src/__tests__/sources/rdwApkHistory.test.ts` exists
- [x] RED commit `62c374c` exists in git log
- [x] GREEN commit `7189e68` exists in git log
- [x] `rdwApkHistory.id === "rdw_apk_history"`
- [x] `rdwApkHistory.timeoutMs === 3500`
- [x] `rdwApkHistory.cacheTtlSeconds === 86400`
- [x] `Promise.all` count >= 2
- [x] `gebrek_paragraaf_nummer` count === 0
- [x] All 27 tests pass
- [x] TypeScript typecheck exits 0
