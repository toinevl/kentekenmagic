# Feature Landscape

**Domain:** Dutch license plate / vehicle lookup consumer web app
**Researched:** 2026-05-20
**Confidence:** HIGH (RDW fields verified against live API; competitor observations from live HTTP probes)

---

## RDW Open Data: What Is Actually Available

All data below was verified against live RDW Socrata APIs (opendata.rdw.nl) on 2026-05-20.
No API key required. CORS-friendly JSON. Rate limits generous for consumer traffic.

### Primary Vehicle Dataset — `m9d7-ebf2` (Gekentekende_voertuigen)

One record per license plate. Confirmed fields with actual values:

| Field | Example Value | Notes |
|-------|--------------|-------|
| kenteken | GHD27V | The lookup key |
| voertuigsoort | Personenauto | Vehicle type |
| merk | KIA | Brand |
| handelsbenaming | NIRO | Commercial name / model |
| inrichting | stationwagen | Body style (hatchback, sedan, etc.) |
| eerste_kleur | BLAUW | Primary color |
| tweede_kleur | Niet geregistreerd | Secondary color |
| datum_eerste_toelating | 20240813 | First EU/world registration date |
| datum_eerste_tenaamstelling_in_nederland | 20240813 | First NL registration date |
| datum_tenaamstelling | 20240813 | Current owner registration date |
| vervaldatum_apk | 20280813 | APK (MOT) expiry date |
| catalogusprijs | 42475 | Catalogue price at launch (EUR) |
| bruto_bpm | 2758 | Vehicle purchase tax |
| aantal_zitplaatsen | 5 | Seats |
| aantal_deuren | 5 | Doors |
| aantal_cilinders | 4 | Cylinders |
| cilinderinhoud | 1580 | Engine displacement (cc) |
| massa_ledig_voertuig | 1374 | Kerb weight (kg) |
| massa_rijklaar | 1474 | Ready-to-drive weight (kg) |
| technische_max_massa_voertuig | 1940 | Max technical mass (kg) |
| toegestane_maximum_massa_voertuig | 1940 | Max permitted mass (kg) |
| maximum_trekken_massa_geremd | 1010 | Max towing (braked, kg) |
| maximum_massa_trekken_ongeremd | 600 | Max towing (unbraked, kg) |
| maximale_constructiesnelheid | 154 | Max design speed (km/h) |
| lengte | 442 | Vehicle length (cm) |
| breedte | 183 | Vehicle width (cm) |
| hoogte_voertuig | 155 | Vehicle height (cm) |
| wielbasis | 272 | Wheelbase (cm) |
| aantal_wielen | 4 | Number of wheels |
| europese_voertuigcategorie | M1 | EU vehicle category |
| typegoedkeuringsnummer | e9*2018/858... | EU type approval number |
| type | SG2 | Type code |
| variant | C5P11 | Variant code |
| uitvoering | D61AY1 | Execution/trim code |
| zuinigheidsclassificatie | A | Fuel economy label (A–G) |
| wam_verzekerd | Ja | Whether WAM-insured (boolean) |
| export_indicator | Nee | Whether marked for export |
| openstaande_terugroepactie_indicator | Nee | Whether open recall exists |
| taxi_indicator | Nee | Taxi flag |
| tellerstandoordeel | Logisch | Odometer verdict |
| jaar_laatste_registratie_tellerstand | 2026 | Year of last odometer reading |
| tenaamstellen_mogelijk | Ja | Transfer permitted |
| maximum_massa_samenstelling | 2950 | Max combination mass |
| vermogen_massarijklaar | 0.05 | Power-to-weight ratio (kW/kg) |

**Important observations:**
- `openstaande_terugroepactie_indicator` is a direct boolean on the main record — fast flag for recall badge
- `zuinigheidsclassificatie` is the energy label (A–G) — present directly, no separate lookup needed
- `tellerstandoordeel` + `jaar_laatste_registratie_tellerstand` gives odometer health verdict
- `catalogusprijs` is present — enables "current value vs. new price" context for buyers
- `datum_tenaamstelling` vs `datum_eerste_tenaamstelling_in_nederland` lets you infer if the car was imported
- `wam_verzekerd` is privacy-redacted for older vehicles ("Geen verstrekking in Open Data")

