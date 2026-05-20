# Domain Pitfalls: KentekenMagic

**Domain:** Dutch license plate lookup / open-data aggregator on Azure serverless
**Researched:** 2026-05-20
**Confidence:** HIGH for Azure and LLM pitfalls (verified via official docs); MEDIUM for RDW specifics (verified Socrata platform, RDW-specific quirks from domain knowledge)

---

## Critical Pitfalls

Mistakes that cause rewrites, runaway costs, or broken core functionality.

---

### Pitfall 1: Socrata Throttling Without an App Token

**What goes wrong:** opendata.rdw.nl runs on the Socrata SODA platform. Unauthenticated requests are throttled at the IP level with very low limits (undocumented, but community reports suggest ~1,000 req/hr per IP without a token). The Azure Functions consumption plan allocates IPs from a shared pool. Multiple function instances — or multiple apps sharing an egress IP — will compete for the same unauthenticated quota, causing 429s under modest traffic with no warning in the RDW docs.

**Why it happens:** The RDW portal says "no key required," which is literally true — but the Socrata platform behind it enforces per-IP throttling that becomes a shared-IP problem on serverless.

**Consequences:** Intermittent 429 errors on lookup, appearing only at moderate load. Impossible to reproduce locally. Confusing because the app seems to work fine in testing.

**Prevention:**
- Register a free Socrata app token at opendata.rdw.nl and send it via `X-App-Token` header on every request. This gives a dedicated pool of 1,000 req/rolling-hour per token (HIGH confidence — verified Socrata docs).
- Register multiple tokens if expecting >1,000 req/hr and implement token rotation in the Function.
- Cache aggressively in Azure Tables: store full RDW response per plate with a TTL of 24h. A cached hit costs zero API quota.

**Warning signs:** Intermittent 503/429 from the RDW endpoint that go away on retry; errors that only appear after >50 lookups in an hour.

**Phase to address:** Phase 1 (first RDW integration). Get the token before writing the first fetch call.

**Source:** https://dev.socrata.com/docs/app-tokens.html (MEDIUM confidence on exact per-IP limit, HIGH on token requirement and 1,000 req/hr per token)

---

### Pitfall 2: Dutch License Plate Format Edge Cases Breaking Lookups

**What goes wrong:** The RDW API URL uses the license plate as a path or query parameter. Dutch plates have evolved through 11+ "sidecodes" and several special categories. If the normalization step strips or mangles characters, the lookup silently returns 0 results instead of an error.

**Format specifics (MEDIUM confidence — domain knowledge, verify against RDW dataset fields):**

| Category | Example | Gotcha |
|----------|---------|--------|
| Modern sidecodes (1-10) | `XX-999-X` | Hyphens may or may not be present in user input |
| Old-style (sidecodes 1-3) | `AB-12-CD` | Same pattern, different position of letters/digits |
| Diplomatic plates | `CD AB-12` | Space + prefix; not in standard public dataset |
| Dealer/trade plates | `O AB-12` | `O` prefix; limited RDW data returned |
| Temporary export plates | `Z AB-12` | `Z` prefix; MOT/APK data absent |
| Military plates | `11-AA-11` | Returned in RDW dataset but MOT data missing |
| Moped plates (bromfietsen) | `AA-12-BB` | Separate RDW dataset endpoint, not the main `gekentekende_voertuigen` |

**Consequences:** A user types `AB-12-CD` with spaces or lowercase; the API returns empty; the app shows "not found" for a valid plate.

**Prevention:**
- Normalise all input to uppercase, strip spaces and hyphens before querying.
- Implement a regex validator covering all known sidecode patterns; show a friendly error for unrecognized formats rather than a failed API call.
- When the main lookup returns empty, do NOT show "plate not found" immediately — check whether the plate matches a known special prefix (O, Z, CD) and show a contextual message.
- Mopeds are in a separate endpoint (`geregistreerde_voertuigen` or `bromfietsen` dataset) — handle separately.

**Warning signs:** User reports of "not found" for plates they can see in front of them. Lookups for plates starting with O or Z always empty.

**Phase to address:** Phase 1 — build the normalizer before any UI work.

---

### Pitfall 3: Azure Functions Cold Start on Consumption Plan

