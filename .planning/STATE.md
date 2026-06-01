---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "04-03 complete: API on Flex Consumption; SWA static-only deploy GREEN; production smoke test PASS"
last_updated: "2026-06-01"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 8
  completed_plans: 7
  percent: 87
---

# STATE.md — KentekenMagic

## Project Reference

**What This Is:** Dutch license plate lookup web app — type a plate, get instant vehicle details from RDW open data, with async LLM enrichment and progressive enhancement. Consumer-grade UX, free Azure backend, zero paid data.

**Core Value:** Government-grade data, consumer-grade experience.

## Current Position

Phase: 04 (azure-release) — deploy GREEN, smoke test PASS
Plan: 3 of 3 complete
Next: phase verification / milestone completion

- **Status:** Production deploy live — SWA frontend + standalone Flex Consumption API

## Progress

```
Phase 0 ████████████████████ 100% ✓
Phase 1 ████████████████████ 100% ✓
Phase 2 ████████████████████ 100% ✓
Phase 3 ████████████████████ 100% ✓
Phase 4 ███████████████████░  95%  (deploy GREEN + smoke PASS; phase verify pending)
```

## What Exists

**API (`api/src/`):** tableCache, enrich/vehicle functions, date/plate lib, rdw/rdwFuel/rdwVehicle/rdwApkHistory/rdwRecallStatus/rdwModifications sources, registry, types, plate tests. Compiled to `api/dist/`. 5 sources in registry.

**Frontend (`frontend/`):** Next.js static export. LookupExperience with 8 cards: IdentityCard, ApkTimelineCard, RecallCard, TechCard, FuelCard, ModificationsCard, RegistrationCard, EnrichmentCard. 64 tests passing (API + frontend).

**Root:** npm workspace `package.json`, `README.md`.

**CI/CD (`.github/workflows/`):** validate.yml (PR lint/typecheck/build gate), deploy.yml (push-to-main **static-only** Azure SWA deploy; injects `NEXT_PUBLIC_API_BASE_URL`), deploy-api.yml (Flex Consumption API deploy via azure/login + remote build; skips until `AZURE_CREDENTIALS` secret is set).

**Production (live):** SWA frontend `purple-bush-04afb5403.7.azurestaticapps.net` (Free) + standalone Flex Consumption Function App `kentekenmagic-api` (`*.azurewebsites.net`, node 22) called directly via CORS. RG `kentekenmagic-rg`, West Europe. `ANTHROPIC_API_KEY` set; enrichment verified.

## Key Decisions (from PROJECT.md)

- Azure Static Web Apps + Functions (free tier)
- Azure Tables for plate lookup caching (2-char prefix partitioning)
- No user accounts in v1
- Module-style data source architecture
- Single aggregator Function (fans out to source modules)
- Progressive data loading (core RDW first, enrichment later)
- Low-cost LLM enrichment (async, cached, gpt-4o-mini class)
- Free data sources only

## Recent Decisions

- Next.js (not SvelteKit) — final stack decision made during Phase 0
- Phase 1: RDW vehicle+fuel lookup with 5 typed result cards, Azure Table cache
- Phase 2: Async Claude AI enrichment (separate enrich endpoint, 7-day LLM cache, structured tool output with prompt caching)
- Monorepo with root-level func binary; dev proxy via next.config.ts
- Plate validator rejects all-letter or all-digit strings
- Phase 3: APK timeline (replacing flat ApkCard), recall status, vehicle modifications — 3 new RDW dataset joins
- Phase 4 Plan 02: validate.yml uses UseDevelopmentStorage=true mock so PR builds need no real Azure secrets; deploy.yml has no lint/typecheck (fast path per D-02); no permissions block (token auth not OIDC per D-04)
- Phase 4 Plan 03: **SWA managed functions abandoned** — unprovisionable on this account (opaque `Failed to deploy the Azure Functions`, trivial app fails identically, all config correct). API moved to a **standalone Flex Consumption** Function App; SWA frontend stays Free + static-only and calls the API directly via CORS (`NEXT_PUBLIC_API_BASE_URL`). node:24 is not a valid SWA apiRuntime (cap node:22). enrich.ts now only caches AI-generated summaries (fallback no longer poisons the cache).

## Pending Todos

(none tracked)

## Blockers/Concerns

(none)

## Session Continuity

Last session: 2026-06-01
Stopped at: Phase 04 deploy GREEN + production smoke test PASS. API on standalone Flex Consumption; SWA static-only; enrichment verified. Remaining: optional API CI secret (AZURE_CREDENTIALS), phase verification/milestone completion.
Learnings extracted: 04-LEARNINGS.md (9 decisions, 7 lessons, 5 patterns, 5 surprises)
Resume file: None