### Fuel/Emissions Dataset — `8ys7-d773` (Gekentekende_voertuigen_brandstof)

One or more records per kenteken (multiple for hybrid/dual fuel).

| Field | Notes |
|-------|-------|
| brandstof_omschrijving | Benzine, Diesel, Elektrisch, LPG, Waterstof, etc. |
| emissiecode_omschrijving | Emission standard code |
| uitlaatemissieniveau | EURO 0 through EURO 6d-TEMP |

**Gap:** No CO2 g/km in this dataset. CO2 data exists in the TGK (Type Goedkeuring) datasets but requires matching via `typegoedkeuringsnummer` — a two-step lookup, not trivial for MVP.

### APK / MOT Dataset — `sgfe-77wx` (Meldingen Keuringsinstantie)

Multiple records per kenteken — one per inspection event.

| Field | Notes |
|-------|-------|
| kenteken | Lookup key |
| meld_datum_door_keuringsinstantie | Inspection date |
| meld_tijd_door_keuringsinstantie | Inspection time |
| soort_melding_ki_omschrijving | "periodieke controle" / rejection type |
| vervaldatum_keuring | New APK expiry date after this inspection |
| soort_erkenning_omschrijving | APK Lichte voertuigen / Zware voertuigen |
| api_gebrek_constateringen | Link to defects for this inspection |

This gives a **full APK history timeline** per vehicle. Combined with `a34c-vvps` (Geconstateerde Gebreken), you can show which defects were found at each inspection.

### APK Defects Dataset — `a34c-vvps` (Geconstateerde Gebreken)

| Field | Notes |
|-------|-------|
| kenteken | Lookup key |
| meld_datum_door_keuringsinstantie | Inspection date |
| gebrek_identificatie | Defect code (joins to `hx2c-gt7k` for description) |
| aantal_gebreken_geconstateerd | Count of this defect type |

Defect codes resolve to Dutch descriptions via `hx2c-gt7k`. Example: code 576 → specific defect name.

### Recall Datasets — `j9yg-7rg9`, `t49b-isb7`, `mu2x-mu5e`, `9ihi-jgpf`, `mh8w-8cup`

The recall data is **normalised into 5 related tables**:

| Dataset | ID | Content |
|---------|----|---------|
| Terugroep_actie | j9yg-7rg9 | Main recall record: defect description, fix description, dates, risk rating, affected vehicle count |
| Terugroep_actie_status | t49b-isb7 | Per-plate status: "Producent heeft herstel gemeld" etc. — links recall to specific kenteken |
| Terugroep_voertuig_merk_type | mu2x-mu5e | Make/type affected by recall |
| Terugroep_actie_risico | 9ihi-jgpf | Risk category codes |
| Terugroep_informeren_eigenaar | mh8w-8cup | How owner was notified (letter, etc.) |

**Key insight:** `t49b-isb7` links a kenteken directly to a recall reference code with a status. The `openstaande_terugroepactie_indicator` on the main record is the fast boolean check; the status dataset gives current resolution state per plate. The main recall dataset has full defect descriptions in Dutch.

### Other Available Datasets

| Dataset | ID | Relevance |
|---------|----|-----------|
| Gekentekende_voertuigen_carrosserie | vezc-m2t6 | Body type EU code + description |
| Gekentekende_voertuigen_carrosserie_specificatie | jhie-znh9 | Detailed body sub-type |
| Gekentekende_voertuigen_voertuigklasse | kmfi-hrps | Vehicle class |
| Gekentekende_voertuigen_subcategorie_voertuig | 2ba7-embk | EU subcategory |
| Gekentekende_voertuigen_assen | 3huj-srit | Axle count and position codes |
| Gekentekende_voertuigen_bijzonderheden | 7ug8-2dtt | Special characteristics (e.g. "seatbelt anchor points not required") |
| Gekentekende_voertuigen_rupsbanden | 3xwf-ince | Track/crawler bands (heavy equipment) |
| Toegevoegde Objecten | sghb-dzxx | Modifications: LPG tank, tow bar, etc. |
| TGK Basis Uitvoering | byxc-wwua | Type-approval specs: dimension ranges, mass ranges |
| TGK Aandrijving Uitvoering | 4by9-ammk | Engine: cylinder layout, displacement, motor code |
| TGK Energiebron Uitvoering | gr7t-qfnb | Power output (kW), RPM range, noise level (dB), max speed |
| Tellerstandoordeel Trend Toelichting | jqs4-4kvw | Odometer verdict explanation texts |
| Keuringen | vkij-7mwc | Simple APK expiry per plate (lightweight, just one field) |