**What goes wrong:** The consumption plan scales to zero after inactivity. For a Node.js function with non-trivial dependencies (HTTP clients, Azure SDK, LLM client), cold start on consumption can exceed 3–5 seconds on the first request after idle, completely destroying the "sub-2s perceived" goal.

**Why it happens:** Azure loads and initializes the entire Node runtime, your module graph, and any SDK initialization on first invocation. The more `require()`/`import` calls at module level, the longer the cold start. (HIGH confidence — verified via Azure Functions official docs.)

**Consequences:** The first user after a quiet period gets a 3–5s spinner for what should be a <1s experience. If the app is used sporadically (e.g. early in the project life), every lookup is effectively a cold start.

**Prevention (in priority order):**
1. **Run from package** (`WEBSITE_RUN_FROM_PACKAGE=1`): Deploy as a zip package rather than extracted files. Azure can warm the module cache faster from a single zip. The Azure docs explicitly call this out for cold start mitigation.
2. **Lazy-load heavy SDKs**: Do not import the Azure SDK or LLM client at module top level. Import inside the handler or use dynamic `import()` at first invocation.
3. **Minimize `node_modules`**: Use `esbuild` to bundle the function to a single file. A single-file bundle with tree-shaking eliminates the file I/O cost of scanning thousands of `node_modules` files on startup.
4. **Consider Flex Consumption plan**: Microsoft's Flex Consumption plan (now GA) offers "always ready instances" that eliminate cold start for free at low scale. The official docs explicitly recommend Flex Consumption over standard Consumption for latency-sensitive apps. Pricing remains consumption-based.
5. **Avoid Premium plan** for this project: Premium eliminates cold start completely but has a minimum instance cost (~€115/month) that violates the budget constraint.

**Warning signs:** P99 latency spikes on first request after 15+ min idle; local dev feels fast but prod feels slow.

**Phase to address:** Phase 1 (Azure setup). Make the "run from package" decision at deployment scaffold time — retrofitting is painful.

**Source:** https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale (HIGH confidence)

---

### Pitfall 4: LLM Cost Runaway — Every Lookup Triggers an LLM Call

**What goes wrong:** If the Azure Function calls the LLM on every plate lookup, and the cache is not hit (new plate or cache miss), and traffic spikes — costs can balloon unexpectedly. At GPT-4o-mini pricing (~$0.15/1M input tokens), a 500-token prompt × 10,000 lookups/day = 5M tokens = $0.75/day, which seems fine. But if the prompt includes the full RDW response payload (potentially 2,000–5,000 tokens per vehicle), 10,000 lookups × 3,000 tokens = 30M tokens/day = $4.50/day. At scale or with a viral spike, this compounds quickly.

**Why it happens:** Engineers assume "cheap model = safe" and skip metering. LLM calls are async fire-and-forget, making it easy to not notice the bill accumulating.

**Consequences:** Unexpected bill spike. Azure OpenAI free credits exhausted in days instead of weeks. No budget guardrail in place.

**Prevention:**
1. **Cache LLM output in Azure Tables**: Store the generated summary keyed on plate + data hash. The LLM only runs on first lookup for a given plate. A cached hit costs zero.
2. **Hard token budget**: Truncate the input payload to a fixed token budget (e.g. 800 tokens) before sending to the LLM. Strip raw numeric arrays (APK history has many rows) and send only summaries.
3. **Set spend limits**: Azure OpenAI allows configuring a token-per-minute cap. OpenAI allows usage threshold email alerts (verified — OpenAI production best practices docs). Enable both on day one.
4. **Make LLM non-blocking**: The Function returns core data immediately, the LLM call happens in a background job (Azure Queue or just `Promise` without `await`). If the LLM is slow or errors, the user never sees it.
5. **Circuit breaker**: If the LLM has failed 3 times in the last 60 seconds, skip the call and return null for the enrichment field rather than retrying.

**Warning signs:** LLM enrichment field always populated (cache not working). Azure cost dashboard showing >$1/day before significant traffic.

**Phase to address:** Phase 2 (LLM integration). Do not wire up LLM before caching layer exists.

---

### Pitfall 5: Azure Table Storage — Hot Partition from Naive Key Design

**What goes wrong:** Azure Table Storage has no secondary indexes. Only PartitionKey + RowKey are indexed. All queries on any other field result in full table scans. Additionally, putting all plates in a single partition (e.g. `PartitionKey = "plates"`) makes the partition a hot spot — all reads and writes hit one storage node, which throttles at 20,000 req/s per partition.

