# Phase 04: Azure Release - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 6 new/modified files
**Analogs found:** 5 / 6 (83%)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/deploy.yml` | workflow | CI/CD automation | workforceplanning `deploy.yml` (partial) + `validate.yml` (workflow structure) | partial-match |
| `.github/workflows/validate.yml` | workflow | CI/CD validation | workforceplanning `validate.yml` | exact-match |
| `DEPLOY.md` | documentation | instructional/runbook | None (new document) | no-match |
| `frontend/public/staticwebapp.config.json` | config | SWA routing | `frontend/staticwebapp.config.json` (file move) | same-file-move |
| `frontend/next.config.ts` | config | static export | `frontend/next.config.ts` (existing file) | same-file-review |
| `api/local.settings.json` | config | secrets/env | `api/local.settings.json` (existing file) | same-file-scrub |

---

## Pattern Assignments

### `.github/workflows/validate.yml` (workflow, CI/CD validation)

**Analog:** `/home/toine/projects/workforceplanning/.github/workflows/validate.yml`

**Workflow structure** (lines 1-12):
```yaml
name: Validate Pull Request

on:
  pull_request:
    branches:
      - main

env:
  NODE_VERSION: '22'

jobs:
  validate:
    runs-on: ubuntu-latest
```

**Checkout + Node setup pattern** (lines 16-23):
```yaml
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
```

**Build steps with npm workspaces** (lines 25-39):
```yaml
      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Build check
        run: npm run build
        env:
          NODE_ENV: production
          AZURE_STORAGE_CONNECTION_STRING: UseDevelopmentStorage=true
          NEXT_TELEMETRY_DISABLED: '1'
```

**Adaptations for KentekenMagic:**
- Node 22 already matches project standard
- `npm ci` works with monorepo (workspace root)
- Lint runs from root → delegates to frontend workspace (per `package.json` script)
- Typecheck runs from root → delegates to both workspaces (per `package.json` script)
- Build check includes both workspaces (per `package.json` script)
- Mock storage connection string (`UseDevelopmentStorage=true`) prevents build failures from missing secrets

---

### `.github/workflows/deploy.yml` (workflow, CI/CD deployment)

**Partial Analog 1:** `/home/toine/projects/workforceplanning/.github/workflows/deploy.yml` (workflow structure, Node setup)

**Partial Analog 2:** `/home/toine/projects/workforceplanning/.github/workflows/validate.yml` (checkout + setup pattern)

**Workflow structure + triggers** (lines 1-8 from workforceplanning deploy.yml):
```yaml
name: Build and Deploy to Azure App Service

on:
  push:
    branches:
      - main
  workflow_dispatch:
```

**For KentekenMagic deploy.yml, adapt to:**
```yaml
name: Deploy to Azure Static Web Apps

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  NODE_VERSION: '22'
```

**Checkout + Node setup** (from workforceplanning deploy.yml, lines 22-35):
```yaml
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
```

**Install and build steps** (from workforceplanning deploy.yml, lines 38-48, adapted for monorepo):
```yaml
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

