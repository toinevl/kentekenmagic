# KentekenMagic

## What This Is

KentekenMagic is a consumer-grade Dutch license plate lookup web app that aggregates free public data about any registered vehicle — from official RDW specs and MOT history to safety recalls — and presents it in a fast, beautifully designed interface that makes existing government-grade alternatives feel obsolete. The target audience is the general public: anyone who spots an interesting car on the street or wants to know more before buying a secondhand vehicle.

## Core Value

Any Dutch license plate → full vehicle intelligence in seconds, presented so clearly that no competing site comes close on design or data breadth.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can enter a Dutch license plate and immediately see vehicle data
- [ ] Data is organized into collapsible card sections (Overview, Technical, History, Recalls, ...)
- [ ] App pulls from multiple free data sources (RDW API, recall databases, etc.)
- [ ] Architecture supports adding new data source cards without structural changes
- [ ] Results load fast — perceived sub-2s for core data, progressive loading for secondary cards
- [ ] UI matches awwwards-tier interaction design standards (consumer product feel)
- [ ] No user accounts required — fully anonymous lookups
- [ ] App is deployed on Azure (Static Web Apps + Functions, free/low-cost tiers)
- [ ] State and caching stored in Azure Tables
- [ ] LLM-powered enrichment for natural language summaries and insights

### Out of Scope

- User accounts, saved searches, lookup history — deferred to v2
- Paid data sources — free APIs only in v1
- Mobile native app — responsive web first
- Real-time market value / pricing data — separate paid data problem
- Fleet/bulk lookup — consumer single-lookup focus for v1

## Context

**Dutch open data landscape:** The RDW (Dutch Vehicle Authority) publishes a rich open data API at opendata.rdw.nl covering registration, technical specs, fuel, APK (MOT) history, ownership transfers, and more — all free with no key required for basic use. The EU also maintains a public recall database (RAPEX). Additional sources include the Netherlands Enterprise Agency (RVO) and public vehicle databases.

**Competitive landscape:** Existing Dutch plate lookup tools (RDW's own portal, kentekenpro.nl, etc.) are functional but visually dated — government-grade UI, cluttered layouts, no design sensibility. KentekenMagic wins on both dimensions: more data sources AND a consumer product design quality.

**Design inspiration:** awwwards.com interaction design category — fluid transitions, purposeful whitespace, typographic hierarchy, micro-interactions. The benchmark is "feels like a premium product, not a database lookup."

**LLM role:** Low-cost models (GPT-4o-mini, Claude Haiku) used for: summarizing vehicle data into readable prose, flagging notable findings ("this car has 3 open recalls"), and future enrichment tasks. Not blocking the UI — runs async after core data loads.

## Constraints

- **Budget**: Azure free/low-cost tiers only — Azure Static Web Apps (free), Azure Functions consumption plan (free tier), Azure Tables (cheap per transaction), no premium services
- **Data**: Free APIs only — no paid data subscriptions in v1
- **LLMs**: Low-cost models only (Haiku, GPT-4o-mini, or Azure OpenAI free credits) — used for enrichment, not core functionality
- **Architecture**: Extensible by design — new data source cards must be addable without backend structural changes
- **Auth**: No authentication in v1 — fully public, no user state

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Azure Static Web Apps + Functions | Free tier covers expected traffic; serverless = no idle cost | Accepted for v1 |
| Azure Tables for caching/state | Extremely cheap per operation, perfect for plate lookup caching | Accepted for v1; use 2-character plate prefix partitioning |
| No user accounts in v1 | Reduces scope significantly; anonymous lookup covers the main use case | Accepted for v1 |
| Module-style data source architecture | New data sources are independent modules with one registry import | Accepted for v1 |
| Single aggregator Function | One backend endpoint fans out to source modules and returns partial results | Accepted for v1 |
| Progressive data loading | Core RDW data loads first; enrichment and deep cards can resolve later | Accepted for v1 |
| Low-cost LLM enrichment | Summaries and insights add UX value without expensive model cost | Accepted for v1, async and cached only |
| Free data sources only | Keeps operating cost at zero/near-zero | Accepted for v1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-20 after initialization*