**Why it happens:** The naive design is `PartitionKey = "plates"`, `RowKey = "AB-12-CD"` — seems logical. But it means all cache reads are on one partition.

**Consequences:** Throttling at scale. All queries slower than expected. Impossible to query "all lookups in the last hour" without a full table scan.

**Prevention:**
- Use the first 2 characters of the plate as `PartitionKey` (e.g. `"AB"`) and the full plate as `RowKey`. This distributes load across 676 partitions while keeping exact-match lookups efficient (always PartitionKey + RowKey = single entity lookup, the fastest operation).
- Store a `timestamp` field for TTL-based expiry logic, but never query by timestamp alone — always query by PartitionKey + RowKey.
- For analytics (lookup counts, popular plates), use a separate Azure Queue + Azure Table with a different schema, not the cache table.

**Warning signs:** Lookup latency increasing with table size. Azure Storage metrics showing 503s from "server busy" on a single partition.

**Source:** https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-design (HIGH confidence)

**Phase to address:** Phase 1 (infrastructure setup). Key design cannot be changed without a full table migration.

---

## Moderate Pitfalls

---

### Pitfall 6: Azure Static Web Apps — SPA Routing Returns 404 on Deep Links

**What goes wrong:** SWA serves a static SPA. If a user navigates directly to `/plate/AB-12-CD` or refreshes on that URL, SWA returns a real 404 because there is no file at that path. React/Vue/Svelte client-side routing only works after the index.html is loaded.

**Prevention:** Add a catch-all route in `staticwebapp.config.json`:
```json
{
  "routes": [
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ]
}
```
This is the standard SWA pattern (HIGH confidence — verified via SWA CLI docs). The `responseOverrides` block can separately serve a real 404 page for the API path.

**Warning signs:** App works in dev but navigating to a URL directly in prod returns "page not found."

**Phase to address:** Phase 1 (SWA scaffold). Add this config before deploying anything.

---

### Pitfall 7: RDW Dataset Gaps and Unreliable Fields

**What goes wrong:** The RDW `gekentekende_voertuigen` dataset is the primary source, but several fields are known to be absent or stale for certain vehicle categories:

| Field | Problem |
|-------|---------|
| `datum_eerste_toelating` (first admission date) | Present for all registered vehicles |
| `apk_vervaldatum` (MOT expiry) | Missing for vehicles exempt from APK (historic, diplomatic, dealer plates) |
| `kleur` (color) | Only 1–2 color codes from a fixed enum; doesn't match real-world color for multi-tone cars |
| `catalogusprijs` (catalogue price) | Often null for older vehicles, imports, or commercial vehicles |
| `bruto_bpm` (BPM tax) | Null for commercial and exempt vehicles |
| `wam_verzekerd` (insured status) | Present but legally restricted — do not prominently display this |
| Ownership history | Not in the public RDW dataset; this data is privacy-protected |

**Prevention:**
- Treat every RDW field as optional in TypeScript types. Never assume a field is present.
- Design the UI card to gracefully omit fields that are null/empty — do not show "Unknown" for everything, show nothing.
- Do not build any feature that depends on `catalogusprijs` being populated; it will break for a large portion of queries.

**Warning signs:** UI showing "Unknown" in most fields for trucks, campers, or older vehicles. Test with a diverse set of plates (old car, commercial van, electric, import).

**Phase to address:** Phase 1 (RDW integration). Test with at least 10 diverse plates from day one.

---

### Pitfall 8: LLM Hallucinating Vehicle Facts

**What goes wrong:** If the prompt asks the LLM to "tell me about this car," it will confidently invent facts not present in the RDW data — fabricated recall notices, incorrect fuel consumption figures, wrong model years. Users trusting the app for a secondhand purchase decision could be misled.

**Prevention:**
- Never ask the LLM to "know" things about the vehicle. Only ask it to summarize or rephrase data you explicitly provide in the prompt.
- Structure the prompt as: "Here is the raw data for vehicle [plate]: [JSON payload]. Write a 2-sentence consumer-friendly summary of what this data shows. Do not add any information not in the data."
- Use `response_format: { type: "json_schema" }` with structured output to constrain the LLM to a fixed set of fields it must populate from the provided data. This prevents free-form hallucination (HIGH confidence — verified OpenAI structured outputs docs).
- Add a UI disclaimer: "AI-generated summary based on official RDW data."

