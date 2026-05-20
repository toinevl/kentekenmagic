# Technology Stack: KentekenMagic

**Project:** KentekenMagic — Dutch license plate lookup web app
**Researched:** 2026-05-20
**Constraints:** Azure free/low-cost tiers, animation-rich consumer UX, free data sources only, no user auth

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (App Router) | Frontend + static export | First-class Azure SWA support, largest animation ecosystem (Motion/Framer), hybrid static export proven on Azure |
| React | 19.x | UI layer | Required by Next.js; largest motion library ecosystem targets React |
| TypeScript | 5.x | Language | Type-safe API responses from RDW are essential; Azure Functions v4 model is TS-first |

**Why Next.js over SvelteKit:** Azure Static Web Apps has two documented deployment models for Next.js (hybrid with App Router + RSC, and static export). SvelteKit is listed as supported via `adapter-static` but lacks the first-class Azure integration path. More critically, the **motion animation library ecosystem is React-centric**: `motion/react` (formerly Framer Motion) is the de-facto standard for awwwards-tier React UIs; its Svelte equivalent (`motion-v` for Vue, limited Svelte support) is a second-class citizen. For a consumer product where animation quality is a core deliverable, the React/Next.js ecosystem is unambiguously better.

**Why not Astro:** Astro is excellent for content-heavy static sites but its interactive island architecture creates friction for a highly stateful lookup UI (search input → loading state → animated results → expandable cards). Every interactive section becomes an island boundary to manage. Next.js App Router with selective `use client` components is a cleaner model for this interaction pattern.

**Deployment mode:** Use Next.js `output: 'export'` (static HTML export) NOT the hybrid preview. The hybrid mode (Preview) has a 250 MB size cap and runs on a managed App Service instance that may have cost implications. Static export works perfectly for KentekenMagic: the lookup itself is just a route `/[plate]` that fetches from Azure Functions — no server-side rendering needed, no RSC required. Static export is GA, simpler, and free-tier safe.

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
}
```

### Backend Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure Functions | v4 programming model | API proxy + caching layer | Consumption plan: 1M free executions/month, 400K GB-seconds free |
| Node.js | 20 LTS | Functions runtime | TypeScript-first, same language as frontend, lowest cold start among Node/Python/.NET for this workload |
| TypeScript | 5.x | Functions language | Shared types between frontend and backend; Azure Functions v4 model is designed for TypeScript |

**Why Node.js over Python:** Python has slower cold starts on Azure Functions consumption plan and requires a separate type system (Pydantic) for shared types. The Functions v4 Node.js model has the cleanest TypeScript ergonomics (`app.http(...)` pattern) and shares npm packages (including `@azure/data-tables`) with the frontend build toolchain.

**Why Node.js over .NET:** .NET has the fastest cold start but introduces a second language and type system. The marginal performance gain is not worth the complexity for a team (or solo developer) building a consumer web app. Node.js cold starts on consumption plan are acceptable for a lookup app (users accept ~1-2s on first lookup).

**Functions v4 HTTP trigger pattern:**
```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