**Key differences from workforceplanning deploy.yml:**
- NO Azure login step (using SWA deployment token per D-04, not OIDC)
- NO permission block (token auth doesn't require `id-token: write`)
- NO typecheck or lint job (fast path per D-02 — no CI gate, validate.yml is separate)
- NO separate "Prepare standalone deployment package" step (SWA action handles next.js export build automatically)
- Build API explicitly before SWA action (to ensure `api/dist/` is populated for managed Functions)
- SWA action parameters per D-05: `app_location: "frontend"`, `api_location: "api"`, `output_location: "out"`
- Frontend build environment variables: `NEXT_BUILD_EXPORT: "1"` triggers static export mode in Next.js

**Why no CI gate before deploy (D-02):**
Validation is run on PR in `validate.yml`. Once PR is merged to main, deploy runs immediately without re-checking. This is intentional per decision D-02.

---

### `frontend/staticwebapp.config.json` → `frontend/public/staticwebapp.config.json` (config, SWA routing)

**Existing Analog:** `frontend/staticwebapp.config.json` (lines 1-10)

**Current location:** `frontend/staticwebapp.config.json`
**New location:** `frontend/public/staticwebapp.config.json`

**No content changes required.** The file itself (current version):
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/_next/*", "/assets/*", "/*.{css,js,png,jpg,jpeg,gif,svg,ico,webmanifest}"]
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
}
```

**Why move to `public/`:**
- Next.js static export automatically copies `frontend/public/*` → `frontend/out/*`
- SWA deploy action picks up static content from `output_location` (which is `frontend/out`)
- If the config stays at `frontend/`, it won't be copied to `out/` and SWA routing will fail (navigationFallback won't work)
- Moving to `public/` ensures it's included in the build output without additional workflow steps

**Optional enhancement (D-06, research section 4):**
Consider adding Node runtime pinning to `staticwebapp.config.json`:
```json
{
  "platform": {
    "apiRuntime": "node:20"
  },
  "navigationFallback": { ... },
  "globalHeaders": { ... }
}
```
This is optional but recommended to pin managed Functions to Node 20 explicitly.

---

### `frontend/next.config.ts` (config, static export)

**Existing Analog:** `frontend/next.config.ts` (current file, lines 1-22)

**Current content:**
```typescript
import type { NextConfig } from "next";

const isExport = process.env.NEXT_BUILD_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" } : {}),
  images: {
    unoptimized: true
  },
  ...(!isExport ? {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:7071/api/:path*"
        }
      ];
    }
  } : {})
};

export default nextConfig;
```

**No changes required.** The config already:
- Detects `NEXT_BUILD_EXPORT === "1"` and enables `output: "export"` for static export
- Disables Next.js image optimization (required for static export)
- Adds rewrites for local dev (`http://localhost:7071` for the Functions emulator)
- Disables rewrites during production export (SWA handles /api/* routing via `staticwebapp.config.json`)

**Verification step for plan:** Confirm that the workflow env var `NEXT_BUILD_EXPORT: "1"` triggers this config correctly. This should work as-is.

---

### `api/local.settings.json` (config, secrets/env)

**Existing Analog:** `api/local.settings.json` (existing file in codebase, contains real `ANTHROPIC_API_KEY`)

**Action: Verify and Scrub**

The file is already gitignored (confirmed: `.gitignore` line 9 excludes `local.settings.json`). 

**Security check:**
- [ ] Confirm `local.settings.json` is in `.gitignore` (VERIFIED: line 9 of `.gitignore`)
- [ ] Verify no secrets are currently committed to git via `git log --all -p -- '**/local.settings.json'` (should show nothing committed)
- [ ] Scrub any real API keys from the file before first commit of phase 4; leave template placeholders only

**Template pattern** (recommended for committed version, if any non-secret template is added):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "<local-emulator-or-test-account>",
    "RDW_APP_TOKEN": "<your-socrata-app-token>",
    "ANTHROPIC_API_KEY": "<your-anthropic-api-key>",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": ""
  }
}
```

**For production (not in local.settings.json):**
All secrets are set via `az staticwebapp appsettings set` in the DEPLOY.md runbook. The local.settings.json is dev-only and should never be committed with real values.

---

### `DEPLOY.md` (documentation, provisioning runbook)

**No direct analog in codebase.** This is a new document type for this phase.

**Pattern references from RESEARCH.md (lines 279-350):**

The runbook should follow this structure:

1. **Overview** — What this document covers, prerequisites, target audience
2. **Resource creation steps** (sequential):
   - Step 1: Create Resource Group (`az group create`)
   - Step 2: Create Static Web Apps resource (`az staticwebapp create`)
   - Step 3: Get and store deployment token (`az staticwebapp secrets list`)
   - Step 4: Create Storage Account (`az storage account create`)
   - Step 5: Create Tables (`az storage table create`)
   - Step 6: Set application settings (`az staticwebapp appsettings set`)
3. **GitHub secrets setup** — Copy token to `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. **First deployment** — Trigger via push to main or `workflow_dispatch`
5. **Verification and troubleshooting**
   - Check Application Insights logs
   - Verify cache tables exist
   - Test cold start timing (KQL queries)
   - Common pitfalls (see RESEARCH.md Pitfalls 1-6)

