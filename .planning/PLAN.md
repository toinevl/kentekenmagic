# Implementation Plan

## Phase 0: Scaffold and Guardrails

**Goal:** Create the app skeleton and lock in decisions that are painful to change later.

### Work

- Scaffold `frontend/` as Next.js static export with React, TypeScript, Tailwind CSS, Motion, TanStack Query, and Inter Variable.
- Scaffold `api/` as Azure Functions v4, Node 20, TypeScript, with esbuild bundling.
- Add shared formatting and normalization utilities for Dutch plates, Dutch dates, Dutch numbers, and RDW `yyyymmdd` parsing.
- Add `staticwebapp.config.json` with deep-link fallback.
- Add local environment templates for RDW Socrata app token, Azure Storage connection, and LLM provider keys.
- Add CI-friendly scripts for typecheck, lint, test, build, and Azure-compatible output.

### Exit Criteria

- `npm run build` succeeds for frontend and API.
- Static export output is produced.
- Azure Functions TypeScript compiles to bundled output.
- Plate normalization and date formatting tests pass.

## Phase 1: Core Lookup MVP

**Goal:** A user can enter a plate and see official RDW-derived vehicle data.

### Backend

- Implement `GET /api/vehicle/{plate}` aggregator with per-source timeout and `Promise.allSettled`.
- Implement source modules:
  - `rdwVehicle` from `m9d7-ebf2`
  - `rdwFuel` from `8ys7-d773`
- Implement `DataSource` interface, static source registry, source timing metadata, and partial error payloads.
- Implement Azure Table cache abstraction using `PartitionKey = plate.slice(0, 2)` and `RowKey = plate`.
- Validate external responses with Zod and map RDW raw fields into stable internal types.

### Frontend

- Build the first-screen lookup experience with authentic Dutch plate styling.
- Render cards for overview, status, technical specs, fuel/environment, and ownership/import context.
- Add loading skeletons with reserved dimensions to prevent layout shift.
- Add invalid plate, not found, and partial source failure states.
- Use Motion for card reveal, expansion, input submit feedback, and reduced-motion compatibility.

### Exit Criteria

- Warm valid lookups return and render in under 2 seconds on local dev with cache.
- Invalid and missing plates produce friendly UI and non-500 API responses.
- Core UI is responsive on mobile and desktop.
- No card assumes optional RDW fields exist.

## Phase 2: Async Enrichment

**Goal:** Add useful AI-generated interpretation without affecting core lookup reliability.

### Work

- Implement `POST /api/enrich/{plate}` as a separate Function.
- Read vehicle data from cache; return 404/empty enrichment if core lookup has not populated cache.
- Add LLM provider abstraction with structured output for summary and `insights[]`.
- Cache enrichment results in `LlmSummaryCache` with a 7-day TTL and data hash.
- Add frontend summary/insights card that loads after core cards render.
- Add hard prompt constraints: summarize only provided facts, no invented specs, no owner identity.

### Exit Criteria

- Core lookup works when LLM keys are absent.
- Enrichment cache hit does not call the LLM provider.
- LLM output is structured, bounded, and clearly marked as generated from RDW data.

## Phase 3: Data Depth

**Goal:** Add differentiating official-data views after the base app is stable.

### Work

- Add recall detail card using `t49b-isb7` status and `j9yg-7rg9` details.
- Add APK timeline using `sgfe-77wx`, defects from `a34c-vvps`, and defect descriptions from `hx2c-gt7k`.
- Add modifications card using `sghb-dzxx`.
- Expand verification plate set to cover recall, defect, and modification examples.

### Exit Criteria

- Detailed cards fail independently and do not block overview rendering.
- APK timeline shows inspections in correct chronological order with defect summaries when available.
- Recall detail clearly distinguishes open, repaired, and unknown statuses.

## Phase 4: Azure Release

**Goal:** Deploy a low-cost, observable v1 on Azure.

### Work

- Provision Azure Static Web Apps with managed Functions API.
- Provision Azure Storage tables: `VehicleCache` and `LlmSummaryCache`.
- Configure application settings for Socrata token, storage, and optional LLM provider.
- Add GitHub Actions deployment workflow.
- Add basic Application Insights logging and source latency metrics if available within cost constraints.
- Run final manual smoke test against the production URL.

### Exit Criteria

- Direct links and refreshes work in production.
- Cache read/write works against Azure Tables.
- Cold start and warm lookup timings are documented.
- Production has no checked-in secrets and no paid data dependencies.

## Explicit Deferrals

- Market value and pricing.
- User accounts, saved searches, and lookup history.
- Owner identity or owner history.
- Fleet/bulk lookup.
- CO2 g/km and deep TGK joins until after the MVP.
- EU Safety Gate integration unless a stable machine-readable API appears.