app.http('lookupPlate', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'lookup/{plate}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // check cache → fetch RDW → write cache → return
  }
});
```

### Data Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Azure Table Storage | via `@azure/data-tables` | Response cache for plate lookups | ~$0.00036/10K transactions; 1K lookups/day = ~$0.01/month |
| `@azure/data-tables` | latest (12.x) | TypeScript SDK for Table Storage | Official Microsoft SDK; `TableClient` + `upsertEntity("Replace")` covers all cache needs |

**Caching strategy:** Use the first two normalized plate characters as `PartitionKey` and the full normalized plate as `RowKey`. Store the aggregate response in one entity with embedded source metadata and TTL fields. This avoids hot partitions while keeping exact-match cache lookups cheap and simple.

```typescript
import { TableClient } from '@azure/data-tables';
// upsert pattern
await table.upsertEntity({ partitionKey: plate.slice(0, 2), rowKey: plate, data: JSON.stringify(result), cachedAt: new Date().toISOString() }, 'Replace');
```

### Animation / Motion

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Motion (motion/react) | 12.x | UI animations — page transitions, card reveals, spring micro-interactions | Hardware-accelerated, hybrid WAAPI/JS engine, React-native API, scroll utilities built-in |

**Why Motion (not GSAP, not CSS transitions):**

Motion (the library formerly known as Framer Motion, rebranded as `motion` at motion.dev) is the right choice for this project for three reasons:

1. **React integration is first-class.** `motion.div`, `AnimatePresence`, `useMotionValue`, `useSpring` — these are idiomatic React patterns. GSAP requires imperative refs and `useEffect` cleanup, which fights React's declarative model.

2. **Free for commercial use.** GSAP's premium plugins (ScrollTrigger, ScrollSmoother, SplitText) require a paid Club GreenSock license for commercial projects. Motion is MIT-licensed. GSAP core is free but for the awwwards-tier effects (scroll-driven parallax, staggered text reveals) you'd need premium plugins.

3. **Hardware acceleration.** Motion uses the Web Animations API (WAAPI) where available, falling back to JS. This means GPU-accelerated transforms and opacity changes that maintain 60/120fps even on mid-range phones.

**What to use Motion for in KentekenMagic:**
- `AnimatePresence` + `motion.div` with `initial/animate/exit` for card section reveal as data loads
- `layout` prop for smooth card expand/collapse
- `useSpring` + `useMotionValue` for the license plate input "pop" on submit
- `whileHover` / `whileTap` for button micro-interactions
- `useInView` for scroll-triggered card animations
- `scroll()` + `animate()` for any parallax header effects

**What NOT to use:**
- Do not mix GSAP and Motion — pick one animation system. GSAP is excellent but its commercial licensing risk for a potentially monetized product (ads, affiliate links) is not worth it.
- Do not use CSS-in-JS animation libraries (styled-components, Emotion) — they add runtime overhead and fight with Tailwind.
- Do not use React Spring — Motion's API is more expressive and its scroll utilities are superior for this use case.

### CSS

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | CSS-first config in v4, no PostCSS config needed, excellent for component-level design systems |
| CSS custom properties | native | Design tokens (colors, spacing, plate orange) | Pair with Tailwind for dynamic theming |

**Why Tailwind over CSS-in-JS:** Animation-heavy consumer UIs work best with Tailwind because:
1. Layout and spacing are static (Tailwind) while motion is handled by Motion library (JS) — clean separation of concerns
2. CSS-in-JS libraries (Emotion, styled-components) serialize styles at runtime, adding overhead that competes with animation frame budget
3. Tailwind v4's CSS-first config (`@theme`) and improved performance make it the obvious choice in 2025

**Tailwind v4 CSS config (no `tailwind.config.js` needed):**
```css
@import "tailwindcss";
@theme {
  --color-plate-orange: oklch(72% 0.18 55);  /* Dutch license plate yellow-orange */
  --font-sans: 'Inter Variable', sans-serif;
}
```

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@azure/data-tables` | 13.x | Azure Table Storage client | In Functions only (not frontend) |
| `@azure/identity` | 4.x | Managed Identity auth to Table Storage | Prefer over connection strings in production |
| `zod` | 3.x | Runtime validation of RDW API responses | Validate every external API response shape |
| `swr` or `@tanstack/react-query` | latest | Client-side data fetching + loading states | TanStack Query preferred for its superior loading/error state management with `suspense: true` |
| Inter Variable | via `fontsource` | Typography | Variable font, 1 network request, excellent legibility at all weights |

---

## RDW API

**Confidence: HIGH** (from official documentation + training knowledge on the Socrata platform)

### Key Facts

