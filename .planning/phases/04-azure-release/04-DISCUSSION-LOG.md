# Phase 4: Azure Release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 04-azure-release
**Areas discussed:** Deployment trigger, Provisioning approach, LLM provider in production

---

## Deployment Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Push to main (auto) | Deploy automatically on every merge to main | ✓ |
| Manual trigger only | workflow_dispatch only — full control over timing | |
| Both | Auto on push + manual override | |

**User's choice:** Push to main (auto)
**Notes:** Also asked about CI gate (typecheck + tests before deploy). User chose "No — deploy directly." Fast path: push → deploy.

---

## Provisioning Approach / Deployment Target

| Option | Description | Selected |
|--------|-------------|----------|
| Azure Static Web Apps (SWA) | Hosts static frontend + managed Functions; same-domain routing | ✓ |
| App Service + separate Functions App | Reuse workforceplanning workflow exactly | considered then rejected |

**User's choice:** SWA (after exploring App Service)

**Notes:** User initially asked about reusing the workforceplanning deploy workflow to target App Service. Investigated the workforceplanning repo — it deploys a standalone Next.js app to Azure App Service via blob storage zip. Key finding: workforceplanning pattern doesn't directly translate because KentekenMagic's browser makes relative `/api/*` calls; on App Service + separate Functions App this creates a cross-origin problem requiring either frontend code changes (`NEXT_PUBLIC_API_URL`) or App Service reverse-proxy config. User chose SWA to avoid frontend code changes.

Auth method: SWA deployment token (`AZURE_STATIC_WEB_APPS_API_TOKEN`), not OIDC. Provisioning: manual Portal/CLI, documented in `DEPLOY.md`.

Reuse from workforceplanning: `validate.yml` structure (Node.js setup, `npm ci`, caching) adapted for monorepo paths.

---

## LLM Provider in Production

| Option | Description | Selected |
|--------|-------------|----------|
| Anthropic only (Claude) | Set only ANTHROPIC_API_KEY; consistent with Phase 2 | ✓ |
| Both — Anthropic primary, OpenAI fallback | Set both keys; requires fallback logic | |
| Skip enrichment in production | No LLM key set; enrichment disabled | |

**User's choice:** Anthropic only
**Notes:** Consistent with Phase 2 decision to use Claude for enrichment.

---

## Claude's Discretion

- Exact Azure resource names (SWA instance, storage account, resource group)
- `DEPLOY.md` structure and content depth
- Application Insights: no custom telemetry beyond `host.json` defaults

## Deferred Ideas

- **Custom domain** — ship on `*.azurestaticapps.net` for v1
- **IaC / Bicep** — manual provisioning sufficient for personal v1
- **App Service target** — rejected in this discussion due to cross-origin routing complexity
