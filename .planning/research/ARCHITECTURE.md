# Architecture Patterns — KentekenMagic

**Domain:** Dutch license plate lookup — multi-source data aggregation, serverless, consumer UI
**Researched:** 2026-05-20
**Overall confidence:** HIGH (all claims verified against Microsoft Learn official documentation)

---

## Recommended Architecture

```
Browser (SWA)
  │
  ├── GET /api/vehicle/{plate}          ← single aggregator function
  │       │
  │       ├── cache check (Azure Tables)
  │       │       hit → return immediately
  │       │       miss ↓
  │       │
  │       ├── Promise.all([             ← parallel fan-out, in-process
  │       │     rdwSource(plate),
  │       │     apkSource(plate),
  │       │     recallSource(plate),
  │       │     ... N sources
  │       │   ]) with per-source timeout + catch
  │       │
  │       ├── write aggregate to Tables cache
  │       │
  │       └── return { manifest, cards: { rdw: {...}, apk: {...}, ... } }
  │
  └── POST /api/enrich/{plate}          ← separate async LLM enrichment function
          │
          ├── read cached vehicle data from Tables
          ├── call LLM (GPT-4o-mini / Claude Haiku)
          ├── write LLM summary to Tables (long TTL)
          └── return { summary, insights[] }
```

---

## Decision 1: Data Fetching Architecture

**Recommendation: Single aggregator Function with in-process `Promise.all` fan-out.**

Do NOT use Durable Functions for this workload. Do NOT have the frontend call multiple Functions.

### Why not Durable Functions

Durable Functions add meaningful overhead: they require Azure Storage for orchestration state (extra Tables/Blobs I/O), introduce replay logic, and cold-start latency increases. For a synchronous request/response lookup completing in under 2 seconds, the fan-out/fan-in value of Durable Functions does not justify its cost — both in latency and in billing complexity. Durable Functions are designed for long-running workflows (minutes to hours), not sub-second parallel HTTP calls.

The free grant on the Consumption plan is 1 million executions + 400,000 GB-seconds/month. A single aggregator Function that completes in ~800ms uses far less budget than 4–6 separate Functions orchestrated through Durable infrastructure.

### Why not multiple Functions called from the frontend

Multiple frontend-initiated parallel calls means multiple cold starts on idle runtimes, multiple CORS preflight round-trips, and CORS configuration complexity. It also leaks your internal data source topology to the client, making the plugin system fragile. The aggregator pattern keeps internal source structure hidden and provides a single cache check/write.

### In-process fan-out implementation pattern

```typescript
// api/src/functions/vehicle.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sourceRegistry } from '../sources/registry';
import { getCached, setCached } from '../cache/tableCache';

export async function vehicleLookup(
  req: HttpRequest,
  ctx: InvocationContext
): Promise<HttpResponseInit> {
  const plate = normalizePlate(req.params.plate);

  // 1. Cache check — fast path
  const cached = await getCached(plate);
  if (cached) {
    return { status: 200, jsonBody: { ...cached, fromCache: true } };
  }

  // 2. Fan-out: all registered sources run in parallel
  const results = await Promise.allSettled(
    sourceRegistry.map(source =>
      Promise.race([
        source.fetch(plate),
        timeout(source.timeoutMs ?? 3000, source.id)
      ])
    )
  );

  // 3. Build response — partial failure is fine
  const cards: Record<string, unknown> = {};
  const manifest: string[] = [];
  for (let i = 0; i < sourceRegistry.length; i++) {
    const r = results[i];
    const source = sourceRegistry[i];
    if (r.status === 'fulfilled') {
      cards[source.id] = r.value;
      manifest.push(source.id);
    } else {
      ctx.log(`Source ${source.id} failed: ${r.reason}`);
      cards[source.id] = { error: true };
    }
  }

  const payload = { manifest, cards, plate, fetchedAt: new Date().toISOString() };

  // 4. Cache write (fire-and-forget, don't await)
  setCached(plate, payload).catch(e => ctx.log('Cache write failed', e));

  return { status: 200, jsonBody: payload };
}

app.http('vehicle', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'vehicle/{plate}',
  handler: vehicleLookup,
});
```

### Partial failure handling

Use `Promise.allSettled` (not `Promise.all`). Each source wrapped in a per-source `Promise.race` against a timeout. If a source times out or throws, its card gets `{ error: true, reason: 'timeout' | 'unavailable' }`. The frontend renders an error state for that card, not a blank screen. The manifest lists only successfully-loaded cards so the UI knows what to render.

