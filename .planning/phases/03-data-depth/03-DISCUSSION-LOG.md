# Phase 3: Data Depth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 3-Data Depth
**Areas discussed:** APK timeline depth, Loading strategy

---

## APK Timeline Depth

### Q1: Replace or separate card?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace ApkCard | Phase 3 expands the APK card to show expiry + full history inline. Cleaner — one card owns all APK information. | ✓ |
| Separate card below ApkCard | Keep existing ApkCard, add new 'APK Historie' card beneath it. More modular. | |
| You decide | Let the planner choose based on implementation ease. | |

**User's choice:** Replace ApkCard

---

### Q2: How many inspections by default?

| Option | Description | Selected |
|--------|-------------|----------|
| Last 5 inspections | Most users care about recent history. 5 covers ~5 years. "Show more" toggle reveals the rest. | ✓ |
| All inspections | Complete history. Some vehicles have 20+ inspections. | |
| Last 3 inspections | Very compact. Fine for newer vehicles. | |

**User's choice:** Last 5 inspections

---

### Q3: Defects inline or separate?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline per inspection | Each inspection row shows defect count. Defects are contextual to the inspection date. | ✓ |
| Separate defect section | All defects listed together after the timeline. Simpler join. | |
| Skip defects in Phase 3 | Show inspection dates and results only. Defer defects. | |

**User's choice:** Inline per inspection

---

### Q4: Defect detail level?

| Option | Description | Selected |
|--------|-------------|----------|
| Defect count + descriptions only | Show number of defects and their omschrijving from hx2c-gt7k. No codes. Readable. | ✓ |
| Full technical detail | Include RDW defect codes, severity, and full descriptions. More complete but noisier. | |
| Defect count only | Just '3 gebreken' per inspection. Minimal. | |

**User's choice:** Defect count + descriptions only

---

## Loading Strategy

### Q1: Parallel with core or lazy?

| Option | Description | Selected |
|--------|-------------|----------|
| With core lookup, same request | Add to sourceRegistry — all sources run in parallel with existing timeouts. Simpler. | ✓ |
| Separate lazy request | Like AI enrichment — core cards first, then second fetch. Better perceived performance, more complex. | |
| You decide | Researcher evaluates RDW dataset latency. | |

**User's choice:** With core lookup, same request

---

### Q2: Per-source timeout?

| Option | Description | Selected |
|--------|-------------|----------|
| Same as current (3.5s) | Consistent with rdwVehicle. Individual timeouts mean Phase 3 sources can fail without blocking core. | ✓ |
| Shorter (2s) | Phase 3 sources are "nice to have" — fail faster. | |
| Longer (5s) | APK history joins multiple datasets, may be slower. | |

**User's choice:** Same as current (3.5s)

---

### Q3: Cache TTL?

| Option | Description | Selected |
|--------|-------------|----------|
| 24h (same as rdwVehicle) | APK history and recall status change at most daily. Matches existing baseline. | ✓ |
| 7 days (like AI enrichment) | Data rarely changes. Reduces RDW API calls. | |
| 1 hour (conservative) | Recall status is safety-critical — keep it fresh. | |

**User's choice:** 24 hours

---

## Claude's Discretion

- Recall card placement (separate card vs integrated with APK card)
- Modifications card scope and empty state handling
- Frontend card ordering for Phase 3 cards

## Deferred Ideas

None raised during discussion.
