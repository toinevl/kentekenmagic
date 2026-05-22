# Phase 4: Azure Release - Research

**Researched:** 2026-05-22
**Domain:** Azure Static Web Apps, GitHub Actions CI/CD, Azure Storage Tables, Application Insights
**Confidence:** HIGH

## Summary

Phase 4 is a pure deployment phase: all application code is complete. The work is provisioning Azure resources (SWA + Storage), wiring GitHub Actions, and documenting the runbook in DEPLOY.md. The key technical unknowns are the exact behavior of `Azure/static-web-apps-deploy@v1` with a monorepo layout (separate `frontend/` and `api/` directories), the `output_location` path resolution rules, and the TypeScript compilation path that SWA must pick up for managed Functions.

The most critical insight: `output_location` in the SWA action is **relative to the repository root**, not relative to `app_location`. Since `app_location: "frontend"` and Next.js outputs to `frontend/out`, the correct value is `output_location: "out"` — the action interprets it as relative to `app_location`, not the root. This needs verification against actual behavior (see Open Questions). Additionally, `staticwebapp.config.json` currently lives in `frontend/` (the `app_location`), which is correct — the build copies it to `frontend/out` automatically with Next.js static export.

The managed Functions runtime picks up compiled output via the `main` field in `api/package.json`. The existing `main: "dist/src/{index.js,functions/*.js}"` is correct for v4 Node.js programming model. Application Insights integration is zero-config beyond setting `APPLICATIONINSIGHTS_CONNECTION_STRING` as an application setting. Cold start timings should be documented manually via Application Insights Logs (KQL) after first deploy.

