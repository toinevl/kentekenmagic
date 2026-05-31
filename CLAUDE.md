# KentekenMagic

Dutch license-plate (kenteken) lookup app. Enters a plate → returns RDW vehicle data, APK/recall status, and modifications, plus an async Claude-generated summary.

## Project Structure

npm-workspaces monorepo with two workspaces: `frontend` (Next.js static export) and `api` (Azure Functions, TypeScript). The root `package.json` orchestrates both.

- **Always run builds/servers from the repo root via workspace scripts**, not by calling binaries directly. Direct binary paths have repeatedly failed here.
  - Frontend dev: `npm run dev:frontend`
  - API local: `npm run start:api` (builds, then `func start`)
  - Build everything: `npm run build`
  - Typecheck/test all: `npm run typecheck` / `npm run test`

## Build & Deploy

**After editing any TypeScript in `api/src/` — especially adding/changing files under `api/src/sources/` — rebuild the API before testing.** The API serves from compiled `dist/`, and a stale `dist/` has caused missing data more than once (e.g. recall/modifications fields silently absent because new source modules were never compiled).

```
npm run build --workspace api   # tsc → api/dist
```

`start:api` already rebuilds first; a bare `func start` does not.

### Adding a new Azure Function

Functions are registered by **side-effect imports in `api/src/index.ts`** (e.g. `import "./functions/vehicle.js";`). A new function file under `api/src/functions/` will not be registered until you add its import to `index.ts`. Note imports use the `.js` extension (compiled-output paths), not `.ts`.

### Pre-deploy checklist (before pushing to trigger deployment)

Deployment is GitHub Actions → Azure Static Web Apps, triggered on **push to `main`** (`.github/workflows/deploy.yml`). The workflow pre-builds frontend and API and sets `skip_app_build: true` so Azure/Oryx does **not** rebuild — this is intentional and resolves the recurring Oryx failures. Before pushing, verify:

- `api/package.json` `main` is `dist/src/index.js` (wrong main field has broken Functions discovery before).
- `api/src/index.ts` imports every function file you intend to deploy.
- `api/host.json` has no explicit `extensionBundle` version pin (removing the pin fixed a Functions deploy failure).
- Frontend builds to `frontend/out` (the workflow's `app_location`); `api_location` is `api`.
- Do **not** link the SWA via the Azure Portal — it generates a conflicting deployment-token secret name. See `DEPLOY.md`.

Full provisioning runbook (resource group, storage tables, app settings): `DEPLOY.md`.

## Tech Notes

- API uses Azure Functions v4 programming model, Node 22 runtime (`staticwebapp.config.json` → `apiRuntime: node:22`; node:22 is the newest version SWA managed functions support — node:24 is NOT supported), compiled to CommonJS.
- Vehicle data is aggregated from multiple RDW sources (`api/src/sources/`) with table-storage caching; enrichment calls the Claude API with prompt caching.
- Frontend build uses `NEXT_BUILD_EXPORT=1` for static export.
