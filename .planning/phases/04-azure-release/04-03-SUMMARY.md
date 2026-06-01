---
phase: 04-azure-release
plan: 03
subsystem: infra
tags: [azure, static-web-apps, flex-consumption, azure-functions, cors, ci-cd, smoke-test]

requires:
  - phase: 04-azure-release (plans 01, 02)
    provides: deploy.yml workflow, DEPLOY.md runbook, provisioned Azure SWA resource
provides:
  - Green production deploy (SWA frontend + standalone Flex Consumption API)
  - Passing production smoke test (vehicle lookup, cache, AI enrichment, CORS)
  - Corrected architecture of record (SWA managed functions abandoned)
affects: [production-launch]

tech-stack:
  added:
    - "Azure Functions Flex Consumption plan (standalone API host)"
  patterns:
    - "Static-only SWA frontend calls a standalone Function App directly via CORS"

key-files:
  created: []
  modified:
    - "frontend/src/lib/api.ts — API calls prefixed with NEXT_PUBLIC_API_BASE_URL"
    - ".github/workflows/deploy.yml — static-only SWA deploy; inject API URL at build; api_location empty"
    - ".github/workflows/deploy-api.yml — Flex Consumption deploy (azure/login + remote build), gated on AZURE_CREDENTIALS"
    - "frontend/public/staticwebapp.config.json — removed platform.apiRuntime"
    - "api/src/functions/enrich.ts — only cache AI-generated summaries, not the fallback"
    - "package.json engines / CLAUDE.md — Node 22"

key-decisions:
  - "SWA managed functions are unprovisionable on this account: opaque 'Failed to deploy the Azure Functions' (error:null, 15s server-side reject) even with fully correct config (node:22, Oryx language info, all preflight items, supported region/plan). A trivial app failed identically — environmental, not code."
  - "Pivoted the API to a standalone Flex Consumption Function App (kentekenmagic-api, node 22); the SWA frontend stays Free and deploys static-only, calling the API directly via CORS (authLevel anonymous; public RDW data)."
  - "node:24 is NOT a valid SWA managed-functions apiRuntime (cap is node:22); the prior 'bump to node:24' was a dead end. Flex Consumption does support node 24, but the API runs on 22 for consistency."
  - "Flex Consumption has no publish profile — CI uses azure/login, not functions-action publish-profile."

patterns-established:
  - "Standalone Function App + static SWA + direct CORS (NEXT_PUBLIC_API_BASE_URL inlined at build)"

requirements-completed: ["green production deploy", "production smoke test"]

duration: ~3h (across sessions)
completed: 2026-06-01
---

# Phase 4: Azure Release (Plan 03) Summary

**Got the production deploy GREEN and passed the smoke test by abandoning the unprovisionable SWA managed-functions path and moving the API to a standalone Flex Consumption Function App that the static SWA frontend calls directly via CORS.**

## Performance

- **Duration:** ~3h across sessions (deep platform root-cause hunt)
- **Completed:** 2026-06-01
- **Files modified:** 6 repo files + new Azure Flex Consumption resource
- **Result:** SWA deploy GREEN; production smoke test PASS

## Root cause (the real one)

The recurring `Failed to deploy the Azure Functions` had multiple layered causes, but the final blocker was environmental: **SWA managed functions could not be provisioned on this account/subscription at all** — a ~15s server-side rejection with `error: null`, reproducing even on a trivial hello-world function app, in a supported region (West Europe) on a plan that includes managed functions (Free does). Earlier-fixed contributors along the way: `skip_api_build` removed (Oryx supplies function language info), and `node:24` corrected to `node:22` (SWA managed functions cap at 22; node:24 doesn't exist there).

## Resolution

1. **API → standalone Flex Consumption** Function App `kentekenmagic-api` (v4 TS, node 22), reusing `kentekenmagicstorage`. Deployed via `az functionapp deployment source config-zip --build-remote true`.
2. **CORS** allows the SWA origin; functions stay `authLevel: anonymous`.
3. **Frontend** calls the Function App directly (`NEXT_PUBLIC_API_BASE_URL` inlined at build in `frontend/src/lib/api.ts`).
4. **SWA deploy is now static-only** (`api_location: ""`) → goes GREEN.
5. **Bug fix:** `enrich.ts` no longer caches the non-AI fallback (was poisoning `LlmSummaryCache` on any transient key/Claude failure).

## Smoke test (production) — PASS

- Frontend root + deep-link `/kenteken/PF655T`: 200
- `GET /api/vehicle/PF655T`: 200, real RDW data (BMW), cold-start ~4s
- Cache hit on second call: `fromCache: true`
- CORS: `access-control-allow-origin` = SWA origin
- `POST /api/enrich/PF655T`: `generated: true`, 3 insights (Claude haiku-4-5, forced tool use, prompt caching)

## Open follow-ups

- `ANTHROPIC_API_KEY` is set on the Function App (enrichment verified). `RDW_APP_TOKEN` optional, not set.
- API CI (`deploy-api.yml`) is wired but **skips** until an `AZURE_CREDENTIALS` service-principal secret is added; the API currently deploys via the documented manual CLI command.