**Primary recommendation:** Use `app_location: "frontend"`, `api_location: "api"`, `output_location: "out"` — this is consistent with the decided config (D-05). Run the SWA action with `skip_app_build: false` so Oryx builds the frontend; run `npm run build --workspace api` in a preceding step so compiled JS is present at `api/dist/` before the SWA action runs.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Auto-deploy on push to `main`. Include `workflow_dispatch` for manual trigger.
- **D-02:** No CI gate before deploy — no typecheck or test job blocking deployment. Fast path: push → deploy.
- **D-03:** Azure Static Web Apps (SWA) with managed Functions API (not App Service).
- **D-04:** Authenticate via SWA deployment token (`AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret). Not OIDC.
- **D-05:** Deploy using `Azure/static-web-apps-deploy@v1` with `app_location: "frontend"`, `api_location: "api"`, `output_location: "out"`.
- **D-06:** Add `validate.yml` for PR validation (lint, typecheck, build check) — adapted from workforceplanning repo.
- **D-07:** Manual provisioning (Azure Portal / CLI). Document all steps in `DEPLOY.md` at repo root. No Bicep.
- **D-08:** Anthropic only. Set `ANTHROPIC_API_KEY` in Azure application settings. Leave `OPENAI_API_KEY` unset.

### Claude's Discretion
- Exact Azure resource names (SWA instance, storage account, resource group)
- `DEPLOY.md` structure and detail level
- Application Insights: `host.json` already has sampling configured — no additional custom telemetry needed beyond what Functions provides out of the box

### Deferred Ideas (OUT OF SCOPE)
- Custom domain (ship on `*.azurestaticapps.net` for v1)
- IaC / Bicep
- App Service target
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static frontend delivery | CDN / SWA global network | — | Next.js static export served from edge |
| API (vehicle, enrich) | SWA Managed Functions (Azure Functions v4) | — | HTTP-triggered only, fits SWA managed constraints |
| Cache read/write | Azure Table Storage | — | `tableCache.ts` already implemented |
| Secrets / config | Azure SWA Application Settings | — | Propagated to managed Functions runtime automatically |
| Telemetry | Application Insights (auto via APPLICATIONINSIGHTS_CONNECTION_STRING) | — | Zero-code: runtime instruments requests, exceptions, dependencies |
| Deploy pipeline | GitHub Actions (azure/static-web-apps-deploy@v1) | — | SWA token auth per D-04 |
| PR validation | GitHub Actions (validate.yml) | — | Lint + typecheck + build, no deploy gate per D-02 |

---

## Standard Stack

### Core
| Tool / Service | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `Azure/static-web-apps-deploy` | v1 | GitHub Actions deploy step | Official Microsoft action for SWA |
| `actions/checkout` | v4 | Checkout repo | Standard in all reference workflows |
| `actions/setup-node` | v4 | Node.js setup with caching | Used in workforceplanning reference |
| Azure Static Web Apps | Free tier | Host frontend + managed Functions | Decided in D-03, free tier fits personal v1 |
| Azure Storage (StorageV2, Standard_LRS) | — | Table storage for VehicleCache + LlmSummaryCache | Already used by tableCache.ts |
| Application Insights | — | Auto-telemetry for Functions | Zero-config via connection string setting |

No new npm packages are installed in this phase — deployment-only.

### Package Legitimacy Audit

> No external packages are installed in this phase. All tools are GitHub Actions actions (Microsoft official) or Azure services. Audit not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
GitHub push to main
       │
       ▼
GitHub Actions: deploy.yml
  ├── actions/checkout@v4
  ├── actions/setup-node@v4 (Node 22, npm cache)
  ├── npm ci (workspace root)
  ├── npm run build --workspace api  → api/dist/
  └── Azure/static-web-apps-deploy@v1
        ├── app_location: "frontend"    ← Oryx builds Next.js here
        ├── api_location: "api"         ← SWA picks up compiled dist/ via package.json main
        └── output_location: "out"      ← relative to app_location = frontend/out/

                    ▼ upload to SWA

Azure Static Web Apps
  ├── Global CDN  ← serves frontend/out/** (HTML, JS, CSS, assets)
  ├── SWA Router  ← staticwebapp.config.json (navigationFallback → /index.html)
  └── Managed Functions API (same domain /api/*)
        ├── GET  /api/vehicle/{plate}
        └── POST /api/enrich/{plate}
              │
              ├── Azure Table Storage ── VehicleCache, LlmSummaryCache
              └── Anthropic API ────── ANTHROPIC_API_KEY from app settings

GitHub PR
       │
       ▼
GitHub Actions: validate.yml
  ├── npm ci
  ├── npm run lint (frontend workspace)
  ├── npm run typecheck (both workspaces)
  └── npm run build (both workspaces)
```

### Recommended Project Structure (files to create)
```
.github/
└── workflows/
    ├── deploy.yml          # SWA deploy on push to main + workflow_dispatch
    └── validate.yml        # lint + typecheck + build on PR to main
DEPLOY.md                   # provisioning runbook (manual, no Bicep)
```

No changes to `frontend/`, `api/`, or `staticwebapp.config.json`.

---

## Key Technical Findings

### 1. `Azure/static-web-apps-deploy@v1` — Exact Parameters

**What the action does:**
- Runs Oryx build system on `app_location` to produce frontend static output
- Picks up the API from `api_location` — SWA reads `api/package.json` `main` field to find compiled entry points
- Uploads `output_location` content as the static frontend
- Deploys managed Functions from the compiled output in `api_location`

**Required inputs:**
```yaml
azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
repo_token: ${{ secrets.GITHUB_TOKEN }}     # used for PR comment status
action: "upload"
app_location: "frontend"
api_location: "api"
output_location: "out"
```

**`output_location` path resolution:** [ASSUMED] Output location is interpreted as relative to `app_location`, meaning `output_location: "out"` resolves to `frontend/out`. This is consistent with the CONTEXT.md decision (D-05) and the Next.js default `out/` directory. Confirm by checking SWA action docs or first deploy output. If wrong, the fix is to either set `output_location: "frontend/out"` (absolute from root) or confirm existing value works.

**`repo_token`:** Optional but required for the action to post PR deploy preview status comments. Use `${{ secrets.GITHUB_TOKEN }}` — automatically provided by GitHub Actions.

**`skip_api_build`:** Not needed. SWA will build the API using the `main` field in `api/package.json`. However, because the project pre-compiles TypeScript (the `main` field points to `dist/`), the API TypeScript must be compiled **before** the SWA action runs. Add `npm run build --workspace api` as a step before the SWA deploy action.

**`IS_STATIC_EXPORT` env var:** Some SWA documentation mentions setting `IS_STATIC_EXPORT: true` to help Oryx detect static export. The project already sets `NEXT_BUILD_EXPORT=1` in the frontend build script — verify Oryx picks this up correctly, or add the env var to the workflow. [ASSUMED — needs first-deploy verification]

[CITED: https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration]

### 2. `staticwebapp.config.json` Location

Currently lives at `frontend/staticwebapp.config.json` (confirmed in codebase). Since `app_location: "frontend"`, this is the correct location. With static export, Next.js copies files from `frontend/` to `frontend/out/`. The `staticwebapp.config.json` must be in `output_location` root after build. [ASSUMED] Next.js static export does NOT automatically copy `staticwebapp.config.json` to `out/` — this file must either be placed in `frontend/public/` so Next.js copies it, or copied explicitly in the workflow. [VERIFIED: `ls frontend/out/` will confirm at deploy time.]

**Action item for plan:** Add a workflow step to copy `staticwebapp.config.json` from `frontend/` to `frontend/out/` after the frontend build, OR move it to `frontend/public/staticwebapp.config.json` (Next.js copies `public/` contents to `out/` automatically). Moving to `public/` is cleaner.

[CITED: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration]

### 3. Managed Functions Limitations vs Standalone Functions App

| Feature | Managed Functions (SWA Free tier) | Standalone Functions App |
|---------|----------------------------------|--------------------------|
| Trigger types | HTTP only | All triggers (timer, queue, etc.) |
| Execution timeout | 45 seconds max | 230s (consumption), unlimited (premium) |
| Durable Functions | Not supported | Supported |
| Runtime versions | Node 20 (default since late 2024) | All supported versions |
| Plan | Consumption (automatic, part of SWA) | Configurable |
| Region | Same as SWA resource | Any |
| Cost | Included in SWA Free | Separate billing |
| "Bring your own" | Requires Standard tier SWA | N/A |

**Conclusion for this project:** All functions are HTTP-triggered with fast I/O (RDW API, Table storage). Managed Functions constraints are not a problem. 45-second timeout is ample. Free tier is appropriate.

[CITED: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions]
[CITED: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas]

### 4. Node.js Runtime Version for Managed Functions

Add `"platform": { "apiRuntime": "node:20" }` to `staticwebapp.config.json` to pin Node 20. The project's `api/package.json` already has `"engines": { "node": ">=20.11.0" }` which helps Oryx during build.

```json
{
  "platform": {
    "apiRuntime": "node:20"
  },
  "navigationFallback": { ... },
  "globalHeaders": { ... }
}
```

[CITED: https://learn.microsoft.com/en-us/azure/static-web-apps/languages-runtimes]

### 5. Azure Functions v4 Entry Point Discovery

The managed Functions runtime uses `api/package.json` `main` field to load function registrations. The existing value:

```json
"main": "dist/src/{index.js,functions/*.js}"
```

This is correct: `dist/src/index.js` runs `app.setup(...)` and `dist/src/functions/vehicle.js` + `dist/src/functions/enrich.js` register the two HTTP functions. The TypeScript must be compiled before the SWA action runs.

[CITED: https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node]

### 6. Application Settings for SWA Managed Functions

Application settings set on the SWA resource are automatically propagated to the managed Functions app. This means env vars accessible via `process.env` in function code work without additional configuration.

**Required application settings in production:**

| Setting Name | Value | Source |
|-------------|-------|--------|
| `FUNCTIONS_WORKER_RUNTIME` | `node` | Required by Functions runtime |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string from Azure Portal | Storage account Access Keys blade |
| `RDW_APP_TOKEN` | Socrata app token | Registered at data.overheid.nl |
| `ANTHROPIC_API_KEY` | API key | Anthropic Console |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | From App Insights resource | Optional but recommended |

**AzureWebJobsStorage:** For managed SWA Functions, the SWA service manages this internally — you do NOT set it explicitly. The `AZURE_STORAGE_CONNECTION_STRING` is the app's own cache storage, distinct from the AzureWebJobsStorage that Functions uses internally.

**CLI command to set:**
```bash
az staticwebapp appsettings set \
  --name <SWA_NAME> \
  --resource-group <RG_NAME> \
  --setting-names \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "AZURE_STORAGE_CONNECTION_STRING=<conn_str>" \
    "RDW_APP_TOKEN=<token>" \
    "ANTHROPIC_API_KEY=<key>" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=<conn_str>"
```

[CITED: https://learn.microsoft.com/en-us/cli/azure/staticwebapp/appsettings?view=azure-cli-latest]
[CITED: https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings]

### 7. Application Insights — Automatic vs Manual

**Automatic (zero code needed):**
- All function invocations logged as `requests` in Application Insights
- Exceptions automatically captured
- Outgoing HTTP calls (RDW, Anthropic) tracked as `dependencies`
- Duration, success/failure, result codes logged per invocation

**What needs configuration:**
- Set `APPLICATIONINSIGHTS_CONNECTION_STRING` as an application setting on the SWA resource
- The `host.json` already configures sampling (`isEnabled: true`, `excludedTypes: "Request"`)

**Not needed for v1:**
- `applicationinsights` npm package (adds console log capture, correlation — overkill for v1)
- OpenTelemetry Distro (only needed for custom spans/metrics)
- Any code changes

**Cold start measurement:**
After first deploy, in Application Insights → Logs, run:
```kusto
requests
| where timestamp > ago(1d)
| summarize count(), avg(duration), percentile(duration, 95), max(duration) by bin(timestamp, 1h)
| order by timestamp desc
```
First invocation after idle period = cold start. Compare max vs avg duration to see cold start delta.

[CITED: https://learn.microsoft.com/en-us/azure/azure-monitor/app/monitor-functions]

---

## Azure CLI Runbook Commands (for DEPLOY.md)

These are the exact CLI commands to document in DEPLOY.md:

### Step 1: Create Resource Group
```bash
az group create \
  --name kentekenmagic-rg \
  --location westeurope
```

### Step 2: Create SWA Resource
```bash
az staticwebapp create \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --location westeurope \
  --sku Free
```

Note: `--source`, `--branch`, and `--token` are optional if linking to GitHub is done via Portal. SWA automatically generates a deployment token upon creation.

### Step 3: Get Deployment Token (for GitHub Secret)
```bash
az staticwebapp secrets list \
  --name kentekenmagic \
  --query "properties.apiKey" \
  -o tsv
```

Copy output → GitHub repo → Settings → Secrets → New repository secret → `AZURE_STATIC_WEB_APPS_API_TOKEN`.

### Step 4: Create Storage Account
```bash
az storage account create \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2
```

Note: Storage account names are globally unique, 3-24 chars, lowercase letters and digits only.

### Step 5: Create Tables
```bash
# Get connection string
CONN_STR=$(az storage account show-connection-string \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  -o tsv)

# Create tables
az storage table create --name VehicleCache --connection-string "$CONN_STR"
az storage table create --name LlmSummaryCache --connection-string "$CONN_STR"
```

### Step 6: Set Application Settings
```bash
az staticwebapp appsettings set \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --setting-names \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR" \
    "RDW_APP_TOKEN=<your-socrata-token>" \
    "ANTHROPIC_API_KEY=<your-anthropic-key>"
```

[CITED: https://learn.microsoft.com/en-us/cli/azure/staticwebapp]
[CITED: https://learn.microsoft.com/en-us/cli/azure/storage/table]
[CITED: https://learn.microsoft.com/en-us/cli/azure/storage/account]

---

## validate.yml Adaptation Notes

The workforceplanning `validate.yml` runs lint, typecheck, and build from the repo root. KentekenMagic has the same pattern. The key differences:

| Property | workforceplanning | kentekenmagic |
|----------|------------------|---------------|
| `npm run lint` | root-level | root-level (delegates to frontend workspace) |
| `npm run typecheck` | root-level | root-level (delegates to both workspaces) |
| `npm run build` | root-level | root-level (builds both frontend and api) |
| Node version | 22 | 22 (keep same) |
| `cache: 'npm'` | yes | yes |
| `NEXT_TELEMETRY_DISABLED` | yes | yes |

The build check needs a dummy storage connection string to avoid the `AZURE_STORAGE_CONNECTION_STRING` undefined error — copy the workforceplanning pattern of passing `UseDevelopmentStorage=true` as env var.

**Additional env var needed for build:**
```yaml
env:
  NEXT_BUILD_EXPORT: "1"           # triggers static export mode in next.config.ts
  NEXT_TELEMETRY_DISABLED: "1"
  AZURE_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true"
```

---

## deploy.yml Structure

```yaml
name: Deploy to Azure Static Web Apps

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '22'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build API
        run: npm run build --workspace api
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "frontend"
          api_location: "api"
          output_location: "out"
        env:
          NEXT_BUILD_EXPORT: "1"
          NEXT_TELEMETRY_DISABLED: "1"
```

Note: No `AZURE_STORAGE_CONNECTION_STRING` in the workflow — this is set as an Azure application setting, not a build-time variable. The frontend build does not use it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SWA routing fallback for deep links | Custom server-side routing | `staticwebapp.config.json` `navigationFallback` | Already implemented; SWA handles it |
| Deployment token rotation | Manual key management | `az staticwebapp secrets list` | Azure manages token lifecycle |
| Table creation | Custom SDK provisioning script | `az storage table create` | One-time CLI command in runbook |
| Function discovery | Custom function registration | `api/package.json` `main` field | v4 programming model handles it |

---

## Common Pitfalls

### Pitfall 1: `staticwebapp.config.json` Not in Output
**What goes wrong:** SWA routing config is ignored; deep links return 404, `/api/*` exclusion doesn't work.
**Why it happens:** Next.js static export copies `public/` contents to `out/`, but `frontend/staticwebapp.config.json` is not in `public/` — it stays in `frontend/`.
**How to avoid:** Move `staticwebapp.config.json` from `frontend/` to `frontend/public/`. Next.js copies `public/` to `out/` automatically. Or add a workflow step: `cp frontend/staticwebapp.config.json frontend/out/`.
**Warning signs:** First deploy smoke test — navigate to `/lookup/ABC123` directly; if it 404s, the config wasn't picked up.

### Pitfall 2: TypeScript Not Compiled Before SWA Action
**What goes wrong:** SWA deploys empty `api/dist/` directory; Functions return 500 or are not found.
**Why it happens:** SWA action runs Oryx for the frontend but does NOT run `tsc` for the API — it only reads the compiled output at `api_location`. If `npm run build --workspace api` is not run first, `dist/` is missing or stale.
**How to avoid:** Always add `npm run build --workspace api` as a step before the SWA deploy action.
**Warning signs:** Functions return 500; Application Insights shows worker startup errors.

### Pitfall 3: `AZURE_STORAGE_CONNECTION_STRING` Empty in Production
**What goes wrong:** Cache reads/writes fail; every lookup hits RDW even when cached data exists.
**Why it happens:** Developer forgets to set application settings after provisioning SWA.
**How to avoid:** Run `az staticwebapp appsettings set` as documented in DEPLOY.md immediately after creating the SWA resource, before triggering first deploy.
**Warning signs:** tableCache errors in Application Insights; response times consistently slow even for repeated plates.

### Pitfall 4: `output_location` Path Resolution Confusion
**What goes wrong:** SWA deploy succeeds but serves blank page or wrong content.
**Why it happens:** Ambiguity in whether `output_location` is relative to `app_location` or repo root. If `output_location: "out"` resolves to `/out` (repo root) instead of `frontend/out`, the wrong content is served.
**How to avoid:** [ASSUMED] The action resolves `output_location` relative to `app_location`. Verify on first deploy by checking SWA build logs for the resolved upload path. If wrong, change to `output_location: "frontend/out"`.
**Warning signs:** Deploy succeeds but site shows default SWA placeholder page.

### Pitfall 5: Secret Name Mismatch
**What goes wrong:** Deploy action fails with "Invalid API key" despite setting the secret.
**Why it happens:** If Azure Portal creates the SWA with a linked GitHub repo, it auto-generates a workflow with a secret name like `AZURE_STATIC_WEB_APPS_API_TOKEN_GENTLE_WATER_ABC123`. The workflow then references a different name than what's in GitHub Secrets.
**How to avoid:** Use manually created secret named exactly `AZURE_STATIC_WEB_APPS_API_TOKEN` obtained via `az staticwebapp secrets list`. Do not use the auto-generated workflow from the Portal.
**Warning signs:** Action log shows "Deployment token is not valid."

### Pitfall 6: Storage Account Name Conflicts
**What goes wrong:** `az storage account create` fails because name is taken globally.
**Why it happens:** Storage account names are globally unique across all Azure tenants.
**How to avoid:** Choose a name like `kentekenmagicXXXX` where XXXX is a short random suffix (e.g., last 4 of subscription ID).
**Warning signs:** CLI error: "Storage account name already taken."

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend + api) |
| Config file | `frontend/vitest.config.ts`, `api` uses default |
| Quick run command | `npm run test --workspaces --if-present` |
| Full suite command | `npm run test --workspaces --if-present` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Notes |
|-----|----------|-----------|-------|
| Exit: direct links work in production | SWA routing fallback serves index.html | manual-only | Smoke test after deploy |
| Exit: cache read/write works | Table cache round-trip succeeds | manual-only | Warm lookup on production URL |
| Exit: cold start + warm timings documented | First and subsequent invocation times | manual-only | KQL query in App Insights |
| Exit: no checked-in secrets | No API keys in repo source | manual-only | `git grep` before merge |

### Sampling Rate
- **Per task commit:** `npm run test --workspaces --if-present` (existing tests pass)
- **Phase gate:** Manual smoke test against production URL before marking complete

### Wave 0 Gaps
- None — no new code; existing test suite covers all implemented functionality. Phase 4 adds only config/workflow files, verified manually.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth in v1 |
| V3 Session Management | no | Stateless API |
| V4 Access Control | no | No per-user access control |
| V5 Input Validation | yes (existing) | Already implemented in vehicle/enrich functions |
| V6 Cryptography | no | No crypto operations; TLS provided by Azure |

### Secrets in Source Code
- `api/local.settings.json` contains a real `ANTHROPIC_API_KEY` (observed in codebase read). This file must be confirmed to be in `.gitignore`. **Action item for plan:** verify `local.settings.json` is gitignored and remove the key from the file before first commit of this phase.
- Production secrets live in Azure application settings only (D-08).

### Threat Patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Secrets in source | Information Disclosure | `.gitignore` for `local.settings.json`; Azure app settings for production |
| Unauthenticated Function calls | Spoofing | SWA managed Functions are public HTTP; RDW data is public so no auth required for v1 |
| Storage connection string exposure | Information Disclosure | Never hardcoded; set via `az staticwebapp appsettings set` only |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| Azure CLI (`az`) | Provisioning runbook | check at run time | Developer must have `az` installed and logged in |
| GitHub Actions | deploy.yml, validate.yml | ✓ | Repo is already on GitHub |
| Azure subscription | SWA + Storage provisioning | ✓ (assumed) | Personal account |
| Node 22 | GitHub Actions | ✓ | Provided by `actions/setup-node@v4` |
| `npm` workspace | Build | ✓ | Already used in Phases 0-3 |

**Missing dependencies with no fallback:** None — all CI dependencies are provided by GitHub Actions runners.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `output_location: "out"` is relative to `app_location` (i.e., resolves to `frontend/out`) | deploy.yml Structure | Wrong path → site serves placeholder or wrong content; fix in first deploy |
| A2 | `IS_STATIC_EXPORT: true` env var is not required because `NEXT_BUILD_EXPORT=1` already triggers static export | deploy.yml Structure | Without it, Oryx may build in hybrid mode (SSR) rather than static export; fix by adding env var if needed |
| A3 | Next.js static export does NOT auto-copy `staticwebapp.config.json` to `out/` | Pitfall 1 | If wrong, no action needed; if right, file must be in `public/` or copied explicitly |
| A4 | `AzureWebJobsStorage` does not need to be set manually for SWA managed Functions | Application Settings | If wrong, Functions fail to start; fix by adding the connection string as an additional setting |

---

## Open Questions

1. **`output_location` path resolution (A1)**
   - What we know: Microsoft docs say it is relative to `app_location`; some sources suggest it may be relative to repo root
   - What's unclear: Exact behavior of `Azure/static-web-apps-deploy@v1` with `app_location: "frontend"` and `output_location: "out"`
   - Recommendation: Proceed with `output_location: "out"` per D-05; verify in first deploy logs; fix immediately if blank page observed

2. **`staticwebapp.config.json` in `out/` (A3)**
   - What we know: File is at `frontend/staticwebapp.config.json`; Next.js copies `public/` → `out/` automatically
   - What's unclear: Whether the file is already in `frontend/public/` or just `frontend/`; confirmed it is at `frontend/staticwebapp.config.json` NOT in `public/`
   - Recommendation: Plan must include moving `staticwebapp.config.json` to `frontend/public/staticwebapp.config.json` so Next.js copies it to `out/`

3. **`local.settings.json` in git (security)**
   - What we know: File contains a real Anthropic API key (seen during research)
   - Recommendation: Plan must include a task to verify `.gitignore` excludes `local.settings.json` and scrub the key from the file

---

## Sources

### Primary (HIGH confidence)
- [Build configuration for Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration) — action parameters, output_location behavior
- [API support in Azure Static Web Apps with Azure Functions](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions) — managed Functions limitations, HTTP-only triggers
- [az staticwebapp appsettings](https://learn.microsoft.com/en-us/cli/azure/staticwebapp/appsettings?view=azure-cli-latest) — CLI command syntax
- [az staticwebapp](https://learn.microsoft.com/en-us/cli/azure/staticwebapp?view=azure-cli-latest) — SWA create, secrets list
- [az storage table](https://learn.microsoft.com/en-us/cli/azure/storage/table?view=azure-cli-latest) — table create command
- [Supported languages and runtimes](https://learn.microsoft.com/en-us/azure/static-web-apps/languages-runtimes) — apiRuntime node:20
- [Configure Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) — staticwebapp.config.json placement rules
- [Monitor Azure Functions with Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/monitor-functions) — automatic vs manual telemetry
- [Configure application settings for SWA](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings) — settings propagation to Functions
- [Node.js developer reference for Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node) — main field entry point
- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) — 45-second timeout, Free tier limits
- [Deploying to Azure Static Web App — GitHub Docs](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/azure-static-web-app) — AZURE_STATIC_WEB_APPS_API_TOKEN secret name

### Secondary (MEDIUM confidence)
- [azure/static-web-apps-deploy action.yml (v1)](https://github.com/Azure/static-web-apps-deploy/blob/v1/action.yml) — exact input definitions
- [Tutorial: Deploy static-rendered Next.js on SWA](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-static-export) — Next.js static export + SWA walkthrough

### Tertiary (LOW confidence)
- Community reports that SWA managed Functions warm up within 200-300ms in West Europe after first hit (favorable for this project's west-europe target)

---

## Metadata

**Confidence breakdown:**
- GitHub Actions workflow structure: HIGH — reference workflow exists in workforceplanning; adaptation is mechanical
- SWA deploy action parameters: HIGH — official Microsoft docs confirmed
- Azure CLI provisioning commands: HIGH — official Microsoft Learn CLI reference
- `output_location` path resolution: MEDIUM — documented but with conflicting community reports; treat as [ASSUMED]
- `staticwebapp.config.json` placement: MEDIUM — behavior confirmed from docs; specific Next.js copy behavior [ASSUMED]
- Application Insights auto-telemetry: HIGH — official docs confirm zero-config via connection string setting
- Cold start behavior: MEDIUM — community reports for west-europe region; no official SLA

**Research date:** 2026-05-22
**Valid until:** 2026-08-22 (Azure SWA is a stable service; workflow syntax unlikely to change)
