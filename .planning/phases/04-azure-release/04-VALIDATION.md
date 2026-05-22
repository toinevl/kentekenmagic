---
phase: 4
slug: azure-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + GitHub Actions CI |
| **Config file** | `.github/workflows/validate.yml` (to be created) |
| **Quick run command** | `npm run build --workspace frontend && npm run build --workspace api` |
| **Full suite command** | `npm run typecheck && npm run build --workspace frontend && npm run build --workspace api` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build --workspace frontend && npm run build --workspace api`
- **After every plan wave:** Full typecheck + build
- **Before `/gsd:verify-work`:** Full suite must be green + production smoke test complete
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 04-01-01 | 01 | 1 | staticwebapp.config.json placement | N/A | build | `npm run build --workspace frontend` | ⬜ pending |
| 04-01-02 | 01 | 1 | apiRuntime node:20 in config | N/A | lint/read | `grep -c "node:20" frontend/public/staticwebapp.config.json` | ⬜ pending |
| 04-02-01 | 02 | 1 | GitHub Actions validate.yml | No secrets in workflow | CI | `gh workflow list` | ⬜ pending |
| 04-02-02 | 02 | 1 | GitHub Actions deploy.yml | Token in secrets, not source | CI | `grep -c "AZURE_STATIC_WEB_APPS_API_TOKEN" .github/workflows/deploy.yml` | ⬜ pending |
| 04-03-01 | 03 | 2 | SWA provisioned | N/A | manual | `az staticwebapp show --name <name>` | ⬜ pending |
| 04-03-02 | 03 | 2 | Storage tables created | N/A | manual | `az storage table exists --name VehicleCache` | ⬜ pending |
| 04-03-03 | 03 | 2 | App settings configured | No secrets in source | manual | `az staticwebapp appsettings list` | ⬜ pending |
| 04-04-01 | 04 | 2 | Production smoke test | N/A | manual | Browser verify 3 plates | ⬜ pending |
| 04-04-02 | 04 | 2 | Cache read/write in prod | N/A | manual | Check cache metadata in response | ⬜ pending |
| 04-04-03 | 04 | 2 | local.settings.json scrubbed | Real key not in file | security | `grep -c "sk-ant" api/local.settings.json` returns 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

This phase is infrastructure/deployment — no new test stubs required. Existing test suite covers the codebase correctness:
- `npm run typecheck` — TypeScript compilation
- `npm run build --workspace frontend` — Next.js static export
- `npm run build --workspace api` — esbuild API bundle

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SWA routes requests correctly | Direct links and refreshes work | Requires provisioned Azure resource | Navigate to `/kenteken/PF655T` directly (no home page first); verify page loads |
| Cache read/write against Azure Tables | Cache works in production | Requires provisioned Storage | Make two requests for same plate; second response has `cache_hit: true` in manifest |
| Cold start timing | Cold start timings documented | Requires production traffic | Restart Functions, then time first request with `time curl <url>` |
| Warm lookup timing | Warm lookup timings documented | Requires production traffic | Time cached request |
| Application Insights receiving data | Observability | Requires Azure portal | Check Live Metrics in Azure portal after deploying |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual instructions
- [ ] No secrets committed to source
- [ ] Production smoke test: at least 3 diverse plates verified
- [ ] Cache hit verified in production
- [ ] Cold start and warm timings documented in README or DEPLOY.md
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
