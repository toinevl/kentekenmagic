---
phase: 04-azure-release
plan: "01"
subsystem: infra
tags: [azure-static-web-apps, nextjs, static-export, secrets-scrubbing, swa-routing]

# Dependency graph
requires:
  - phase: 03-data-depth
    provides: "Working Next.js frontend with static export build"
provides:
  - "frontend/public/staticwebapp.config.json with platform.apiRuntime node:20 and navigationFallback routing rules"
  - "api/local.settings.json scrubbed to template placeholders only"
affects: [04-azure-release, deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SWA routing config placed in Next.js public/ for deterministic inclusion in static export out/"

key-files:
  created:
    - "frontend/public/staticwebapp.config.json"
  modified:
    - "api/local.settings.json (gitignored — not in git)"

key-decisions:
  - "staticwebapp.config.json moved from frontend/ to frontend/public/ so Next.js static export copies it automatically to out/"
  - "platform.apiRuntime node:20 added to pin Azure Managed Functions to Node 20"
  - "api/local.settings.json secrets replaced with template placeholders; file confirmed gitignored and never committed"

patterns-established:
  - "Static config files that must survive Next.js export belong in frontend/public/"

requirements-completed: [DEPLOY-CONFIG]

# Metrics
duration: 2min
completed: "2026-05-23"
---

# Phase 04 Plan 01: Pre-Deploy Blockers Summary

**SWA routing config moved to frontend/public/ with Node 20 runtime pinning; Anthropic API key scrubbed from local.settings.json**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-23T15:15:24Z
- **Completed:** 2026-05-23T15:17:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Moved staticwebapp.config.json from frontend/ to frontend/public/ so Next.js static export deterministically includes it in frontend/out/
- Added platform.apiRuntime: node:20 to pin Azure Managed Functions to Node 20
- Scrubbed real Anthropic API key (sk-ant-...) from api/local.settings.json, replacing all secrets with template placeholders
- Verified local.settings.json is gitignored (line 9 of .gitignore) and has never been committed to git history

## Task Commits

Each task was committed atomically:

1. **Task 1: Move staticwebapp.config.json to frontend/public/ and add platform.apiRuntime** - `254e65d` (fix)
2. **Task 2: Scrub real API key from api/local.settings.json** - no git commit (file is gitignored; scrub was on-disk only)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `frontend/public/staticwebapp.config.json` - SWA routing config with platform.apiRuntime, navigationFallback, and globalHeaders; auto-copied to out/ by Next.js export
- `api/local.settings.json` - Local dev env file scrubbed to template placeholders (gitignored, not tracked in git)

## Decisions Made
- Placed config in frontend/public/ rather than attempting to configure Next.js to copy extra files; public/ is the standard Next.js mechanism and requires no config changes
- Added platform.apiRuntime at the top-level "platform" key per Azure SWA documentation

## Deviations from Plan

None - plan executed exactly as written.

Note: Task 2 produced no git commit because api/local.settings.json is gitignored. The scrub was performed on disk. The file has never appeared in git history (confirmed by `git log --all --oneline -- '**/local.settings.json'` returning empty).

## Issues Encountered
None

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-04-01 (Information Disclosure - local.settings.json) | Mitigated: real key replaced with placeholder; file confirmed gitignored and never committed |
| T-04-02 (Tampering - out/staticwebapp.config.json) | Mitigated: source moved to frontend/public/; Next.js build verified produces frontend/out/staticwebapp.config.json |
| T-04-03 (EoP - /api/* routing exclusion) | Mitigated: navigationFallback.exclude contains "/api/*" (preserved verbatim from original) |

## User Setup Required
None - no external service configuration required for this plan.

## Next Phase Readiness
- SWA routing config is now in the correct location for production deployment
- Frontend build confirmed: `npm run build --workspace frontend` exits 0, frontend/out/staticwebapp.config.json present
- api/local.settings.json is safe to reference in documentation; developers copy it and fill in real values locally
- Ready for Phase 04 Plan 02 (Azure infrastructure provisioning / deploy pipeline)

---
*Phase: 04-azure-release*
*Completed: 2026-05-23*