**Warning signs:** LLM output mentions recall notices when no recall data was passed; output contains specific safety ratings not present in RDW data.

**Phase to address:** Phase 2 (LLM integration). Include grounding constraints in the first prompt, not as a later refinement.

---

### Pitfall 9: Layout Shift During Progressive Card Loading

**What goes wrong:** Cards load sequentially as API responses arrive. Each card appearing pushes other content down the page. On low-end Android devices, this combined with CSS animations creates a janky experience and fails Core Web Vitals (CLS > 0.1).

**Prevention:**
- Reserve vertical space for each card before its data arrives. Use skeleton screens with a fixed minimum height matching the expected card height.
- Use CSS `min-height` on card containers rather than letting them grow from 0.
- Stagger animation with `animation-delay` rather than triggering animation on mount (mount-triggered animations compound with layout shifts).
- Test on Chrome DevTools mobile throttling (Moto G Power profile) before shipping.

**Warning signs:** CLS score > 0.1 in Lighthouse; cards visibly jumping when secondary data arrives.

**Phase to address:** Phase 2 (UI data loading). Design skeleton screens before building the actual card UI.

---

### Pitfall 10: Plugin Architecture That Collapses at the 5th Data Source

**What goes wrong:** The project spec requires "plugin-style data source architecture" for extensibility. A common mistake is building a runtime plugin registry (factory pattern, dynamic `require()`, plugin manifest files) that works beautifully for 2–3 sources but becomes a maintenance burden when you add source #4 and it has different auth, different error handling, and a 10-second timeout instead of 500ms.

**Why it happens:** Over-engineering upfront — treating a compile-time concern (which sources exist) as a runtime concern (dynamic registration).

**Consequences:** Complex plugin loading code that is hard to test, hard to type, and difficult to add new sources to without touching the registry logic.

**Prevention — use the Module Pattern instead:**
- Each data source is a TypeScript module with a standardized interface: `{ fetch(plate: string): Promise<SourceResult> }`.
- The orchestrator function imports each source module statically and calls them with `Promise.allSettled()`.
- Adding a new source = adding a new file + one import line. No registry, no dynamic loading, no plugin manifest.
- A shared `SourceResult` type with `{ status: 'ok' | 'error' | 'empty', data: T | null, latencyMs: number }` gives the UI everything it needs for each card.

**Warning signs:** A `pluginRegistry.register()` call anywhere in the codebase. A `plugins/` directory with a loader and a manifest. A function that takes a source name as a string parameter.

**Phase to address:** Phase 1 (architecture). Lock in the module pattern before writing any source modules.

---

## Minor Pitfalls

---

### Pitfall 11: Dutch Locale in Date and Number Formatting

**What goes wrong:** JavaScript `Date.toLocaleDateString('en-US')` outputs `5/20/2026` when Dutch users expect `20-5-2026` or `20 mei 2026`. APK expiry dates and first registration dates displayed in US format confuse users and look unprofessional.

**Prevention:**
- Use `Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })` for all displayed dates.
- License plate display convention: uppercase with hyphens (`AB-12-CD`), not spaces.
- For mileage and weight fields: use `Intl.NumberFormat('nl-NL')` — Dutch uses period as thousands separator and comma as decimal (i.e. `1.234,56` not `1,234.56`).

**Warning signs:** Dates showing in `MM/DD/YYYY` format; mileage showing `1,234` instead of `1.234`.

**Phase to address:** Phase 1 (UI scaffold). Set locale defaults globally, not per-component.

---

### Pitfall 12: Azure Functions Node.js Bundle Size and Cold Start Correlation

**What goes wrong:** If the Azure Function imports the full Azure SDK (`@azure/data-tables`, `@azure/storage-blob`) at module level, plus an LLM SDK, plus a full HTTP client — the node_modules tree can exceed 50MB. Azure loads this from storage on cold start, adding seconds.

**Prevention:**
- Bundle with `esbuild` to a single minified JS file. This reduces cold start file I/O from scanning thousands of files to reading one.
- Import only the specific sub-packages needed: `@azure/data-tables` not `@azure/storage`.
- Use the native `fetch` API (available in Node 18+) instead of `axios` or `node-fetch` — eliminates one dependency entirely.

