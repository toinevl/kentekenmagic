---
phase: 4
phase_name: "azure-release"
project: "kentekenmagic"
generated: "2026-05-27"
counts:
  decisions: 9
  lessons: 7
  patterns: 5
  surprises: 5
missing_artifacts:
  - "04-03-SUMMARY.md (plan 03 blocked at human checkpoint — deployment not yet verified)"
  - "04-VERIFICATION.md"
  - "04-UAT.md"
---

# Phase 4 Learnings: Azure Release

## Decisions

### staticwebapp.config.json belongs in frontend/public/, not frontend/ root
Moved from `frontend/staticwebapp.config.json` to `frontend/public/staticwebapp.config.json` so that Next.js static export automatically copies it to `frontend/out/` at build time.

**Rationale:** Next.js copies everything in `public/` to `out/` during static export. A file in `frontend/` root is invisible to the build and never reaches the deployed artifact. Without the config in `out/`, the Azure SWA CDN applies no routing rules — deep-link fallback and `/api/*` exclusion break silently.
**Source:** 04-01-PLAN.md, 04-01-SUMMARY.md

---

### platform.apiRuntime: node:20 must be set explicitly
Added `"platform": {"apiRuntime": "node:20"}` to staticwebapp.config.json.

**Rationale:** Without explicit runtime pinning, Azure SWA defaults to an older Node version. The Azure Functions v4 programming model requires Node 18+. This single field prevents the function runtime from mismatching.
**Source:** 04-01-PLAN.md

---

### Separate validate.yml from deploy.yml — quality gate is not deploy path
Two distinct GitHub Actions workflows: validate.yml handles lint/typecheck/build on PRs; deploy.yml is a fast path that only deploys.

**Rationale:** Quality checks slow the feedback loop and should run on PRs where they can block a bad merge. The deploy path (D-02) must be unconditional once triggered — if code passed review and merged, deploy it.
**Source:** 04-02-PLAN.md, 04-CONTEXT.md (D-02, D-06)

---

### validate.yml uses UseDevelopmentStorage=true instead of real Azure credentials
`AZURE_STORAGE_CONNECTION_STRING: UseDevelopmentStorage=true` in the PR workflow's build step.

**Rationale:** PR builds run on untrusted contributor code. Real secrets must not be exposed. The Azure SDK accepts `UseDevelopmentStorage=true` as a valid connection string and routes to local Azurite — no Azure infrastructure required. This mock value lets the TypeScript build pass without credential access.
**Source:** 04-02-PLAN.md, 04-02-SUMMARY.md

---

### deploy.yml has no typecheck or lint step (D-02 fast path)
The deploy workflow goes: checkout → npm ci → build API → build frontend → SWA deploy. No quality checks.

**Rationale:** Validation is validate.yml's responsibility on the PR. Repeating it in deploy adds latency with zero benefit for merged code. Per D-02, the deploy path is intentionally lean.
**Source:** 04-02-PLAN.md, 04-CONTEXT.md (D-02)

---

### Token auth via AZURE_STATIC_WEB_APPS_API_TOKEN — no OIDC, no permissions block
deploy.yml uses `${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}` directly. No `permissions:` block.

**Rationale:** OIDC requires Federated Identity credential setup in Azure AD plus a `permissions: id-token: write` block. Token auth is simpler and sufficient for a personal project. Per D-04, no OIDC was chosen.
**Source:** 04-02-PLAN.md, 04-CONTEXT.md (D-04)

---

### AZURE_STORAGE_CONNECTION_STRING is an Azure application setting, not a build-time variable
Excluded from deploy.yml; set via `az staticwebapp appsettings set` in Step 6 of DEPLOY.md.

**Rationale:** The connection string is a runtime secret consumed by the API at request time — not needed during the CI build step. Including it in deploy.yml would require a CI secret and expose it unnecessarily. All runtime secrets belong in Azure application settings, not in the workflow file.
**Source:** 04-02-SUMMARY.md

---

### Provision via az CLI only — never use Azure Portal to link the repository
All Azure resources provisioned with `az` commands. The SWA resource is created via CLI without Portal GitHub integration.

