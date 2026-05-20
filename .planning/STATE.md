# STATE.md — KentekenMagic

## Project Reference

**What This Is:** Dutch license plate lookup web app — type a plate, get instant vehicle details from RDW open data, with async LLM enrichment and progressive enhancement. Consumer-grade UX, free Azure backend, zero paid data.

**Core Value:** Government-grade data, consumer-grade experience.

## Current Position

- **Phase:** 1 of 4 — Core Lookup MVP (in progress)
- **Status:** Phase 0 complete; Phase 1 core lookup implementation underway

## Progress

```
Phase 0 ████████████████████ 100% ✓
Phase 1 ██████░░░░░░░░░░░░░░  ~30%
Phase 2 ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3 ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4 ░░░░░░░░░░░░░░░░░░░░   0%
```

## What Exists

**API (`api/src/`):** tableCache, enrich/vehicle functions, date/plate lib, rdw/rdwFuel/rdwVehicle sources, registry, types, plate tests. Compiled to `api/dist/`.

**Frontend (`frontend/`):** Next.js static export built to `frontend/out/`. Source under `frontend/src/`. Includes `staticwebapp.config.json`.

**Root:** npm workspace `package.json`, `README.md`.

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
- Phase 0 scaffolding completed and verified (typecheck, test, lint, build all pass)
- Phase 1 started: backend RDW sources exist, frontend needs real card mapping

## Pending Todos

(none tracked)

## Blockers/Concerns

(none)

## Session Continuity

Last session: 2026-05-20
Stopped at: Phase 0 scaffold complete; Phase 1 not yet started
Resume file: none