**Note on TGK datasets:** These are keyed by `typegoedkeuringsnummer` + variant/uitvoering codes, not by kenteken directly. The main vehicle record contains `typegoedkeuringsnummer`, `variant`, and `uitvoering` fields enabling the join. This is a non-trivial multi-step lookup but gives access to exact power output (kW), noise level in dB, and detailed engine specs not available on the main record.

---

## Table Stakes

Features users expect — competitors have them. Missing = product feels incomplete.

| Feature | Data Source | Complexity | Notes |
|---------|------------|------------|-------|
| Brand + model + year display | m9d7-ebf2: merk, handelsbenaming, datum_eerste_toelating | Low | Core hero info |
| Color (primary + secondary) | m9d7-ebf2: eerste_kleur, tweede_kleur | Low | Visual identity |
| Body type / inrichting | m9d7-ebf2: inrichting, carrosserie datasets | Low | Stationwagen, sedan, etc. |
| APK (MOT) expiry date | m9d7-ebf2: vervaldatum_apk or vkij-7mwc | Low | Bold warning if expired/near |
| Fuel type | 8ys7-d773: brandstof_omschrijving | Low | Can be multiple (hybrid) |
| Euro emission standard | 8ys7-d773: uitlaatemissieniveau | Low | EURO 6d-TEMP, etc. |
| Insurance status (WAM) | m9d7-ebf2: wam_verzekerd | Low | Redacted for some older vehicles |
| Open recall indicator | m9d7-ebf2: openstaande_terugroepactie_indicator | Low | Boolean, fast render |
| Number of seats / doors | m9d7-ebf2: aantal_zitplaatsen, aantal_deuren | Low | |
| Weight (kerb + max) | m9d7-ebf2: massa_rijklaar, toegestane_maximum_massa_voertuig | Low | |
| Max towing capacity | m9d7-ebf2: maximum_trekken_massa_geremd | Low | Popular query |
| First registration date | m9d7-ebf2: datum_eerste_toelating | Low | |
| NL registration date | m9d7-ebf2: datum_eerste_tenaamstelling_in_nederland | Low | |
| Export indicator | m9d7-ebf2: export_indicator | Low | |
| Odometer verdict | m9d7-ebf2: tellerstandoordeel + code | Low | Logisch / Niet logisch |
| Engine displacement (cc) | m9d7-ebf2: cilinderinhoud | Low | |
| Cylinder count | m9d7-ebf2: aantal_cilinders | Low | |
| Catalogue price at launch | m9d7-ebf2: catalogusprijs | Low | Context for secondhand buyers |
| Vehicle dimensions | m9d7-ebf2: lengte, breedte, hoogte_voertuig, wielbasis | Low | |
| EU vehicle category | m9d7-ebf2: europese_voertuigcategorie | Low | M1, N1, etc. |

---

## Differentiators

Features that set KentekenMagic apart. Not expected by competitors but valued by users.

### Data Differentiators