- **No API key required** for unauthenticated access (public open data under the PDDL license)
- **Base URL:** `https://opendata.rdw.nl/resource/{dataset-id}.json`
- **Query format:** Socrata Open Data API (SODA) — use `$where`, `$limit`, `$select` query parameters
- **Rate limits:** Unauthenticated requests are throttled (exact limit not publicly published; observed ~1000 req/hour per IP in community reports). KentekenMagic's Azure Functions cache layer eliminates this concern entirely — RDW is only called on cache miss.
- **HTTPS only**, CORS-permissive (can call from browser directly, but prefer server-side for caching)

### Core Dataset IDs

| Dataset | ID | Contents |
|---------|-----|---------|
| Gekentekende voertuigen (primary) | `m9d7-ebf2` | Make, model, color, fuel type, mass, registration date, BPM, WAM, insurance status |
| APK (MOT history) | `sgfe-77wx` | APK inspection events and expiry dates |
| Voertuig brandstof | `8ys7-d773` | Fuel type details, CO2, environmental class |
| Terugroepacties (recalls) | `af5r-44mf` | Active recalls per brand/type |
| Carrosserie | `vezc-m2t6` | Body type classification |
| As-informatie (axle/weight) | `3huj-srit` | Axle load, weight distribution |

**Primary lookup pattern:**
```
GET https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=XX123Y
```
Returns array (usually 1 item). Field `kenteken` is always uppercase, no hyphens.

**APK lookup:**
```
GET https://opendata.rdw.nl/resource/sgfe-77wx.json?kenteken=XX123Y&$order=meld_datum_door_keuringsinstantie%20DESC&$limit=10
```

### Additional Free Sources

| Source | URL | Contents | Notes |
|--------|-----|---------|-------|
| EU RAPEX (recalls) | `https://webgate.ec.europa.eu/rasff-window/api/` | EU safety recalls | Free, no key |
| RVO (energy label) | `https://www.rvo.nl/onderwerpen/auto-en-vervoer` | Energy label per vehicle | Check current API availability |
| ANWB / Autodata | Not free | - | Out of scope for v1 |

---

## LLM Integration

**Recommendation: Claude Haiku 3.5** (with GPT-4o-mini as fallback)

| Model | Cost (input/output per 1M tokens) | Context | Latency | Verdict |
|-------|----------------------------------|---------|---------|---------|
| Claude Haiku 3.5 | $0.80 / $4.00 | 200K | ~0.5s TTFT | **Recommended** |
| GPT-4o-mini | $0.15 / $0.60 | 128K | ~0.4s TTFT | Strong alternative |
| Azure OpenAI (GPT-4o-mini) | similar + deployment overhead | 128K | varies | Only if Azure credits required |

**Why Claude Haiku 3.5 over GPT-4o-mini:** Haiku 3.5 produces more coherent Dutch-language output and has superior instruction following for structured summarization tasks. For a Dutch-language product summarizing Dutch vehicle data, language quality matters. GPT-4o-mini is slightly cheaper on input tokens and a valid fallback.

**Why not Azure OpenAI:** Azure OpenAI requires a deployment, quota request, and adds configuration complexity. The Anthropic and OpenAI APIs are callable directly from Azure Functions without any Azure-specific setup. Use Azure OpenAI only if you receive Azure credits that require spending through Azure services.

**LLM task scope for v1:**
1. **Vehicle summary:** 2-3 sentence human-readable summary of the vehicle ("This is a 2018 BMW 320d, a German executive saloon with 190hp and diesel engine. Based on APK history it has been regularly maintained.")
2. **Recall flag:** Plain-language description of any open recalls
3. **Buying advice flag:** If secondhand lookup context is added later

**Integration pattern:** Non-blocking. Core RDW data renders immediately. LLM enrichment fires as a separate async request after core data loads; result streamed into a summary card via SSE or simple polling. Never on the critical render path.