---

## Decision 2: Plugin / Extensible Data Source Pattern

**Recommendation: A `DataSource` interface + auto-registered source registry loaded at module init.**

Adding a new data source = creating one new file in `api/src/sources/`. No backend structural changes needed.

### DataSource interface

```typescript
// api/src/sources/types.ts

export interface DataSource<T = unknown> {
  /** Unique identifier — becomes the card key in the response */
  readonly id: string;

  /** Human-readable name for logging */
  readonly name: string;

  /** Per-source timeout in ms. Default: 3000 */
  readonly timeoutMs?: number;

  /** Cache TTL in seconds for this source's data. Default: 3600 */
  readonly cacheTtlSeconds?: number;

  /** Fetch data for a normalized plate string */
  fetch(plate: string): Promise<T>;
}
```

### Registry: auto-discover by convention

```typescript
// api/src/sources/registry.ts
import { rdwVehicle } from './rdwVehicle';
import { rdwApk } from './rdwApk';
import { rdwRecalls } from './rdwRecalls';
// Adding a new source: import it here, add to array. That's it.

export const sourceRegistry: DataSource[] = [
  rdwVehicle,
  rdwApk,
  rdwRecalls,
];
```

A single import + array push is the only structural change required. No config files, no database entries.

### Example source implementation

```typescript
// api/src/sources/rdwVehicle.ts
import type { DataSource } from './types';

export interface RdwVehicleData {
  kenteken: string;
  merk: string;
  handelsbenaming: string;
  vervaldatum_apk: string;
  datum_eerste_toelating: string;
  voertuigsoort: string;
  // ... full RDW field set
}

export const rdwVehicle: DataSource<RdwVehicleData> = {
  id: 'rdw_vehicle',
  name: 'RDW Basisregistratie',
  timeoutMs: 4000,
  cacheTtlSeconds: 3600, // 1h — registration data rarely changes

  async fetch(plate: string): Promise<RdwVehicleData> {
    const url = `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${plate}&$limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RDW ${res.status}`);
    const data = await res.json();
    if (!data.length) throw new Error('Plate not found');
    return data[0];
  },
};
```

### Frontend card manifest

The API response includes a `manifest: string[]` listing which source IDs returned successfully. The frontend maps each ID to a card component:

```typescript
// frontend card registry (client-side)
const CARD_COMPONENTS: Record<string, React.ComponentType<any>> = {
  rdw_vehicle: VehicleOverviewCard,
  rdw_apk:     ApkHistoryCard,
  rdw_recalls: RecallsCard,
};

// Render only cards in manifest
manifest.map(id => {
  const Card = CARD_COMPONENTS[id];
  return Card ? <Card key={id} data={cards[id]} /> : null;
});
```

If a new source is added backend-only but the frontend has no registered card yet, it gracefully no-ops. This means frontend and backend can be deployed independently.

---

## Decision 3: Azure Tables Cache Design

**Azure Table Storage has no native TTL.** Simulate TTL with an `expiresAt` field and check it on read.

### Table schema

**Table name:** `VehicleCache`

| Field | Type | Value |
|-------|------|-------|
| `PartitionKey` | string | First two normalized plate characters, e.g. `"AB"` |
| `RowKey` | string | Normalised plate (see below) |
| `data` | string (JSON) | Full serialised aggregate payload |
| `fetchedAt` | string (ISO-8601) | When data was fetched |
| `expiresAt` | string (ISO-8601) | `fetchedAt + TTL` |
| `sourceVersions` | string (JSON) | `{ rdw_vehicle: "2026-05-20", ... }` for future cache invalidation |

### Plate normalisation (cache key)

Dutch plates use letter/digit groups separated by hyphens or spaces. Normalise before any cache read/write:

```typescript
function normalizePlate(raw: string): string {
  // Strip non-alphanumeric, uppercase
  return raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // e.g. "AB-12-CD" → "AB12CD", "ab 12 cd" → "AB12CD"
}
```

The normalised form is used as both the lookup key and the cache RowKey. Never store the raw format.

### TTL strategy by data type

| Data | Source | Recommended TTL | Rationale |
|------|--------|-----------------|-----------|
| RDW base registration (specs, owner changes) | RDW kentekens API | 4 hours | Changes on ownership transfer, not real-time |
| APK (MOT) history | RDW `sgfe-77wx` inspections dataset | 24 hours | APK dates are periodic, no benefit to fresher data |
| Safety recalls | RAPEX / RDW terugroepacties | 12 hours | Recalls added occasionally, not minute-to-minute |
| LLM summary | Computed | 7 days | Expensive to recompute; re-run only on stale base data |
| Fuel/emissions data | RDW brandstof | 24 hours | Static for most vehicles |