**Concrete commands to document** (from RESEARCH.md §Azure CLI Runbook Commands):

```bash
# Resource Group
az group create \
  --name kentekenmagic-rg \
  --location westeurope

# Static Web Apps
az staticwebapp create \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --location westeurope \
  --sku Free

# Get deployment token
az staticwebapp secrets list \
  --name kentekenmagic \
  --query "properties.apiKey" \
  -o tsv

# Storage Account
az storage account create \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2

# Create tables
CONN_STR=$(az storage account show-connection-string \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  -o tsv)

az storage table create --name VehicleCache --connection-string "$CONN_STR"
az storage table create --name LlmSummaryCache --connection-string "$CONN_STR"

# Set application settings
az staticwebapp appsettings set \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --setting-names \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR" \
    "RDW_APP_TOKEN=<your-token>" \
    "ANTHROPIC_API_KEY=<your-key>"
```

**Document format:** Markdown with clear section headers, code blocks for CLI commands, and inline notes on what each step does and how to verify success.

---

## Shared Patterns

### GitHub Actions Workflow Structure
**Applied to:** `deploy.yml`, `validate.yml`

**Reusable skeleton** (from workforceplanning workflows):
```yaml
name: [Workflow Name]

on:
  [trigger]: ...
    branches:
      - main

env:
  NODE_VERSION: '22'

jobs:
  [job-name]:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: [job-specific steps]
```

### Environment Variables for Secrets
**Applied to:** Both workflows

**Pattern:**
- **Build-time secrets (mocked for CI):** Pass via workflow `env:` section
  - `AZURE_STORAGE_CONNECTION_STRING: UseDevelopmentStorage=true` in validate.yml
  - `NEXT_TELEMETRY_DISABLED: "1"` in both
  - `NEXT_BUILD_EXPORT: "1"` in deploy.yml
- **Runtime secrets (production):** Set via `az staticwebapp appsettings set` in DEPLOY.md runbook
  - Do NOT pass in workflow
  - Propagated to Functions app automatically by Azure

### npm Monorepo Build Commands
**Applied to:** Both workflows

**Pattern from project's `package.json` scripts:**
```bash
npm ci                                    # Install all workspaces
npm run lint                              # Delegates to frontend
npm run typecheck                         # Runs both frontend + api
npm run build                             # Builds both frontend + api
npm run build --workspace api             # Build api only
```

Use `--workspace` flag for explicit single-workspace builds (as in deploy.yml for API pre-compilation).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `DEPLOY.md` | documentation | instructional | First provisioning runbook in this project; no similar document exists in codebase |

---

## Configuration Files Summary

| File | Status | Action | Notes |
|------|--------|--------|-------|
| `staticwebapp.config.json` | exists at `frontend/` | Move to `frontend/public/` | Ensures SWA config is included in Next.js static export output |
| `next.config.ts` | exists at `frontend/` | Review, no changes | Already correctly configured for static export via `NEXT_BUILD_EXPORT` env var |
| `api/host.json` | exists | No changes | Application Insights sampling already configured; ready for production |
| `api/local.settings.json` | exists | Scrub secrets | Gitignored correctly; verify no real keys are committed; use template placeholders for dev |

---

## Metadata

**Analog search scope:**
- `.github/workflows/` in current repo (none found; directory doesn't exist yet)
- `/home/toine/projects/workforceplanning/.github/workflows/` (validate.yml, deploy.yml)
- Configuration files in `frontend/`, `api/` directories (existing configs reviewed)

**Files scanned:** 6 new/modified files
**Analogs found:** 5 / 6 (validate.yml, deploy.yml structure, existing configs)
**Pattern extraction date:** 2026-05-23

**Quality assessment:**
- `validate.yml` is an exact-match analog — adapt workforceplanning template directly
- `deploy.yml` is a partial-match analog — combine workflow structure from workforceplanning deploy.yml + validation structure, but replace App Service deploy with SWA-specific action
- Config files are all same-file review/enhancement — no new patterns to extract, existing logic is correct
- DEPLOY.md is documented in RESEARCH.md with exact CLI commands; no codebase analog needed

---
