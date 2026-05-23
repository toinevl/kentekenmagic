---
phase: 04-azure-release
plan: "02"
subsystem: infra
tags: [github-actions, azure-static-web-apps, ci-cd, yaml, deployment]

# Dependency graph
requires:
  - phase: 04-azure-release
    provides: Azure SWA resource provisioned; AZURE_STATIC_WEB_APPS_API_TOKEN available in GitHub Secrets
provides:
  - GitHub Actions PR validation workflow (validate.yml)
  - GitHub Actions push-to-main deploy workflow (deploy.yml)
affects: [04-azure-release, future-phases-using-ci]

# Tech tracking
tech-stack:
  added: [GitHub Actions, Azure/static-web-apps-deploy@v1, actions/checkout@v4, actions/setup-node@v4]
  patterns: [PR gate workflow separate from deploy workflow, API pre-compile before SWA action, mock storage string for PR builds]

key-files:
  created:
    - .github/workflows/validate.yml
    - .github/workflows/deploy.yml
  modified: []

key-decisions:
  - "validate.yml uses UseDevelopmentStorage=true mock string so PR builds do not require real Azure credentials"
  - "deploy.yml has no typecheck/lint steps per D-02 — fast deploy path, validation is validate.yml's responsibility"
  - "AZURE_STORAGE_CONNECTION_STRING omitted from deploy.yml per D-05 — it is an Azure application setting, not a build-time variable"
  - "No permissions block in deploy.yml per D-04 — token auth via AZURE_STATIC_WEB_APPS_API_TOKEN, not OIDC"
  - "API TypeScript pre-compiled before SWA action (npm run build --workspace api) so api/dist/ is ready"

patterns-established:
  - "Separation of concerns: validate.yml handles quality gates, deploy.yml handles deployment only"
  - "Secret references via ${{ secrets.* }} — no hardcoded credentials anywhere in workflow files"

requirements-completed: [DEPLOY-CI]

# Metrics
duration: 1min
completed: "2026-05-23"
---

# Phase 04 Plan 02: GitHub Actions Workflows Summary

**Two GitHub Actions workflows: validate.yml (PR lint/typecheck/build gate with mock storage) and deploy.yml (push-to-main SWA deployment with pre-compiled API and token auth)**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-23T15:15:22Z
- **Completed:** 2026-05-23T15:16:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PR validation workflow with lint, typecheck, and build steps — uses UseDevelopmentStorage=true so no real secrets needed for PR checks
- Deployment workflow pre-compiles API TypeScript, then uses Azure/static-web-apps-deploy@v1 with correct app/api/output locations
- No secrets hardcoded in either file — AZURE_STATIC_WEB_APPS_API_TOKEN only referenced via GitHub Secrets syntax

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .github/workflows/validate.yml** - `5eca17e` (feat)
2. **Task 2: Create .github/workflows/deploy.yml** - `f69ec93` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `.github/workflows/validate.yml` - PR quality gate: Node 22, npm ci, lint, typecheck, build with mock storage string
- `.github/workflows/deploy.yml` - Azure SWA deployment: Node 22, npm ci, API pre-compile, SWA action with token secret reference

## Decisions Made
- Followed plan decisions D-02, D-04, D-05 exactly as specified:
  - D-02: No typecheck/lint in deploy.yml (fast path)
  - D-04: No permissions block (token auth, not OIDC)
  - D-05: app_location "frontend", api_location "api", output_location "out"
- AZURE_STORAGE_CONNECTION_STRING excluded from deploy.yml — confirmed as Azure application setting, not build-time variable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Threat Surface Scan

T-04-04 (Information Disclosure) mitigated: `AZURE_STATIC_WEB_APPS_API_TOKEN` only appears as `${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}` — no literal token value in any workflow file.

T-04-06 (Information Disclosure) mitigated: `AZURE_STORAGE_CONNECTION_STRING` in validate.yml is set to `UseDevelopmentStorage=true` (non-secret mock value, not a real connection string).

## Known Stubs

None — workflow files contain no placeholder values or TODOs.

## User Setup Required

Before deploy.yml can successfully run, add the Azure deployment token to GitHub Secrets:
1. Retrieve token: `az staticwebapp secrets list --name <app-name> --resource-group <rg-name> --query "properties.apiKey"`
2. Add to GitHub repository secrets as: `AZURE_STATIC_WEB_APPS_API_TOKEN`

(This is Azure infrastructure configuration, not code — handled as part of Plan 04-01 Azure provisioning.)

## Next Phase Readiness

- PR validation is active on merge to main branches once workflows are pushed
- Deployment automation is ready pending AZURE_STATIC_WEB_APPS_API_TOKEN secret being added to GitHub repository settings
- No blockers for downstream plans in Phase 04

---
*Phase: 04-azure-release*
*Completed: 2026-05-23*