### Cache read/write helper

```typescript
// api/src/cache/tableCache.ts
import { TableClient, odata } from '@azure/data-tables';

const TABLE = 'VehicleCache';

function cachePartition(plate: string): string {
  return plate.slice(0, 2);
}

const client = new TableClient(
  process.env.AZURE_STORAGE_TABLE_ENDPOINT!,
  TABLE,
  // Uses DefaultAzureCredential in production (managed identity),
  // connection string in local dev via local.settings.json
);

export async function getCached(plate: string) {
  try {
    const entity = await client.getEntity(cachePartition(plate), plate);
    const expiresAt = new Date(entity.expiresAt as string);
    if (expiresAt > new Date()) {
      return JSON.parse(entity.data as string);
    }
    // Stale — treat as miss (delete async, don't block)
    client.deleteEntity(cachePartition(plate), plate).catch(() => {});
    return null;
  } catch (e: any) {
    if (e.statusCode === 404) return null;
    throw e;
  }
}

export async function setCached(
  plate: string,
  payload: unknown,
  ttlSeconds = 3600
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  await client.upsertEntity({
    partitionKey: cachePartition(plate),
    rowKey: plate,
    data: JSON.stringify(payload),
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }, 'Replace');
}
```

### LLM summary cache — separate table

Use a separate `LlmSummaryCache` table with the same PartitionKey/RowKey pattern. This decouples LLM cache invalidation from vehicle data cache invalidation. When base vehicle data is refreshed (TTL expired), the LLM summary can persist independently and be re-evaluated by comparing `fetchedAt` timestamps.

---

## Decision 4: Progressive Loading Pattern

**Recommendation: Single API call returns full payload; frontend renders progressively from the same response. No manifest-then-cards multi-fetch needed.**

The aggregator Function collects all sources in one call (~800ms total with parallel execution). The response is structured so the frontend can render the most important card (RDW base data) first and populate secondary cards as React state updates. This is simpler and cheaper than multiple sequential requests.

### Two-phase UI loading model

**Phase 1 — Skeleton → Core data (~0–500ms)**
The `rdw_vehicle` source is the fastest (single RDW API call). Structure the response so this is the first field clients check. Render the vehicle overview card as soon as this is available.

**Phase 2 — Secondary cards fill in (~500–2000ms)**
APK, recalls, emissions arrive in the same response but may take longer. Use optimistic skeleton cards that resolve from the same data object.

Since the Function awaits `Promise.allSettled`, the full response only returns when the slowest source finishes or times out. For perceived performance, set aggressive per-source timeouts (3s max), so the Function always returns within ~3.5s (cold start + network).

### If true streaming is needed later

Azure Functions v4 Node.js supports HTTP streaming via `app.setup({ enableHttpStream: true })` with `Content-Type: text/event-stream`. This can be used to flush the `rdw_vehicle` card as soon as it arrives, while other sources are still fetching. This is an optional progressive enhancement — start without it, add if cold start latency on secondary sources becomes a user problem.

### Frontend pattern (React)

```tsx
// Not streaming yet — full payload on resolve
const { data, isLoading } = useVehicleLookup(plate);

return (
  <div>
    {/* Core card renders immediately when data arrives */}
    <VehicleOverviewCard data={data?.cards.rdw_vehicle} loading={isLoading} />

    {/* Secondary cards render from same data object */}
    {data?.manifest.includes('rdw_apk') && (
      <ApkHistoryCard data={data.cards.rdw_apk} />
    )}
    {data?.manifest.includes('rdw_recalls') && (
      <RecallsCard data={data.cards.rdw_recalls} />
    )}
  </div>
);
```

---

## Decision 5: GitHub Actions CI/CD

**Two separate workflows, triggered on the same push.**

Azure Static Web Apps has its own built-in GitHub Actions action (`Azure/static-web-apps-deploy@v1`) that handles both the frontend build and the managed Functions deployment in one step. For a "bring your own Functions" setup (linked external Function App), use two separate workflows.

**Recommended: use the built-in managed API integration** (Functions code lives in `api/` folder, same repo). This means one workflow file, one deployment, zero CORS configuration needed (SWA proxies `/api/*` to the managed Functions automatically).