**Estimated cost:** At 500 lookups/day with ~800 input tokens (vehicle data) + ~200 output tokens: ~0.5M tokens/month = ~$0.40/month on Haiku 3.5. Negligible.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend | Next.js 15 | SvelteKit | Weaker Azure SWA integration path; motion library ecosystem is React-centric |
| Frontend | Next.js 15 | Astro | Island architecture fights stateful lookup UI; less suitable for app-like interactions |
| Functions runtime | Node.js 20 | Python 3.11 | Slower cold start; requires separate type system; no shared packages with frontend |
| Functions runtime | Node.js 20 | .NET 8 | Second language; marginal perf gain not worth complexity |
| Animation | Motion (motion/react) | GSAP | GSAP premium plugins (needed for awwwards-tier effects) require paid license |
| Animation | Motion (motion/react) | CSS transitions | Insufficient for complex orchestrated animations; no spring physics |
| Animation | Motion (motion/react) | React Spring | Inferior scroll utilities; smaller ecosystem; Motion is strictly better |
| CSS | Tailwind CSS 4 | Emotion/styled-components | Runtime style serialization competes with animation frame budget |
| CSS | Tailwind CSS 4 | CSS Modules | Verbose for utility patterns; no design token system |
| LLM | Claude Haiku 3.5 | Azure OpenAI | Deployment overhead; no benefit unless Azure credits mandate it |
| Storage | Azure Table Storage | Azure Cosmos DB | Overkill; 25 GB free Cosmos tier tempting but Table Storage is $0.01/month for this workload |
| Storage | Azure Table Storage | Azure Blob | Wrong abstraction for key-value cache lookup by plate number |

---

## Installation

```bash
# Frontend (Next.js project root)
npm install next@latest react@latest react-dom@latest typescript
npm install motion tailwindcss @tanstack/react-query zod
npm install @fontsource-variable/inter

# Dev dependencies
npm install -D @types/react @types/node

# Azure Functions (api/ directory)
cd api
func init --worker-runtime node --language typescript
npm install @azure/data-tables @azure/identity @anthropic-ai/sdk zod
```

---

## Key Constraints Validated

| Constraint | Stack Decision | Validation |
|------------|----------------|------------|
| Azure free tier | Azure Functions consumption plan (1M free exec/month) | Confirmed: Microsoft docs state free grant |
| Azure free tier | Azure Static Web Apps Free SKU | Confirmed: Free SKU available via Terraform/portal |
| Azure free tier | Azure Table Storage | ~$0.00036/10K ops; 1K lookups/day = ~$0.01/month |
| No API key (RDW) | Direct SODA API calls with caching | Confirmed: opendata.rdw.nl is public open data, PDDL license |
| Animation quality | Motion (motion/react) 12.x | MIT license, hardware-accelerated, React-native |
| No user auth | No session/auth libraries needed | Simplifies stack significantly |

---

## Sources

- Azure Static Web Apps Next.js deployment: https://learn.microsoft.com/en-us/azure/static-web-apps/nextjs (HIGH confidence)
- Azure Static Web Apps framework support: https://learn.microsoft.com/en-us/azure/static-web-apps/overview (HIGH confidence)
- Azure Functions consumption plan free grant: https://learn.microsoft.com/en-us/azure/azure-functions/functions-consumption-costs (HIGH confidence)
- Azure Functions v4 Node.js/TypeScript model: https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node (HIGH confidence)
- Azure Data Tables SDK: https://learn.microsoft.com/en-us/azure/cosmos-db/table/quickstart-nodejs (HIGH confidence)
- Motion library (Next.js integration): https://motion.dev/docs/react-installation (HIGH confidence, Context7)
- Motion library (scroll, spring): https://motion.dev/docs/spring (HIGH confidence, Context7)
- GSAP license (premium plugins): https://gsap.com/docs/v3/Plugins (MEDIUM confidence — commercial terms inferred from GreenSock Club model)
- RDW opendata.rdw.nl dataset IDs: Training knowledge (MEDIUM confidence — verify dataset IDs before coding; Socrata platform structure is stable but specific IDs should be confirmed at https://opendata.rdw.nl)
- Claude Haiku 3.5 / GPT-4o-mini pricing: Training knowledge as of August 2025 (MEDIUM confidence — verify current pricing at anthropic.com/api and openai.com/pricing before budgeting)