**Warning signs:** Deployment package larger than 5MB after bundling; `node_modules` in the deployed zip.

**Phase to address:** Phase 1 (Azure Functions setup). Add esbuild to the build pipeline before any dependencies accumulate.

---

### Pitfall 13: Displaying Vehicle Insurance Status (`wam_verzekerd`)

**What goes wrong:** The RDW API returns a `wam_verzekerd` field (WAM = mandatory liability insurance). Displaying this prominently creates a legal grey area: suggesting a vehicle is uninsured based on a potentially stale field could be defamatory or misleading. Dutch traffic law (WAM) restricts who can use this data and how.

**Prevention:**
- Do not display insurance status in v1. The field adds complexity and legal exposure for near-zero user value.
- If displayed in future versions, add prominent freshness warning ("this data may be 24h old") and a disclaimer that only the RDW portal is authoritative.

**Warning signs:** Insurance field appearing in a UI card. Users interpreting it as real-time status.

**Phase to address:** Phase 1 (RDW data model). Exclude the field from the TypeScript type that the UI consumes.

---

## Legal and Compliance

---

### RDW Open Data License

**Status:** MEDIUM confidence — based on stated RDW policy, verify against current terms.

The RDW publishes its datasets under an open data policy compatible with commercial use. The data is made available under a Creative Commons 0 (CC0) or equivalent "no rights reserved" license, meaning:
- Commercial use is permitted.
- No attribution required (though good practice).
- No restrictions on combining with other data sources.

**Caveat:** Some RDW datasets contain derived or licensed third-party data (e.g. vehicle type approval data from EU sources). These fields may have different terms. Check the dataset metadata page for each endpoint you use.

**Prevention:** Document the dataset license URL in the project. Do not display raw RDW data in bulk downloadable form (that would more clearly trigger data redistribution questions).

---

### Privacy — Vehicle Owner History

**Status:** HIGH confidence — Dutch law (AVG/GDPR + RDW regulation).

The RDW public API does **not** expose:
- Current vehicle owner name or address.
- Historical owner names or addresses.
- Owner count (number of previous owners) is present in some dataset fields but not owner identities.

Displaying number of previous owners (`aantal_eigenaren`) is fine — it is an anonymized aggregate. Do not attempt to correlate plate data with any other data source to identify owners. This would constitute processing of personal data under GDPR without a legal basis.

**Prevention:** Build no feature that attempts to identify vehicle owners. If a user asks "who owns this car," the answer is "we don't have and don't show that data."

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| RDW API integration | Throttling without app token | Register Socrata token before first fetch call |
| RDW data model | Missing/null fields crashing UI | All RDW types must be `optional`, test with 10+ diverse plates |
| Azure infra setup | SPA routing 404 on direct URL | Add `staticwebapp.config.json` catch-all on day 1 |
| Azure infra setup | Cold start destroying P50 latency | Deploy as package, consider Flex Consumption from the start |
| Azure Tables design | Hot partition under load | Use 2-char plate prefix as PartitionKey |
| LLM integration | Cost runaway | Cache LLM output before wiring up the call |
| LLM integration | Hallucination in output | Grounding prompt + structured output schema |
| UI progressive loading | CLS / layout shift | Reserve card height with skeletons before data arrives |
| Source architecture | Plugin system complexity | Module pattern with static imports, no registry |
| Locale/formatting | US date/number formats | Set `nl-NL` locale globally at scaffold |

---

## Sources

- Socrata SODA API throttling docs: https://dev.socrata.com/docs/app-tokens.html (HIGH)
- Socrata CORS docs: https://dev.socrata.com/docs/cors-and-jsonp.html (HIGH)
- Azure Functions scale and cold start: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale (HIGH)
- Azure Functions Node.js cold start mitigation: https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node (HIGH)
- Azure Flex Consumption plan: https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to (HIGH)
- Azure Table Storage design: https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-design (HIGH)
- Azure Static Web Apps routing: https://github.com/azure/static-web-apps-cli (HIGH)
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs (HIGH)
- OpenAI production best practices (cost monitoring): https://developers.openai.com/api/docs/guides/production-best-practices (HIGH)
- RDW open data license: https://opendata.rdw.nl (MEDIUM — verify current terms)
- Dutch plate sidecode formats: domain knowledge (MEDIUM — verify against RDW dataset field documentation)