```yaml
# .github/workflows/azure-static-web-apps.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event.action != 'closed')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: 'upload'
          app_location: 'frontend'
          api_location: 'api'
          output_location: 'dist'

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: 'close'
```

**Key CI/CD notes:**
- SWA automatically creates staging environments for PRs (each PR gets its own preview URL). Free on the free plan.
- The `api/` folder must contain a valid `host.json` and `package.json`.
- For separate Function App deployment (if you outgrow managed Functions), use `Azure/functions-action@v1` in a second workflow job with `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` as a secret.
- TypeScript must be compiled before deploy: include `npm run build` in the workflow step.

---

## Decision 6: LLM Enrichment Architecture

**Recommendation: LLM call runs in a separate Azure Function, invoked by the frontend after core data loads. Result is cached in Azure Tables with a 7-day TTL.**

### Why not in-process with the aggregator

Adding LLM latency (300–1500ms for GPT-4o-mini/Claude Haiku) to the aggregator Function would push total response time over the 2s target. LLM output is also deterministic for a given vehicle's data — there is no value in re-running it on every lookup.

### Enrichment flow

```
1. Frontend calls GET /api/vehicle/{plate}
   → Gets vehicle data in ~800ms, renders core cards

2. Frontend calls POST /api/enrich/{plate}  (after core renders)
   → Function checks LlmSummaryCache table
       HIT (< 7 days old): return cached summary immediately (~30ms)
       MISS: call LLM, cache result, return (~800ms)

3. Frontend updates UI with summary card / flagged insights
```

### Enrichment Function

```typescript
// api/src/functions/enrich.ts
app.http('enrich', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'enrich/{plate}',
  handler: async (req, ctx) => {
    const plate = normalizePlate(req.params.plate);

    // Check LLM cache first
    const cached = await getLlmCached(plate);
    if (cached) return { status: 200, jsonBody: { ...cached, fromCache: true } };

    // Load vehicle data from cache (must exist — client called /vehicle first)
    const vehicleData = await getCached(plate);
    if (!vehicleData) {
      return { status: 404, jsonBody: { error: 'Vehicle data not in cache' } };
    }

    const summary = await callLlm(vehicleData);

    await setLlmCached(plate, summary, 7 * 24 * 3600);

    return { status: 200, jsonBody: { summary, fromCache: false } };
  }
});
```

### LLM provider selection

Use Azure OpenAI (GPT-4o-mini) if Azure credits are available. Fall back to OpenAI API directly or Anthropic API (Claude Haiku). Keep the LLM provider behind a thin abstraction (`callLlm(data)`) so it can be swapped without changing the Function. Store the API key in Azure Functions Application Settings (environment variables) — never in source.

### Cost guard

Each LLM call on a cache miss processes ~500–2000 tokens (vehicle data + prompt). At GPT-4o-mini pricing (~$0.15/1M input tokens), 10,000 unique plate lookups/month ≈ $0.15–0.30 in LLM costs. The 7-day cache prevents re-running for repeat lookups of the same plate.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `frontend/` | SPA — plate input, card rendering, progressive UI states | `/api/vehicle/*`, `/api/enrich/*` via fetch |
| `api/src/functions/vehicle.ts` | Aggregate lookup — fan-out to sources, cache check/write | All data sources (external HTTP), Azure Tables |
| `api/src/functions/enrich.ts` | LLM enrichment — async after core data renders | Azure Tables (read vehicle cache), LLM API |
| `api/src/sources/registry.ts` | Source registry — ordered list of DataSource implementations | Imported by `vehicle.ts` |
| `api/src/sources/*.ts` | Individual data source modules — each fetches one external API | External APIs (RDW, RAPEX, etc.) |
| `api/src/cache/tableCache.ts` | Cache abstraction — read/write/TTL logic for Azure Tables | Azure Tables SDK |
| Azure Tables `VehicleCache` | Vehicle aggregate cache | Written/read by `vehicle.ts` |
| Azure Tables `LlmSummaryCache` | LLM output cache | Written/read by `enrich.ts` |

---

## Project Folder Structure