| Feature | Data Source | Complexity | Value |
|---------|------------|------------|-------|
| **Full APK history timeline** | sgfe-77wx + a34c-vvps | Medium | Shows every inspection date, pass/fail, and defects found — no competitor visualises this |
| **Recall detail cards** | j9yg-7rg9 + t49b-isb7 | Medium | Full defect description, fix description, risk rating, resolution status per plate |
| **Import history inference** | Compare datum_eerste_toelating vs datum_eerste_tenaamstelling_in_nederland | Low | "This car was first registered in Germany 3 years before coming to NL" |
| **Modifications / added objects** | sghb-dzxx (Toegevoegde Objecten) | Low | LPG tank, tow bar, other aftermarket additions |
| **Special characteristics** | 7ug8-2dtt (Bijzonderheden) | Low | Rare edge cases that affect usage/insurance |
| **Engine power output** | gr7t-qfnb (TGK Energiebron) via typegoedkeuringsnummer join | High | kW, RPM, noise level — not shown by RDW's own portal |
| **Fuel economy label** | m9d7-ebf2: zuinigheidsclassificatie | Low | Already in main record — render as visual A–G badge |
| **BPM context** | m9d7-ebf2: bruto_bpm | Low | Shows what tax was paid — useful context |
| **Power-to-weight ratio display** | m9d7-ebf2: vermogen_massarijklaar | Low | Raw field exists, just needs good visual treatment |

### LLM-Powered Differentiators

| Feature | Input | Output | Model Cost |
|---------|-------|--------|-----------|
| **Plain-language vehicle summary** | All core fields | "This is a 2024 KIA Niro in blue, first registered in NL, currently valid APK until 2028, no open recalls, good fuel economy rating." | Very low (few tokens) |
| **"Watch out for" callouts** | Recall status, odometer verdict, insurance, export flag, APK expiry | Flagged alerts with plain Dutch explanation | Very low |
| **Import narrative** | Date comparison between first_toelating and first_NL | "This car spent 3 years in Germany before being imported — check for right-hand-drive adaptations and foreign service history." | Very low |
| **APK trend interpretation** | APK history + defect codes | "This car has been inspected 4 times. The last two inspections both noted brake-related defects." | Low |
| **Recall severity plain language** | risicobeoordeling_rdw + omschrijving_defect | "This is a serious safety recall — the steering connection may loosen and cause loss of control." | Very low |

### UI/UX Differentiators

| Feature | Approach | Value |
|---------|----------|-------|
| **Progressive card loading** | Core RDW data instant, secondary datasets async | Perceived speed — no blank screen waiting |
| **APK timeline visualisation** | Horizontal timeline with pass/fail markers | First in NL market to show this visually |
| **Recall status badge** | Prominent red/green indicator on hero card | Immediate safety signal — no competitors surface this prominently |
| **Energy label badge** | Visual A–G colour-coded badge | Familiar from appliances — instantly readable |
| **Plate formatting** | Render kenteken in authentic NL yellow plate style | Delight — users immediately recognise their plate format |
| **Mobile-first input** | Large tap target, auto-format hyphen insertion | Competitors have desktop-first inputs |

---

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Historical ownership count** | RDW does NOT publish ownership transfer history in open data — the `datum_tenaamstelling` is current owner only | Infer "years with current owner" from tenaamstelling date; do not falsely imply full chain |
| **Market value / pricing** | No free NL market price API exists; Autotrack, Gaspedaal, Marktplaats are all paid/scraped | Show catalogue price as context; defer market value to v2 with paid source |
| **VIN decoder enrichment** | NHTSA VPIC covers US-spec vehicles; EU VINs decode poorly (error codes in testing) | RDW data is already richer for NL vehicles than any VIN decoder |
| **User accounts and saved searches** | Adds auth complexity, GDPR surface area, backend state — no marginal UX value for anonymous lookup | Anonymous lookup + bookmarkable URLs covers the use case |
| **Bulk / fleet lookup** | Different UX pattern, different cost model, different audience | Single-plate focus for v1 |
| **Competitive pricing comparison** | Requires real-time market data — not free | |
| **Social sharing of results** | GDPR risk — vehicle data links to individuals indirectly | Deep link to plate is sufficient; no share-card generation |
| **APK station finder / booking** | Third-party service integration; out of scope for data aggregation app | Link to RDW erkende bedrijven dataset at most |
| **CO2 g/km from TGK datasets** | Requires 3-way join through typegoedkeuringsnummer — complex, brittle, unreliable for all vehicles | Show fuel economy label (A–G) from main record as proxy; defer CO2 detail to v2 |
| **EU RAPEX / Safety Gate integration** | Safety Gate web app does not expose a machine-readable API (HTML app only, no JSON endpoint found) | Use RDW recall datasets exclusively — they already contain Dutch vehicle recall data comprehensively |

