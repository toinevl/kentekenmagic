---
phase: 03-data-depth
plan: "01"
subsystem: test-infrastructure
tags: [tdd, vitest, testing, red-phase, jsdom, react-testing-library]
dependency_graph:
  requires: []
  provides:
    - api/src/__tests__/sources/rdwApkHistory.test.ts
    - api/src/__tests__/sources/rdwRecallStatus.test.ts
    - api/src/__tests__/sources/rdwModifications.test.ts
    - frontend/__tests__/components/ApkTimelineCard.test.tsx
    - frontend/__tests__/components/RecallCard.test.tsx
    - frontend/__tests__/components/ModificationsCard.test.tsx
    - frontend/vitest.config.ts
    - frontend/vitest.setup.ts
  affects:
    - api/package.json
    - frontend/package.json
tech_stack:
  added:
    - vitest (frontend)
    - "@testing-library/react"
    - "@testing-library/jest-dom"
    - "@testing-library/user-event"
    - "@vitejs/plugin-react"
    - jsdom
    - "@vitest/coverage-v8"
  patterns:
    - TDD RED phase — stub tests fail until implementation exists
    - Vitest with jsdom environment for React component tests
    - Named ESM imports with .js extension in API source tests
key_files:
  created:
    - frontend/vitest.config.ts
    - frontend/vitest.setup.ts
    - api/src/__tests__/sources/rdwApkHistory.test.ts
    - api/src/__tests__/sources/rdwRecallStatus.test.ts
    - api/src/__tests__/sources/rdwModifications.test.ts
    - frontend/__tests__/components/ApkTimelineCard.test.tsx
    - frontend/__tests__/components/RecallCard.test.tsx
    - frontend/__tests__/components/ModificationsCard.test.tsx
  modified:
    - api/package.json
    - frontend/package.json
    - package-lock.json
decisions:
  - "@vitejs/plugin-react added to frontend devDependencies (not in original plan) — required for Vitest to process JSX/TSX files in the jsdom environment; React 19 + Next.js 15 project uses 'jsx: preserve' in tsconfig which needs Vite's React plugin for test transforms"
metrics:
  duration: "3m 49s"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 3
---

# Phase 3 Plan 01: Test Infrastructure (RED Phase) Summary

Vitest + jsdom test infrastructure added to frontend; `test:unit` script scoped to sources directory added to API; six test stubs created covering all Phase 3 data sources and card components — all stubs fail in RED state awaiting implementation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add test:unit script to api and install frontend test dependencies | 721a8d3 | api/package.json, frontend/package.json, frontend/vitest.config.ts, frontend/vitest.setup.ts, package-lock.json |
| 2 | Create all six test stub files (RED phase) | 6497298 | api/src/__tests__/sources/*.test.ts (3), frontend/__tests__/components/*.test.tsx (3) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Dependency] Added @vitejs/plugin-react to frontend devDependencies**
- **Found during:** Task 1
- **Issue:** `vitest.config.ts` uses React plugin to handle JSX/TSX transformation in test environment. The plan's devDependencies list omitted `@vitejs/plugin-react`, but without it Vitest cannot parse `.tsx` files.
- **Fix:** Added `"@vitejs/plugin-react": "^4.0.0"` to frontend devDependencies and ran `npm install`.
- **Files modified:** frontend/package.json, package-lock.json
- **Commit:** 721a8d3

## Verification Results

### API test runner (RED confirmed)
- `npm run test:unit` in api/ finds 3 test files, all FAIL
- Failure cause: Cannot resolve `../../sources/rdwApkHistory.js`, `rdwRecallStatus.js`, `rdwModifications.js`

### Frontend test runner (RED confirmed)
- `npm test` in frontend/ finds 3 test files, 10 tests total, all FAIL
- Failure cause: Cannot resolve named exports `ApkTimelineCard`, `RecallCard`, `ModificationsCard` from `LookupExperience`; types `ApkHistory`, `RecallStatus`, `Modifications` not yet in `api.ts`

### File existence verified
```
api/src/__tests__/sources/
  rdwApkHistory.test.ts
  rdwModifications.test.ts
  rdwRecallStatus.test.ts

frontend/__tests__/components/
  ApkTimelineCard.test.tsx
  ModificationsCard.test.tsx
  RecallCard.test.tsx
```

## Known Stubs

None — all test stubs have complete test bodies with assertions. Test data objects conform to the interfaces documented in 03-RESEARCH.md. Tests fail at import time (RED) due to missing implementation modules, not due to incomplete test logic.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Only test infrastructure and devDependency additions.

## Self-Check: PASSED

- [x] api/src/__tests__/sources/rdwApkHistory.test.ts exists
- [x] api/src/__tests__/sources/rdwRecallStatus.test.ts exists
- [x] api/src/__tests__/sources/rdwModifications.test.ts exists
- [x] frontend/__tests__/components/ApkTimelineCard.test.tsx exists
- [x] frontend/__tests__/components/RecallCard.test.tsx exists
- [x] frontend/__tests__/components/ModificationsCard.test.tsx exists
- [x] frontend/vitest.config.ts exists and contains "jsdom"
- [x] frontend/vitest.setup.ts exists and imports @testing-library/jest-dom
- [x] api/package.json has "test:unit" script
- [x] frontend/package.json has "test" script + testing devDependencies
- [x] Task 1 commit 721a8d3 exists
- [x] Task 2 commit 6497298 exists
- [x] All 6 test files fail (RED) — zero GREEN tests