```
kentekenmagic/
├── frontend/                    # SPA (React + Vite or Next.js static export)
│   ├── src/
│   │   ├── components/cards/    # One card component per data source
│   │   ├── hooks/useVehicle.ts
│   │   └── ...
│   ├── public/
│   └── staticwebapp.config.json # SWA routing rules
│
├── api/                         # Azure Functions (Node.js v4, TypeScript)
│   ├── src/
│   │   ├── functions/
│   │   │   ├── vehicle.ts       # Main aggregator endpoint
│   │   │   └── enrich.ts        # LLM enrichment endpoint
│   │   ├── sources/
│   │   │   ├── types.ts         # DataSource interface
│   │   │   ├── registry.ts      # Auto-import all sources here
│   │   │   ├── rdwVehicle.ts    # RDW base registration
│   │   │   ├── rdwApk.ts        # APK/MOT history
│   │   │   └── rdwRecalls.ts    # Safety recalls
│   │   ├── cache/
│   │   │   └── tableCache.ts    # Azure Tables abstraction
│   │   └── index.ts             # app.setup({ ... })
│   ├── host.json
│   ├── local.settings.json      # .gitignored — connection strings
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml
│
└── .planning/
```

---

## Scalability Considerations

| Concern | At current free tier | At 10K+ lookups/day |
|---------|---------------------|---------------------|
| Functions cold starts | ~400–800ms on first request; warm for burst | Switch to Flex Consumption plan for always-ready instances |
| Tables throughput | Well within free tier (20K transactions/month free included in Storage account) | Tables scales to thousands of transactions/second; no action needed |
| RDW API rate limits | RDW opendata.nl has no published key/rate limits for basic GET queries | Add retry-with-backoff in source; consider mirroring if needed |
| LLM cost | ~$0.01–0.30/month for typical usage | 7-day cache makes this scale linearly only with unique plates, not total lookups |
| SWA bandwidth | Free plan: 100GB/month | Upgrade to Standard plan ($9/month) — generous free tier first |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Durable Functions for short-lived fan-out
**What:** Using Durable Functions orchestrator/activity pattern for parallel HTTP calls
**Why bad:** Storage overhead, replay latency, complexity, increased billing. Designed for workflows measured in minutes, not milliseconds.
**Instead:** `Promise.allSettled` in a single Function.

### Anti-Pattern 2: Frontend calling multiple Functions in parallel
**What:** Browser makes 4–6 separate API calls to individual source Functions
**Why bad:** Multiple cold starts, CORS complexity, cache coherence issues, exposes internal topology
**Instead:** Single aggregator Function on the backend.

### Anti-Pattern 3: Storing raw plate as cache key
**What:** Cache key uses user-typed plate string as-is
**Why bad:** "AB-12-CD", "AB 12 CD", "ab12cd" all represent the same plate but produce cache misses
**Instead:** Always normalize to stripped uppercase before any cache operation.

### Anti-Pattern 4: Blocking the UI on LLM enrichment
**What:** Main `/api/vehicle` call waits for LLM before responding
**Why bad:** 800–1500ms additional latency, fails loudly if LLM API is down
**Instead:** Separate `/api/enrich` call initiated by the frontend after core data renders.

### Anti-Pattern 5: Storing LLM API keys in source or function.json
**What:** Hardcoding `OPENAI_API_KEY` anywhere in checked-in code
**Why bad:** Secret exposure in git history
**Instead:** Azure Functions Application Settings (portal/CLI), referenced as `process.env.OPENAI_API_KEY` in code.

---

## Sources

- Azure Functions consumption plan free grant and costs: https://learn.microsoft.com/en-us/azure/azure-functions/functions-consumption-costs (HIGH confidence)
- Azure Functions v4 Node.js HTTP trigger TypeScript: https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger (HIGH confidence)
- Azure Functions HTTP streaming (`enableHttpStream`): https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node (HIGH confidence)
- Durable Functions fan-out/fan-in pattern: https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-hubs (HIGH confidence)
- Durable Functions cold start and plan considerations: https://learn.microsoft.com/en-us/azure/durable-task/common/choose-orchestration-framework (HIGH confidence)
- Azure Table Storage partition/row key design: https://learn.microsoft.com/en-us/azure/architecture/best-practices/data-partitioning-strategies (HIGH confidence)
- Azure Table Storage upsertEntity TypeScript SDK: https://learn.microsoft.com/en-us/azure/cosmos-db/table/quickstart-nodejs (HIGH confidence)
- Azure Static Web Apps + linked Functions API: https://learn.microsoft.com/en-us/azure/static-web-apps/functions-bring-your-own (HIGH confidence)
- SWA GitHub Actions workflow: https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/azure-static-web-app-v0 (HIGH confidence)
- GitHub Actions Azure Functions Node deploy: https://learn.microsoft.com/en-us/azure/azure-functions/functions-how-to-github-actions (HIGH confidence)
- Flex Consumption plan always-ready instances: https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs (HIGH confidence)