---

## Feature Dependencies

```
APK history timeline → requires sgfe-77wx (inspections) + a34c-vvps (defects) + hx2c-gt7k (defect descriptions)
Recall cards → requires t49b-isb7 (status per plate) → j9yg-7rg9 (recall detail) → 9ihi-jgpf (risk codes)
Engine power → requires m9d7-ebf2 (typegoedkeuringsnummer + variant + uitvoering) → gr7t-qfnb (TGK Energiebron)
LLM summary → requires core vehicle data to have loaded first (async, non-blocking)
Import history → requires only m9d7-ebf2 fields, no extra fetch
Modifications card → requires sghb-dzxx (Toegevoegde Objecten)
```

---

## MVP Recommendation

**Phase 1 — Core lookup (ship this first):**
1. Main vehicle overview: brand, model, year, color, body type, fuel type, Euro emission standard
2. APK expiry with status badge (expired / expiring soon / valid)
3. Open recall indicator badge (boolean from main record — no extra fetch)
4. WAM insurance status
5. Weight, towing, seats, doors, dimensions
6. Fuel economy label (A–G visual badge)
7. Odometer verdict
8. Import inference (date comparison — zero extra fetch)
9. LLM plain-language summary (async, appears after core card)

**Phase 2 — Data depth (second sprint):**
10. Full recall cards (detail cards per open recall — 2–3 extra fetches)
11. APK history timeline (sgfe-77wx + a34c-vvps + hx2c-gt7k)
12. Modifications / added objects (sghb-dzxx)

**Phase 3 — Deep specs (third sprint):**
13. Engine power output via TGK join (complex — deserves its own phase)
14. Special characteristics (bijzonderheden)

**Defer indefinitely:**
- CO2 g/km (TGK join complexity, data quality risk)
- Market value pricing (no free source)
- User accounts (out of scope v1)

---

## Extensibility Surface: Plugin Architecture for Data Source Cards

### Pattern: Card Registry + Async Card Loader

Each data source maps to an independent **card module** with a standard interface:

```typescript
interface DataCard {
  id: string                    // e.g. "apk-history"
  title: string                 // Display title
  priority: number              // Load order (lower = loads first)
  fetch: (kenteken: string) => Promise<CardData>
  render: (data: CardData) => ReactNode
  loadingState: ReactNode       // Skeleton while fetching
  errorState: ReactNode         // If fetch fails — card hides gracefully
}
```

**Why this works:**
- New data source = new file implementing `DataCard` interface
- Main page registers cards from a list; adding a card = adding to the list
- Failed cards degrade gracefully (hide rather than error page)
- Priority field controls load order (core RDW data = 1, LLM summary = 99)
- No backend structural change: Azure Function per card or shared function with card-specific endpoint

**Recommended card groupings:**

| Card ID | Priority | Data Source | Phase |
|---------|----------|------------|-------|
| vehicle-hero | 1 | m9d7-ebf2 (main) | 1 |
| apk-status | 2 | m9d7-ebf2 (vervaldatum) | 1 |
| recall-badge | 3 | m9d7-ebf2 (indicator) | 1 |
| fuel-environment | 4 | 8ys7-d773 + main record | 1 |
| technical-specs | 5 | m9d7-ebf2 (dimensions, weights) | 1 |
| ownership-context | 6 | m9d7-ebf2 (dates) | 1 |
| recall-detail | 10 | t49b-isb7 + j9yg-7rg9 | 2 |
| apk-timeline | 11 | sgfe-77wx + a34c-vvps | 2 |
| modifications | 12 | sghb-dzxx | 2 |
| llm-summary | 99 | LLM enrichment | 1 (async) |

---

## UI Patterns for Vehicle Data Display

### Evidence from automotive consumer apps

**CarFax / AutoCheck pattern (US):**
- Hero: large vehicle image + make/model/year/color at top
- Alert banner: prominent red if open issues (recalls, accidents, odometer problems)
- Tab or accordion sections: Overview | History | Specs | Recalls
- Timeline for ownership + service history
- "No issues found" green checkmarks build trust

