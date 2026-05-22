# Phase 4: Azure Release - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the fully-built KentekenMagic app (Next.js static export frontend + Azure Functions v4 API + Azure Table cache) to Azure Static Web Apps. Everything is coded — this phase is the last mile: provision Azure resources, configure secrets, set up GitHub Actions CI/CD, and run a final production smoke test.

No new features. No API changes. No frontend logic changes.

</domain>

<decisions>
## Implementation Decisions

### Deployment Trigger
- **D-01:** Auto-deploy on push to `main`. Include `workflow_dispatch` for manual trigger as well (consistent with workforceplanning pattern).
- **D-02:** No CI gate before deploy — no typecheck or test job blocking deployment. Fast path: push → deploy.

### Deployment Target & Workflow
- **D-03:** Azure Static Web Apps (SWA) with managed Functions API. Not App Service — SWA handles same-domain routing between frontend and API out of the box, requiring no frontend code changes.
- **D-04:** Authenticate via SWA deployment token (`AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret). Not OIDC.
- **D-05:** Deploy using `Azure/static-web-apps-deploy@v1` action with `app_location: "frontend"`, `api_location: "api"`, `output_location: "out"`.
- **D-06:** Add a `validate.yml` workflow for PR validation (lint, typecheck, build check) — adapted from the workforceplanning repo's `validate.yml`, adjusted for KentekenMagic's monorepo paths.
- **D-07:** Azure resource provisioning is manual (Azure Portal / CLI one-time setup). Document all steps — resource names, application settings, table creation commands — in a `DEPLOY.md` at repo root. No Bicep or IaC.

### LLM Provider in Production
- **D-08:** Anthropic only. Set `ANTHROPIC_API_KEY` in Azure application settings. Leave `OPENAI_API_KEY` unset — no fallback needed.

### Claude's Discretion
- Exact Azure resource names (SWA instance, storage account, resource group)
- `DEPLOY.md` structure and detail level — cover: resource creation, required application settings, table creation commands, and first-deploy instructions
- Application Insights: `host.json` already has sampling configured — no additional custom telemetry needed beyond what Functions provides out of the box

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/PLAN.md` §Phase 4 — canonical scope, work items, and exit criteria for this phase

### Existing Workflows (external — reference only, do not copy wholesale)
- `/home/toine/projects/workforceplanning/.github/workflows/validate.yml` — template for the PR validation workflow; adapt for KentekenMagic's monorepo (run lint/typecheck from `frontend/`, build check includes both `frontend/` and `api/`)
- `/home/toine/projects/workforceplanning/.github/workflows/deploy.yml` — reference for workflow structure patterns (Node.js setup, `npm ci`, caching); the deploy step itself differs (SWA action vs. blob-zip)

### Existing Azure Config
- `staticwebapp.config.json` — SWA routing already configured with deep-link fallback; no changes needed
- `api/host.json` — Application Insights sampling already configured
- `api/local.settings.json` — local env template showing all required secrets: `AZURE_STORAGE_CONNECTION_STRING`, `RDW_APP_TOKEN`, `ANTHROPIC_API_KEY`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/src/cache/tableCache.ts` — Azure Table cache fully implemented; tables named `VehicleCache` and `LlmSummaryCache` — these are the table names to create in the Azure Storage account
- `staticwebapp.config.json` — SWA routing already handles deep-link fallback; no edits needed
- `api/host.json` — Application Insights already wired; out-of-the-box Functions telemetry is sufficient for v1

### Established Patterns
- All secrets read via `process.env` in the API — same names must be set as Azure application settings on the SWA resource
- Two-character plate-prefix `PartitionKey` already implemented in `tableCache.ts` — no storage schema decisions needed

### Integration Points
- SWA `api_location: "api"` — SWA picks up Azure Functions automatically from the `api/` directory; no separate Functions App resource needed
- Required Azure application settings (from `local.settings.json`): `AZURE_STORAGE_CONNECTION_STRING`, `FUNCTIONS_WORKER_RUNTIME` (node), `RDW_APP_TOKEN`, `ANTHROPIC_API_KEY`

</code_context>

<specifics>
## Specific Ideas

- The workforceplanning `validate.yml` is the structural model for the PR check — reuse Node.js version (`22`), `npm ci`, caching setup. Adapt: run lint and typecheck from `frontend/`, run `npm run build` for both workspaces.
- `DEPLOY.md` should be a practical runbook: create SWA resource → link GitHub repo → copy deployment token to GitHub secret → create storage account → create `VehicleCache` and `LlmSummaryCache` tables → set application settings → trigger first deploy.

</specifics>

<deferred>
## Deferred Ideas

- **Custom domain** — ship on default `*.azurestaticapps.net` for v1; custom domain (e.g. `kentekenmagic.nl`) is a post-v1 concern
- **IaC / Bicep** — manual provisioning is sufficient for a personal v1; Bicep can be added if the resource group ever needs to be rebuilt from scratch
- **App Service target** — considered during discussion; rejected because SWA routing eliminates the cross-origin browser-to-API problem without any frontend code changes

</deferred>

---

*Phase: 4-azure-release*
*Context gathered: 2026-05-22*