**Rationale:** Portal-generated workflows use a randomized secret name (e.g. `AZURE_STATIC_WEB_APPS_API_TOKEN_GENTLE_WATER_ABC123`) that conflicts with the manually-named `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. Using the CLI keeps the secret name predictable.
**Source:** DEPLOY.md troubleshooting #5, 04-03-PLAN.md

---

### Pre-build all artifacts and bypass Oryx with skip_app_build: true
Final deploy.yml approach: explicit "Build API" (tsc) + "Build frontend" (next build with NEXT_BUILD_EXPORT=1) steps, then `Azure/static-web-apps-deploy@v1` with `skip_app_build: true` and `app_location: "frontend/out"`.

**Rationale:** Oryx (Azure's build engine inside the SWA action) runs npm install standalone without the monorepo lockfile, making it susceptible to large devDependencies and package resolution differences. Pre-building in CI gives full control over the build environment and eliminates Oryx as a variable.
**Source:** deploy.yml evolution (commits 9b76b52, 74384f8), DEPLOY.md troubleshooting

---

## Lessons

### Azure Functions v4 entry point must explicitly import every function module
`api/src/index.ts` was missing `import "./functions/vehicle.js"` and `import "./functions/enrich.js"`.

**Context:** In the v4 programming model, functions self-register when their module is loaded — via `app.http(...)` calls at module scope. The Azure Functions runtime loads the `main` entry point and discovers only what that entry point imports. Without explicit imports, the runtime starts successfully but finds no registered functions, resulting in a 404 on all `/api/*` routes.
**Source:** api/src/index.ts fix (commit 04424e8), DEPLOY.md troubleshooting #2

---

### package.json `main` must be a concrete file path — globs are not valid
`main` was set to `"dist/src/{index.js,functions/*.js}"` (a glob). Changed to `"dist/src/index.js"`.

**Context:** Node.js module resolution and the Azure Functions runtime both treat `main` as a literal file path. Globs are not expanded. The runtime silently fails to load the entry point, producing a startup error with no obvious connection to the `main` field.
**Source:** api/package.json fix (commit 04424e8)

---

### extensionBundle in host.json breaks Azure Functions v4 HTTP-only apps on SWA
Removing `extensionBundle` from `api/host.json` unblocked a deployment failure.

**Context:** Extension bundles provide trigger bindings (Service Bus, Event Grid, Timers, etc.). HTTP-only function apps using the v4 programming model do not need them. The presence of an `extensionBundle` configuration can cause SWA managed function deployment to fail during the bundle resolution phase.
**Source:** host.json fix (commit a211c80)

---

### azure-functions-core-tools in devDependencies causes Oryx npm install to fail
Removing this package from `api/package.json` devDependencies resolved persistent "Failed to deploy the Azure Functions" errors.

**Context:** The `azure-functions-core-tools` npm package runs a postinstall script that downloads ~500MB of platform-specific binaries (the full `func` CLI for Windows/macOS/Linux). Oryx's npm install runs in a time-constrained environment without the monorepo lockfile. This large download consistently timed out or failed. The package is only needed for local `func start` development — Azure's managed runtime does not use it.
**Source:** api/package.json change (commit f32b337), deployment debugging session

---

### skip_app_build: true changes app_location semantics — it expects the artifact directory directly
Setting `skip_app_build: true` without updating `app_location` produces: "Failed to find a default file in the app artifacts folder."

**Context:** Without the flag, `app_location` is the *source* directory and `output_location` is the subdirectory within it where the build output lands. With `skip_app_build: true`, Oryx is skipped entirely and the action reads `app_location` as the *final artifact directory* — `output_location` is ignored. Fix: set `app_location: "frontend/out"` (the pre-built Next.js export) and drop `output_location`.
**Source:** deploy.yml debugging (commits 9b76b52 → 74384f8), DEPLOY.md troubleshooting #4

---

### DEPLOY.md must start with GitHub repository creation, not Azure provisioning
Initial DEPLOY.md omitted the step to create the GitHub repository. User hit a dead end before any Azure step.

**Context:** The runbook was written assuming a remote repository already existed. For a greenfield deployment, the very first action is `gh repo create kentekenmagic --public --source=. --remote=origin --push`. Without this, `git push origin main` (the deploy trigger) has no destination. Added as Step 0.
**Source:** DEPLOY.md Step 0 addition (commit 2a17ca1), user feedback during execution

---

### Oryx resolves packages fresh from npm — no monorepo lockfile
Oryx receives only the `api_location` directory. The root `package-lock.json` is not included.

**Context:** In a monorepo with npm workspaces, the lockfile lives at the repo root. When the SWA action packages the `api/` directory and sends it to Oryx, only `api/package.json` is present — no lockfile. Oryx resolves all dependency versions from the npm registry at build time. This means package versions can differ from what was tested locally, and any package with slow postinstall scripts (like azure-functions-core-tools) can break the build unpredictably.
**Source:** deploy.yml debugging, api/package.json fix

---

## Patterns

### Static config files for Next.js static export go in frontend/public/
Everything in `public/` is copied verbatim to `out/` during `next build --export`. This is the correct placement for any file that must survive the build and be present in the deployed CDN artifact: `staticwebapp.config.json`, `robots.txt`, `favicon.ico`, etc.

**When to use:** Any Next.js static export project where a configuration or asset file must be present in the CDN artifact but should not be processed by the Next.js bundler.
**Source:** 04-01-SUMMARY.md

---

### Two-workflow CI/CD: PR gate separate from deploy path
validate.yml handles quality checks (lint, typecheck, build with mock credentials) on every PR. deploy.yml is a fast-path that only deploys — no quality checks, no secrets in the build environment beyond the deployment token.

**When to use:** Any GitHub Actions → Azure project where you want PR feedback without slowing the merge-to-deploy path. The separation also prevents credential exposure on PR builds from forked repos.
**Source:** 04-02-PLAN.md, 04-02-SUMMARY.md

---

### Mock Azure credentials in PR workflows with UseDevelopmentStorage=true
Set `AZURE_STORAGE_CONNECTION_STRING: UseDevelopmentStorage=true` in validate.yml's build environment. The Azure SDK accepts this string and routes to local Azurite — build and typecheck pass without any real Azure infrastructure.

**When to use:** Any project using `@azure/data-tables`, `@azure/storage-blob`, or related SDKs where connection strings are read at import time or during build. Prevents CI failures on PRs from contributors who don't have Azure access.
**Source:** 04-02-SUMMARY.md

---

### Bypass Oryx with skip_app_build + pre-built artifacts in CI
Build TypeScript (→ `api/dist/`) and Next.js static export (→ `frontend/out/`) as explicit CI steps, then set `skip_app_build: true` on the SWA action and point `app_location` at the built output directory. Azure still installs production deps on its side.

**When to use:** Monorepo projects (Oryx doesn't have the monorepo lockfile), projects with heavy devDependencies that cause Oryx timeouts, or whenever build reproducibility is critical.
**Source:** deploy.yml final state, deployment debugging

---

### Retrieve Azure SWA deployment token via az CLI, not Portal
`az staticwebapp secrets list --name <name> --resource-group <rg> --query "properties.apiKey" -o tsv`

**When to use:** Every Azure SWA project with GitHub Actions deployment. Never create the SWA resource via Portal and link it to GitHub — this auto-generates a workflow with a randomized secret name that conflicts with any manually-named workflow secret.
**Source:** DEPLOY.md troubleshooting, 04-03-PLAN.md

---

## Surprises

### Azure SWA Portal auto-generates workflows with randomized secret names
Creating the SWA resource via the Azure Portal and linking it to GitHub generates a GitHub Actions workflow with a secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_GENTLE_WATER_ABC123` (unique per resource). This name differs from any manually-named secret.

**Impact:** The deploy.yml workflow we created references `secrets.AZURE_STATIC_WEB_APPS_API_TOKEN` — a predictable name. The Portal-generated secret name does not match. The deployment fails immediately with "deployment_token provided was invalid." Resolution: always provision via CLI; never let the Portal touch the GitHub integration.
**Source:** DEPLOY.md troubleshooting #5, deployment execution

---

### azure-functions-core-tools downloads 500MB of binaries — invisible until deployed
This devDependency appears innocuous in package.json but installs hundreds of megabytes of platform binaries via a postinstall script that downloads platform-specific builds of the `func` CLI.

**Impact:** There was no obvious connection between this package and the generic "Failed to deploy the Azure Functions" error. The failure root cause required elimination of other hypotheses (missing function imports, wrong main field, extensionBundle) before the package install was identified. Removing it (404 lines from package-lock.json) immediately resolved the persistent deployment failure.
**Source:** api/package.json change (commit f32b337), deployment debugging

---

### skip_app_build: true skips Oryx for both frontend AND API — not just the app
The parameter name implies it only skips the "app" (frontend) build, but the effect is broader: Oryx is bypassed for both the app and the API builds.

**Impact:** After adding the flag to fix an unrelated issue, a new error appeared: "Failed to find a default file in the app artifacts folder (frontend)." This was because `app_location: "frontend"` pointed to the source directory, but with Oryx skipped, the action expected the artifact directory directly. Required changing `app_location` to `"frontend/out"` and adding an explicit "Build frontend" CI step to compensate.
**Source:** deploy.yml debugging (commits 9b76b52, 74384f8)

---

### A live Anthropic API key was present on disk before Phase 4 started
`api/local.settings.json` contained a real `sk-ant-...` API key when Plan 04-01 execution began.

**Impact:** Had to be caught and scrubbed as Task 2 of Plan 04-01 before any commits landed in the phase. The file was gitignored and was never committed to history, but the key was live and accessible on disk. Reinforces the importance of making secret-scrubbing the first task of any deployment phase, not a post-deployment concern.
**Source:** 04-01-PLAN.md Task 2, 04-01-SUMMARY.md

---

### npm workspaces creates an empty api/node_modules/ that can confuse deployment tooling
After `npm ci` at the workspace root, `api/node_modules/` exists but is empty — all dependencies are hoisted to the root `node_modules/`. When the SWA action packages `api/`, this empty directory is included.

**Impact:** Added ambiguity when diagnosing deployment failures: is the function failing because it can't find `@azure/functions`, or because Oryx skipped npm install (seeing node_modules already present), or because of a build error? The empty directory makes the `api/` look like a standalone project with deps installed when it is not.
**Source:** deployment debugging, workspace monorepo structure