**CarGurus / AutoTrader pattern:**
- Card-per-data-category, not one long table
- Progressive disclosure: summary line visible, click to expand
- Color-coded indicators: green (good), amber (attention), red (warning)

**Key UX principles for KentekenMagic:**

1. **Hero card first**: Plate rendered as authentic NL yellow plate, brand logo if available, model name in large type, year
2. **Status signals above the fold**: APK expiry + recall indicator + insurance status as badges — these answer the "is this car safe/legal?" question immediately
3. **Cards not tables**: Each data category is a card with icon, title, summary value, expand-for-detail — avoids the "database printout" feel of RDW OVI and kentekenpro
4. **Skeleton loading > spinner**: Each card shows skeleton while loading, fills in when ready — no blank screen
5. **Mobile-first input**: Full-width plate input, auto-capitalize, format as XX-XX-XX while typing
6. **Amber/red temporal warnings**: APK expiring within 30 days = amber; expired = red. Recall open = red badge. These are the highest-value signals for both buyers and curious users
7. **Inline LLM callouts**: LLM summary renders as a styled "insight" panel after core cards load — not a replacement for structured data, an addition
8. **Collapsible technical specs**: Dimensions, weights, EU type approval numbers — interesting to some, noise to most — collapse by default

---

## Data Source Confidence Assessment

| Source | Status | Confidence | Notes |
|--------|--------|------------|-------|
| RDW m9d7-ebf2 (main vehicle) | Live, tested | HIGH | All field names and sample values verified |
| RDW 8ys7-d773 (fuel) | Live, tested | HIGH | Minimal fields; no CO2 g/km |
| RDW sgfe-77wx (APK history) | Live, tested | HIGH | Full inspection timeline available |
| RDW a34c-vvps (APK defects) | Live, tested | HIGH | Defect codes require join to hx2c-gt7k |
| RDW j9yg-7rg9 (recalls) | Live, tested | HIGH | Rich Dutch text descriptions |
| RDW t49b-isb7 (recall status by plate) | Live, tested | HIGH | Directly links kenteken to recall |
| RDW sghb-dzxx (modifications) | Live, tested | HIGH | LPG tanks, tow bars, etc. |
| RDW gr7t-qfnb (TGK engine power) | Live, tested | MEDIUM | Requires 3-key join; works but complex |
| EU Safety Gate / RAPEX | No machine API | LOW for integration | HTML app only; RDW recalls are comprehensive |
| ANWB open data | Not accessible | LOW | No public API found |
| RVO open data | Domain not found | LOW | DNS failure — may not exist as open API |
| NHTSA VPIC VIN decode | Live, US-only | LOW for NL use | EU VINs decode with errors; limited value |
| OpenChargeMap | API key required | LOW for free tier | Not free without key |

---

## Sources

- RDW Open Data Socrata catalog: `https://api.eu.socrata.com/api/catalog/v1?domains=opendata.rdw.nl` (live verified 2026-05-20)
- RDW main vehicle dataset `m9d7-ebf2`: `https://opendata.rdw.nl/resource/m9d7-ebf2.json` (live verified)
- RDW APK dataset `sgfe-77wx`: `https://opendata.rdw.nl/resource/sgfe-77wx.json` (live verified)
- RDW recall dataset `j9yg-7rg9`: `https://opendata.rdw.nl/resource/j9yg-7rg9.json` (live verified)
- RDW recall status `t49b-isb7`: `https://opendata.rdw.nl/resource/t49b-isb7.json` (live verified)
- RDW fuel dataset `8ys7-d773`: `https://opendata.rdw.nl/resource/8ys7-d773.json` (live verified)
- RDW TGK Energiebron `gr7t-qfnb`: `https://opendata.rdw.nl/resource/gr7t-qfnb.json` (live verified)
- EU Safety Gate: `https://ec.europa.eu/safety-gate-alerts/` (HTML app, no public API — verified 2026-05-20)
- NHTSA VPIC: `https://vpic.nhtsa.dot.gov/api/` (US-only, EU VINs decode poorly — tested)
